import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountModel } from '../../src/models/account.model.js';
import { InvestmentHoldingModel } from '../../src/models/investment-holding.model.js';
import { UserModel } from '../../src/models/user.model.js';
import { InvestmentService } from '../../src/services/investment.service.js';

describe('InvestmentService Unit Tests', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const accountId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPortfolioSummary', () => {
    it('deve calcular corretamente a alocação e diagnosticar aderência ao perfil de risco Conservador', async () => {
      const mockHoldings: any[] = [
        { macroClass: 'FIXED_INCOME', amount: 70000 },
        { macroClass: 'CASH_LIQUIDITY', amount: 20000 },
        { macroClass: 'EQUITIES', amount: 10000 },
      ];

      vi.spyOn(InvestmentHoldingModel, 'find').mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockHoldings),
      } as any);

      vi.spyOn(UserModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          financialProfile: {
            riskProfile: 'CONSERVATIVE',
            goals: ['RESERVA_EMERGENCIA'],
          },
        }),
      } as any);

      const summary = await InvestmentService.getPortfolioSummary(userId);

      expect(summary.totalInvested).toBe(100000);
      expect(summary.riskProfile).toBe('CONSERVATIVE');

      const fixed = summary.holdings.find((h) => h.macroClass === 'FIXED_INCOME');
      expect(fixed?.percentage).toBe(70);

      const liquidity = summary.holdings.find((h) => h.macroClass === 'CASH_LIQUIDITY');
      expect(liquidity?.percentage).toBe(20);

      const equities = summary.holdings.find((h) => h.macroClass === 'EQUITIES');
      expect(equities?.percentage).toBe(10);

      expect(summary.allocationDiagnosis.adherentToRiskProfile).toBe(true);
      expect(summary.allocationDiagnosis.recommendations[0]).toContain('condizente');
    });

    it('deve alertar sobre desvio de risco se perfil Conservador tiver mais de 20% em voláteis', async () => {
      const mockHoldings: any[] = [
        { macroClass: 'FIXED_INCOME', amount: 50000 },
        { macroClass: 'EQUITIES', amount: 30000 },
        { macroClass: 'CRYPTO', amount: 20000 },
      ];

      vi.spyOn(InvestmentHoldingModel, 'find').mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockHoldings),
      } as any);

      vi.spyOn(UserModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          financialProfile: {
            riskProfile: 'CONSERVATIVE',
          },
        }),
      } as any);

      const summary = await InvestmentService.getPortfolioSummary(userId);

      expect(summary.allocationDiagnosis.adherentToRiskProfile).toBe(false);
      expect(summary.allocationDiagnosis.recommendations[0]).toContain('acima do recomendado');
    });
  });

  describe('upsertHolding', () => {
    it('deve retornar null se a conta informada não existir ou não pertencer ao usuário', async () => {
      vi.spyOn(AccountModel, 'findOne').mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      } as any);

      const result = await InvestmentService.upsertHolding(userId, {
        accountId,
        macroClass: 'FIXED_INCOME',
        amount: 10000,
      });

      expect(result).toBeNull();
    });

    it('deve atualizar a posição de investimento e retornar o portfólio consolidado', async () => {
      vi.spyOn(AccountModel, 'findOne').mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: new mongoose.Types.ObjectId(accountId) }),
      } as any);

      vi.spyOn(InvestmentHoldingModel, 'findOneAndUpdate').mockReturnValue({
        exec: vi.fn().mockResolvedValue(true),
      } as any);

      vi.spyOn(InvestmentHoldingModel, 'find').mockReturnValue({
        exec: vi.fn().mockResolvedValue([{ macroClass: 'FIXED_INCOME', amount: 15000 }]),
      } as any);

      vi.spyOn(UserModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue({ financialProfile: {} }),
      } as any);

      const result = await InvestmentService.upsertHolding(userId, {
        accountId,
        macroClass: 'FIXED_INCOME',
        amount: 15000,
      });

      expect(result).toBeDefined();
      expect(result?.totalInvested).toBe(15000);
    });
  });
});
