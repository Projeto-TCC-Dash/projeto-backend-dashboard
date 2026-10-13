import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import { UserModel } from '../models/user.model.js';
import { AuthResponse, RegisterRequest } from '../schemas/auth.schemas.js';
import { CryptoService } from './crypto.service.js';
import { GeminiService } from './gemini.service.js';

export class AuthService {
  /**
   * Registra um novo usuário no sistema.
   */
  public static async register(
    data: RegisterRequest,
    jwtSigner: (payload: { id: string; email: string }) => string
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

    const token = jwtSigner({ id: user._id.toString(), email: user.email });

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
   * Autentica um usuário existente.
   */
  public static async login(
    data: RegisterRequest,
    jwtSigner: (payload: { id: string; email: string }) => string
  ): Promise<AuthResponse> {
    const user = await UserModel.findOne({ email: data.email }).exec();
    if (!user) {
      throw new Error('Credenciais inválidas.');
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Credenciais inválidas.');
    }

    const token = jwtSigner({ id: user._id.toString(), email: user.email });

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
  public static async setApiKey(userId: string, apiKey: string): Promise<void> {
    // 1. Validação ativa disparando um ping no Google AI Studio
    await GeminiService.validateApiKey(apiKey);

    // 2. Criptografia AES-256-GCM
    const encrypted = CryptoService.encrypt(apiKey);

    // 3. Persistência no MongoDB
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
