import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { TWO_FACTOR_CONFIG } from '../config/constants.js';
import { TwoFactorChallengeModel } from '../models/two-factor-challenge.model.js';
import { UserModel } from '../models/user.model.js';
import {
  AuthResponse,
  Disable2FARequest,
  Login2FAResponse,
  LoginRequest,
  RegisterRequest,
  Verify2FARequest,
} from '../schemas/auth.schemas.js';
import { CryptoService } from './crypto.service.js';
import { EmailService } from './email.service.js';
import { GeminiService, KeyValidationResult } from './gemini.service.js';
import { SessionService } from './session.service.js';

export class ResendCooldownError extends Error {
  public retryAfterSeconds: number;
  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = 'ResendCooldownError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class AuthService {
  /**
   * Gera um código numérico de 6 dígitos criptograficamente seguro.
   */
  public static generateOtp(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Gera o hash SHA-256 de um código OTP para armazenamento seguro.
   */
  public static hashOtp(code: string): string {
    return crypto.createHash('sha256').update(code.trim()).digest('hex');
  }

  /**
   * Compara de forma segura (tempo constante) o hash informado contra o hash armazenado.
   */
  public static verifyOtpHash(inputCode: string, storedHash: string): boolean {
    const inputHash = this.hashOtp(inputCode);
    const inputBuf = Buffer.from(inputHash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');

    if (inputBuf.length !== storedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(inputBuf, storedBuf);
  }

  /**
   * Registra um novo usuário no sistema.
   */
  public static async register(
    data: RegisterRequest,
    jwtSigner: (payload: { id: string; email: string; sessionId?: string }) => string,
    metadata?: { userAgent?: string; ip?: string }
  ): Promise<AuthResponse> {
    const existing = await UserModel.findOne({ email: data.email }).exec();
    if (existing) {
      throw new Error('E-mail já cadastrado.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = await UserModel.create({
      email: data.email,
      passwordHash,
      isTwoFactorEnabled: false,
    });

    // Em ambiente de desenvolvimento/teste, se houver GOOGLE_GENERATIVE_AI_API_KEY no .env, vincula automaticamente
    const defaultDevKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (defaultDevKey && !defaultDevKey.includes('sua-chave')) {
      try {
        const encrypted = CryptoService.encrypt(defaultDevKey);
        user.encryptedApiKey = encrypted.encryptedText;
        user.iv = encrypted.iv;
        user.authTag = encrypted.authTag;
        await user.save();
      } catch {
        // Ignora silenciosamente se houver falha de encriptação no seed
      }
    }

    const session = await SessionService.createSession(user._id, metadata);
    const token = jwtSigner({ id: user._id.toString(), email: user.email, sessionId: session._id });

    return {
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        hasAiKey: user.hasAiKey(),
        isTwoFactorEnabled: false,
      },
    };
  }

  /**
   * Autentica um usuário existente. Se 2FA estiver ativo, intercepta o login e emite desafio.
   */
  public static async login(
    data: LoginRequest,
    jwtSigner: (payload: { id: string; email: string; sessionId?: string }) => string,
    metadata?: { userAgent?: string; ip?: string }
  ): Promise<AuthResponse | Login2FAResponse> {
    const user = await UserModel.findOne({ email: data.email }).exec();
    if (!user) {
      throw new Error('Credenciais inválidas.');
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Credenciais inválidas.');
    }

    // Interceptação 2FA se habilitado
    if (user.isTwoFactorEnabled) {
      const otp = this.generateOtp();
      const otpHash = this.hashOtp(otp);
      const expiresAt = new Date(Date.now() + TWO_FACTOR_CONFIG.OTP_TTL_MS);

      // Invalida eventuais desafios pendentes anteriores de login para este usuário
      await TwoFactorChallengeModel.updateMany(
        { userId: user._id, type: 'LOGIN', status: 'PENDING' },
        { status: 'EXPIRED' }
      ).exec();

      const challenge = await TwoFactorChallengeModel.create({
        userId: user._id,
        type: 'LOGIN',
        otpHash,
        attempts: 0,
        maxAttempts: TWO_FACTOR_CONFIG.MAX_ATTEMPTS,
        status: 'PENDING',
        lastSentAt: new Date(),
        expiresAt,
      });

      await EmailService.sendOtpEmail(user.email, otp, 'LOGIN');

      return {
        requires2FA: true,
        challengeId: challenge._id.toString(),
        message: 'Código de verificação enviado para o seu e-mail cadastrado.',
      };
    }

    // Sem 2FA: emissão direta da sessão
    const session = await SessionService.createSession(user._id, metadata);
    const token = jwtSigner({ id: user._id.toString(), email: user.email, sessionId: session._id });

    return {
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        hasAiKey: user.hasAiKey(),
        isTwoFactorEnabled: false,
      },
    };
  }

  /**
   * Valida o desafio 2FA de login e emite o token de acesso definitivo com sessão criada.
   */
  public static async verify2FA(
    data: Verify2FARequest,
    jwtSigner: (payload: { id: string; email: string; sessionId?: string }) => string,
    metadata?: { userAgent?: string; ip?: string }
  ): Promise<AuthResponse> {
    if (!mongoose.Types.ObjectId.isValid(data.challengeId)) {
      throw new Error('ID do desafio inválido.');
    }

    const challenge = await TwoFactorChallengeModel.findById(data.challengeId).exec();
    if (!challenge || challenge.type !== 'LOGIN') {
      throw new Error('Desafio 2FA expirado ou inválido. Realize login novamente.');
    }

    if (challenge.status === 'LOCKED') {
      throw new Error('Desafio bloqueado por excesso de tentativas. Realize login novamente.');
    }

    if (challenge.status === 'EXPIRED' || challenge.expiresAt.getTime() <= Date.now()) {
      challenge.status = 'EXPIRED';
      await challenge.save();
      throw new Error('Código de verificação expirado. Solicite um novo código.');
    }

    if (challenge.status !== 'PENDING') {
      throw new Error('Desafio 2FA já utilizado ou inválido.');
    }

    const isValid = this.verifyOtpHash(data.code, challenge.otpHash);
    if (!isValid) {
      challenge.attempts += 1;
      if (challenge.attempts >= challenge.maxAttempts) {
        challenge.status = 'LOCKED';
        await challenge.save();
        throw new Error('Desafio bloqueado após 5 tentativas incorretas. Realize login novamente.');
      }
      await challenge.save();
      const remaining = challenge.maxAttempts - challenge.attempts;
      throw new Error(`Código de verificação incorreto. Tentativas restantes: ${remaining}`);
    }

    // Marca como verificado (single-use)
    challenge.status = 'VERIFIED';
    challenge.verifiedAt = new Date();
    await challenge.save();

    const user = await UserModel.findById(challenge.userId).exec();
    if (!user) {
      throw new Error('Usuário associado ao desafio não encontrado.');
    }

    const session = await SessionService.createSession(user._id, metadata);
    const token = jwtSigner({ id: user._id.toString(), email: user.email, sessionId: session._id });

    return {
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        hasAiKey: user.hasAiKey(),
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      },
    };
  }

  /**
   * Reenvia um novo código OTP para um desafio aberto, respeitando o cooldown de 60s.
   */
  public static async resendOtp(challengeId: string): Promise<{ success: boolean; message: string }> {
    if (!mongoose.Types.ObjectId.isValid(challengeId)) {
      throw new Error('ID do desafio inválido.');
    }

    const challenge = await TwoFactorChallengeModel.findById(challengeId).exec();
    if (!challenge || challenge.status !== 'PENDING') {
      throw new Error('Desafio 2FA expirado ou inválido. Inicie o fluxo novamente.');
    }

    const now = Date.now();
    const elapsedMs = now - challenge.lastSentAt.getTime();
    if (elapsedMs < TWO_FACTOR_CONFIG.RESEND_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil(
        (TWO_FACTOR_CONFIG.RESEND_COOLDOWN_MS - elapsedMs) / 1000
      );
      throw new ResendCooldownError(
        `Aguarde ${remainingSeconds} segundos antes de solicitar um novo código.`,
        remainingSeconds
      );
    }

    const user = await UserModel.findById(challenge.userId).exec();
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    const newOtp = this.generateOtp();
    challenge.otpHash = this.hashOtp(newOtp);
    challenge.lastSentAt = new Date();
    challenge.attempts = 0; // Reinicia contador de tentativas para o novo código
    challenge.expiresAt = new Date(now + TWO_FACTOR_CONFIG.OTP_TTL_MS);
    await challenge.save();

    await EmailService.sendOtpEmail(user.email, newOtp, challenge.type);

    return {
      success: true,
      message: 'Novo código de verificação enviado com sucesso para o seu e-mail.',
    };
  }

  /**
   * Inicia o fluxo de ativação do 2FA para o usuário autenticado.
   */
  public static async initiateEnable2FA(
    userId: string
  ): Promise<{ challengeId: string; message: string }> {
    const user = await UserModel.findById(userId).exec();
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    if (user.isTwoFactorEnabled) {
      throw new Error('A autenticação em dois fatores já está ativada.');
    }

    // Invalida eventuais desafios anteriores de ENABLE
    await TwoFactorChallengeModel.updateMany(
      { userId: user._id, type: 'ENABLE', status: 'PENDING' },
      { status: 'EXPIRED' }
    ).exec();

    const otp = this.generateOtp();
    const otpHash = this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + TWO_FACTOR_CONFIG.OTP_TTL_MS);

    const challenge = await TwoFactorChallengeModel.create({
      userId: user._id,
      type: 'ENABLE',
      otpHash,
      attempts: 0,
      maxAttempts: TWO_FACTOR_CONFIG.MAX_ATTEMPTS,
      status: 'PENDING',
      lastSentAt: new Date(),
      expiresAt,
    });

    await EmailService.sendOtpEmail(user.email, otp, 'ENABLE');

    return {
      challengeId: challenge._id.toString(),
      message: 'Código de confirmação enviado para seu e-mail.',
    };
  }

  /**
   * Confirma a ativação do 2FA validando o código de teste recebido.
   */
  public static async confirmEnable2FA(
    userId: string,
    data: Verify2FARequest
  ): Promise<{ success: boolean; isTwoFactorEnabled: boolean; message: string }> {
    if (!mongoose.Types.ObjectId.isValid(data.challengeId)) {
      throw new Error('ID do desafio inválido.');
    }

    const challenge = await TwoFactorChallengeModel.findById(data.challengeId).exec();
    if (!challenge || challenge.type !== 'ENABLE' || challenge.userId.toString() !== userId) {
      throw new Error('Desafio de ativação expirado ou inválido.');
    }

    if (challenge.status === 'LOCKED') {
      throw new Error('Desafio bloqueado por excesso de tentativas.');
    }

    if (challenge.status === 'EXPIRED' || challenge.expiresAt.getTime() <= Date.now()) {
      challenge.status = 'EXPIRED';
      await challenge.save();
      throw new Error('Código expirado. Solicite a ativação novamente.');
    }

    const isValid = this.verifyOtpHash(data.code, challenge.otpHash);
    if (!isValid) {
      challenge.attempts += 1;
      if (challenge.attempts >= challenge.maxAttempts) {
        challenge.status = 'LOCKED';
        await challenge.save();
        throw new Error('Desafio bloqueado após 5 tentativas incorretas.');
      }
      await challenge.save();
      const remaining = challenge.maxAttempts - challenge.attempts;
      throw new Error(`Código de verificação incorreto. Tentativas restantes: ${remaining}`);
    }

    challenge.status = 'VERIFIED';
    challenge.verifiedAt = new Date();
    await challenge.save();

    await UserModel.findByIdAndUpdate(userId, {
      isTwoFactorEnabled: true,
      twoFactorConfirmedAt: new Date(),
    }).exec();

    return {
      success: true,
      isTwoFactorEnabled: true,
      message: 'Autenticação em dois fatores ativada com sucesso.',
    };
  }

  /**
   * Desativa a autenticação em dois fatores mediante confirmação de senha.
   */
  public static async disable2FA(
    userId: string,
    data: Disable2FARequest
  ): Promise<{ success: boolean; isTwoFactorEnabled: boolean; message: string }> {
    const user = await UserModel.findById(userId).exec();
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Senha incorreta. Não foi possível desativar o 2FA.');
    }

    user.isTwoFactorEnabled = false;
    user.twoFactorConfirmedAt = null;
    await user.save();

    return {
      success: true,
      isTwoFactorEnabled: false,
      message: 'Autenticação em dois fatores desativada com sucesso.',
    };
  }

  /**
   * Valida ativamente a chave do Gemini do usuário e armazena criptografada com AES-256-GCM.
   */
  public static async setApiKey(userId: string, apiKey: string): Promise<KeyValidationResult> {
    const validation = await GeminiService.validateApiKey(apiKey);
    const encrypted = CryptoService.encrypt(apiKey);

    const updated = await UserModel.findByIdAndUpdate(
      userId,
      {
        encryptedApiKey: encrypted.encryptedText,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      },
      { new: true }
    ).exec();

    if (!updated) {
      throw new Error('Usuário não encontrado.');
    }

    return validation;
  }

  /**
   * Recupera e descriptografa efemeramente a chave BYOK do usuário para uso na requisição.
   */
  public static async getDecryptedApiKey(userId: string): Promise<string> {
    const user = await UserModel.findById(userId).exec();
    if (!user || !user.encryptedApiKey || !user.iv || !user.authTag) {
      throw new Error('Chave de API do Gemini não configurada para este usuário.');
    }

    return CryptoService.decrypt(user.encryptedApiKey, user.iv, user.authTag);
  }
}
