import { describe, expect, it, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { UserModel } from '../../src/models/user.model.js';
import { AnalysisService } from '../../src/services/analysis.service.js';
import { UserService, UserNotFoundError } from '../../src/services/user.service.js';

describe('UserService - Unit Tests', () => {
  const mockUserId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getProfile', () => {
    it('deve retornar o perfil do usuário incluindo financialProfile e hasAiKey', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(mockUserId),
        email: 'investidor@teste.com',
        encryptedApiKey: 'encrypted_key',
        hasAiKey: () => true,
        financialProfile: {
          incomeType: 'PJ_AUTONOMO',
          declaredMonthlyIncome: 12000,
          goals: ['RESERVA_EMERGENCIA', 'INVESTIR_LONGO_PRAZO'],
          riskProfile: 'MODERATE',
          updatedAt: new Date('2026-10-19T20:00:00Z'),
        },
      };

      vi.spyOn(UserModel, 'findById').mockResolvedValueOnce(mockUser as any);

      const profile = await UserService.getProfile(mockUserId);

      expect(profile).toEqual({
        id: mockUserId,
        email: 'investidor@teste.com',
        hasAiKey: true,
        financialProfile: {
          incomeType: 'PJ_AUTONOMO',
          declaredMonthlyIncome: 12000,
          goals: ['RESERVA_EMERGENCIA', 'INVESTIR_LONGO_PRAZO'],
          riskProfile: 'MODERATE',
          updatedAt: new Date('2026-10-19T20:00:00Z'),
        },
      });
      expect(UserModel.findById).toHaveBeenCalledWith(mockUserId);
    });

    it('deve lançar UserNotFoundError se o usuário não for encontrado', async () => {
      vi.spyOn(UserModel, 'findById').mockResolvedValueOnce(null);

      await expect(UserService.getProfile(mockUserId)).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('updateFinancialProfile', () => {
    it('deve atualizar o financialProfile, definir updatedAt e invalidar cache de análises', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(mockUserId),
        email: 'investidor@teste.com',
        hasAiKey: () => false,
        financialProfile: {
          incomeType: 'CLT',
          declaredMonthlyIncome: 5000,
          goals: ['RESERVA_EMERGENCIA'],
          riskProfile: 'CONSERVATIVE',
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
        save: vi.fn().mockImplementation(async function () {
          return mockUser;
        }),
      };

      vi.spyOn(UserModel, 'findById').mockResolvedValueOnce(mockUser as any);
      const invalidateSpy = vi.spyOn(AnalysisService, 'invalidate').mockResolvedValueOnce(2);

      const updatePayload = {
        incomeType: 'PJ_AUTONOMO' as const,
        declaredMonthlyIncome: 10000,
        goals: ['RESERVA_EMERGENCIA' as const, 'QUITAR_DIVIDAS' as const],
        riskProfile: 'MODERATE' as const,
      };

      const result = await UserService.updateFinancialProfile(mockUserId, updatePayload);

      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.financialProfile.incomeType).toBe('PJ_AUTONOMO');
      expect(mockUser.financialProfile.declaredMonthlyIncome).toBe(10000);
      expect(mockUser.financialProfile.goals).toEqual(['RESERVA_EMERGENCIA', 'QUITAR_DIVIDAS']);
      expect(mockUser.financialProfile.riskProfile).toBe('MODERATE');
      expect(mockUser.financialProfile.updatedAt).toBeInstanceOf(Date);
      expect(invalidateSpy).toHaveBeenCalledWith(mockUserId);
      expect(result.id).toBe(mockUserId);
    });

    it('deve lançar UserNotFoundError se o usuário a ser atualizado não existir', async () => {
      vi.spyOn(UserModel, 'findById').mockResolvedValueOnce(null);

      await expect(
        UserService.updateFinancialProfile(mockUserId, { incomeType: 'CLT' })
      ).rejects.toThrow(UserNotFoundError);
    });
  });
});
