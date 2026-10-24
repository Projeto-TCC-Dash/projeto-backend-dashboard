import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { AVATAR_CONFIG } from '../config/constants.js';
import { UserModel } from '../models/user.model.js';
import { AnalysisService } from './analysis.service.js';
import {
  UpdateFinancialProfileRequest,
  UserAvatarResponse,
  UserProfileResponse,
} from '../schemas/user.schemas.js';

export class UserNotFoundError extends Error {
  public statusCode = 404;

  constructor(message = 'Usuário não encontrado.') {
    super(message);
    this.name = 'UserNotFoundError';
  }
}

export class InvalidAvatarFileError extends Error {
  public statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'InvalidAvatarFileError';
  }
}

export class UserService {
  /**
   * Obtém os dados cadastrais básicos e perfil financeiro do usuário
   */
  public static async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      hasAiKey: user.hasAiKey(),
      security: {
        twoFactorEnabled: false,
        hasLocalPassword: Boolean(user.passwordHash),
        googleLinked: false,
      },
      financialProfile: user.financialProfile?.incomeType ||
        user.financialProfile?.declaredMonthlyIncome !== undefined ||
        user.financialProfile?.goals?.length
        ? {
            incomeType: user.financialProfile.incomeType,
            declaredMonthlyIncome: user.financialProfile.declaredMonthlyIncome,
            goals: user.financialProfile.goals,
            riskProfile: user.financialProfile.riskProfile,
            updatedAt: user.financialProfile.updatedAt,
          }
        : undefined,
      createdAt: user.createdAt,
    };
  }

  /**
   * Atualiza os campos voluntários do perfil financeiro e invalida o cache de análises
   */
  public static async updateFinancialProfile(
    userId: string,
    updateData: UpdateFinancialProfileRequest
  ): Promise<UserProfileResponse> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (!user.financialProfile) {
      user.financialProfile = {};
    }

    if (updateData.incomeType !== undefined) {
      user.financialProfile.incomeType = updateData.incomeType;
    }
    if (updateData.declaredMonthlyIncome !== undefined) {
      user.financialProfile.declaredMonthlyIncome = updateData.declaredMonthlyIncome;
    }
    if (updateData.goals !== undefined) {
      user.financialProfile.goals = updateData.goals;
    }
    if (updateData.riskProfile !== undefined) {
      user.financialProfile.riskProfile = updateData.riskProfile;
    }
    user.financialProfile.updatedAt = new Date();

    await user.save();

    // Invalida cache de análises mensais para forçar recalibração com os novos dados
    await AnalysisService.invalidate(userId);

    return this.getProfile(userId);
  }

  /**
   * Atualiza o nome de exibição do usuário
   */
  public static async updateProfileName(
    userId: string,
    name?: string
  ): Promise<UserProfileResponse> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (name !== undefined) {
      user.name = name;
    }

    await user.save();
    return this.getProfile(userId);
  }

  /**
   * Processa upload do arquivo de imagem do avatar, armazena no disco e atualiza o usuário
   */
  public static async uploadAvatar(
    userId: string,
    file: { buffer: Buffer; mimetype: string; filename: string }
  ): Promise<UserAvatarResponse> {
    const allowedMimes = AVATAR_CONFIG.ALLOWED_MIME_TYPES as readonly string[];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new InvalidAvatarFileError(
        'Formato de imagem não suportado. Formatos aceitos: JPG, PNG e WebP.'
      );
    }

    if (file.buffer.length > AVATAR_CONFIG.MAX_SIZE_BYTES) {
      throw new InvalidAvatarFileError('Arquivo excede o tamanho máximo permitido de 5MB.');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const uploadDir = path.join(process.cwd(), AVATAR_CONFIG.UPLOAD_DIR);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    let ext = '.png';
    if (file.mimetype === 'image/jpeg') ext = '.jpg';
    else if (file.mimetype === 'image/webp') ext = '.webp';

    const filename = `${userId}-${Date.now()}${ext}`;
    const targetPath = path.join(uploadDir, filename);

    // Remove avatar antigo do disco se existir
    if (user.avatarUrl && user.avatarUrl.startsWith(AVATAR_CONFIG.URL_PREFIX)) {
      const oldFilename = path.basename(user.avatarUrl);
      const oldPath = path.join(uploadDir, oldFilename);
      await fs.promises.unlink(oldPath).catch(() => {});
    }

    await fs.promises.writeFile(targetPath, file.buffer);

    user.avatarUrl = `${AVATAR_CONFIG.URL_PREFIX}/${filename}`;
    await user.save();

    return {
      success: true,
      message: 'Avatar atualizado com sucesso',
      avatarUrl: user.avatarUrl,
    };
  }

  /**
   * Remove o avatar do usuário e exclui o arquivo físico correspondente
   */
  public static async deleteAvatar(userId: string): Promise<UserAvatarResponse> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (user.avatarUrl && user.avatarUrl.startsWith(AVATAR_CONFIG.URL_PREFIX)) {
      const uploadDir = path.join(process.cwd(), AVATAR_CONFIG.UPLOAD_DIR);
      const oldFilename = path.basename(user.avatarUrl);
      const oldPath = path.join(uploadDir, oldFilename);
      await fs.promises.unlink(oldPath).catch(() => {});
    }

    user.avatarUrl = null;
    await user.save();

    return {
      success: true,
      message: 'Avatar removido com sucesso',
      avatarUrl: null,
    };
  }
}
