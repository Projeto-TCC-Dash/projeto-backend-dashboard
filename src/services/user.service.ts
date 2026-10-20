import mongoose from 'mongoose';
import { UserModel } from '../models/user.model.js';
import { AnalysisService } from './analysis.service.js';
import {
  UpdateFinancialProfileRequest,
  UserProfileResponse,
} from '../schemas/user.schemas.js';

export class UserNotFoundError extends Error {
  public statusCode = 404;

  constructor(message = 'Usuário não encontrado.') {
    super(message);
    this.name = 'UserNotFoundError';
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
      hasAiKey: user.hasAiKey(),
      financialProfile: user.financialProfile
        ? {
            incomeType: user.financialProfile.incomeType,
            declaredMonthlyIncome: user.financialProfile.declaredMonthlyIncome,
            goals: user.financialProfile.goals,
            riskProfile: user.financialProfile.riskProfile,
            updatedAt: user.financialProfile.updatedAt,
          }
        : undefined,
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

    return {
      id: user._id.toString(),
      email: user.email,
      hasAiKey: user.hasAiKey(),
      financialProfile: {
        incomeType: user.financialProfile.incomeType,
        declaredMonthlyIncome: user.financialProfile.declaredMonthlyIncome,
        goals: user.financialProfile.goals,
        riskProfile: user.financialProfile.riskProfile,
        updatedAt: user.financialProfile.updatedAt,
      },
    };
  }
}
