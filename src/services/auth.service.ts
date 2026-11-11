import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { UserModel } from '../models/user.model.js';
import {
  AuthResponse,
  GoogleLinkResponse,
  GoogleUnlinkResponse,
  LoginRequest,
  RegisterRequest,
} from '../schemas/auth.schemas.js';
import { CryptoService } from './crypto.service.js';
import { GeminiService, KeyValidationResult } from './gemini.service.js';
import { GoogleOAuthService, InvalidGoogleTokenError } from './google-auth.service.js';
import { SessionService } from './session.service.js';
import { UserService } from './user.service.js';
import { env } from '../config/env.js';

export class GoogleAccountConflictError extends Error {
  public statusCode = 409;
  constructor(message = 'Esta conta Google já está vinculada a outro perfil cadastrado.') {
    super(message);
    this.name = 'GoogleAccountConflictError';
  }
}

export class GoogleAccountNotLinkedError extends Error {
  public statusCode = 400;
  constructor(message = 'Nenhuma conta Google vinculada a este perfil.') {
    super(message);
    this.name = 'GoogleAccountNotLinkedError';
  }
}

export class CannotUnlinkGoogleWithoutPasswordError extends Error {
  public statusCode = 400;
  constructor(
    message = 'Não é possível desvincular a conta Google pois ela é o único método de autenticação da conta. Cadastre uma senha antes de desvincular.'
  ) {
    super(message);
    this.name = 'CannotUnlinkGoogleWithoutPasswordError';
  }
}

export class GoogleUserNotFoundError extends Error {
  public statusCode = 401;
  constructor(
    message = 'Nenhuma conta vinculada a este perfil Google. Faça login com suas credenciais para vincular.'
  ) {
    super(message);
    this.name = 'GoogleUserNotFoundError';
  }
}

export class AuthService {

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
      },
    };
  }

  /**
   * Autentica um usuário existente com e-mail e senha.
   */
  public static async login(
    data: LoginRequest,
    jwtSigner: (payload: { id: string; email: string; sessionId?: string }) => string,
    metadata?: { userAgent?: string; ip?: string }
  ): Promise<AuthResponse> {
    const user = await UserModel.findOne({ email: data.email }).exec();
    if (!user) {
      throw new Error('Credenciais inválidas.');
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Credenciais inválidas.');
    }

    const session = await SessionService.createSession(user._id, metadata);
    const token = jwtSigner({ id: user._id.toString(), email: user.email, sessionId: session._id });

    return {
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        hasAiKey: user.hasAiKey(),
      },
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

  /**
   * Vincula a conta Google ao usuário autenticado após validar o idToken
   * Em ambiente de desenvolvimento, permite simulação quando nenhum token for enviado.
   */
  public static async linkGoogleAccount(
    userId: string,
    idToken?: string
  ): Promise<GoogleLinkResponse> {
    const user = await UserModel.findById(userId).exec();
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    let googleId: string;
    let googleEmail: string;

    if (idToken) {
      const payload = await GoogleOAuthService.verifyIdToken(idToken);
      googleId = payload.googleId;
      googleEmail = payload.googleEmail;
    } else {
      const isProd = (process.env.NODE_ENV ?? env.NODE_ENV) === 'production';
      if (isProd) {
        throw new InvalidGoogleTokenError('O token do Google é obrigatório em ambiente de produção.');
      }
      // Ambiente de desenvolvimento: gera vínculo de simulação seguro com o e-mail do próprio usuário
      googleId = user.googleAccount?.googleId || `google_dev_${user._id.toString()}`;
      googleEmail = user.email;
    }

    const existingWithGoogle = await UserModel.findOne({
      'googleAccount.googleId': googleId,
      _id: { $ne: new mongoose.Types.ObjectId(userId) },
    }).exec();

    if (existingWithGoogle) {
      throw new GoogleAccountConflictError(
        'Esta conta Google já está vinculada a outro perfil cadastrado.'
      );
    }

    const linkedAt = new Date();
    user.googleAccount = {
      googleId,
      googleEmail,
      linkedAt,
    };

    await user.save();

    const profile = await UserService.getProfile(userId);

    return {
      ...profile,
      success: true,
      message: 'Conta Google vinculada com sucesso.',
      googleAccount: {
        googleEmail,
        linkedAt,
      },
    };
  }

  /**
   * Desvincula a conta Google com validação de guarda contra lock-out (exige senha local)
   */
  public static async unlinkGoogleAccount(userId: string): Promise<GoogleUnlinkResponse> {
    const user = await UserModel.findById(userId).exec();
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    if (!user.googleAccount?.googleId) {
      throw new GoogleAccountNotLinkedError('Nenhuma conta Google vinculada a este perfil.');
    }

    const hasLocalPassword = Boolean(user.passwordHash && user.passwordHash.length > 0);
    if (!hasLocalPassword) {
      throw new CannotUnlinkGoogleWithoutPasswordError(
        'Não é possível desvincular a conta Google pois ela é o único método de autenticação da conta. Cadastre uma senha antes de desvincular.'
      );
    }

    user.googleAccount = null;
    await user.save();

    const profile = await UserService.getProfile(userId);

    return {
      ...profile,
      success: true,
      message: 'Conta Google desvinculada com sucesso.',
    };
  }

  /**
   * Autentica usuário via Google para contas previamente vinculadas.
   */
  public static async loginWithGoogle(
    idToken: string,
    jwtSigner: (payload: { id: string; email: string; sessionId?: string }) => string,
    metadata?: { userAgent?: string; ip?: string }
  ): Promise<AuthResponse> {
    const payload = await GoogleOAuthService.verifyIdToken(idToken);

    const user = await UserModel.findOne({
      'googleAccount.googleId': payload.googleId,
    }).exec();

    if (!user) {
      throw new GoogleUserNotFoundError(
        'Nenhuma conta vinculada a este perfil Google. Faça login com suas credenciais para vincular.'
      );
    }

    const session = await SessionService.createSession(user._id, metadata);
    const token = jwtSigner({ id: user._id.toString(), email: user.email, sessionId: session._id });

    return {
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        hasAiKey: user.hasAiKey(),
      },
    };
  }
}
