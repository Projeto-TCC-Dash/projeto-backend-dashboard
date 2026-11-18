import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetPlanModel } from '../../src/models/budget.model.js';
import { TransactionModel } from '../../src/models/transaction.model.js';
import { BudgetNotFoundError, BudgetService } from '../../src/services/budget.service.js';

describe('BudgetService Unit Tests', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const month = '2026-11';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBudgetOverview', () => {
    it('deve lançar BudgetNotFoundError se nenhum orçamento for encontrado para o mês', async () => {
      vi.spyOn(BudgetPlanModel, 'findOne').mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      } as any);

      await expect(BudgetService.getBudgetOverview(userId, month)).rejects.toThrow(
        BudgetNotFoundError
      );
    });

    it('deve calcular corretamente consumo, saldo restante e status REGULAR, WARNING e EXCEEDED', async () => {
      const mockBudget: any = {
        userId: new mongoose.Types.ObjectId(userId),
        month,
        totalLimitAmount: 5000,
        categoryBudgets: [
          { category: 'Alimentação', limitAmount: 1500 }, // gastou 1200 (80% -> WARNING)
          { category: 'Lazer', limitAmount: 500 },        // gastou 600 (120% -> EXCEEDED)
          { category: 'Transporte', limitAmount: 1000 },  // gastou 400 (40% -> REGULAR)
        ],
      };

      vi.spyOn(BudgetPlanModel, 'findOne').mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockBudget),
      } as any);

      const mockTxs: any[] = [
        { amount: -1200, category: 'Alimentação' },
        { amount: -600, category: 'Lazer' },
        { amount: -400, category: 'Transporte' },
        { amount: -800, category: 'Pagamento de Fatura' }, // Deve ser ignorado de despesas operacionais
        { amount: 3000, category: 'Receita' },             // Receita não é despesa
      ];

      vi.spyOn(TransactionModel, 'find').mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTxs),
      } as any);

      const overview = await BudgetService.getBudgetOverview(userId, month);

      expect(overview.month).toBe(month);
      expect(overview.totalLimitAmount).toBe(5000);
      expect(overview.totalSpentAmount).toBe(2200); // 1200 + 600 + 400
      expect(overview.totalRemainingAmount).toBe(2800);
      expect(overview.globalPercentConsumed).toBe(44);
      expect(overview.globalStatus).toBe('REGULAR');

      const food = overview.categories.find((c) => c.category === 'Alimentação');
      expect(food?.spentAmount).toBe(1200);
      expect(food?.percentConsumed).toBe(80);
      expect(food?.status).toBe('WARNING');

      const leisure = overview.categories.find((c) => c.category === 'Lazer');
      expect(leisure?.spentAmount).toBe(600);
      expect(leisure?.percentConsumed).toBe(120);
      expect(leisure?.status).toBe('EXCEEDED');

      const transport = overview.categories.find((c) => c.category === 'Transporte');
      expect(transport?.spentAmount).toBe(400);
      expect(transport?.percentConsumed).toBe(40);
      expect(transport?.status).toBe('REGULAR');
    });
  });

  describe('upsertBudgetPlan', () => {
    it('deve realizar upsert no banco e retornar o overview atualizado', async () => {
      const mockBudget: any = {
        userId: new mongoose.Types.ObjectId(userId),
        month,
        totalLimitAmount: 3000,
        categoryBudgets: [{ category: 'Alimentação', limitAmount: 3000 }],
      };

      vi.spyOn(BudgetPlanModel, 'findOneAndUpdate').mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockBudget),
      } as any);

      vi.spyOn(BudgetPlanModel, 'findOne').mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockBudget),
      } as any);

      vi.spyOn(TransactionModel, 'find').mockReturnValue({
        exec: vi.fn().mockResolvedValue([]),
      } as any);

      const result = await BudgetService.upsertBudgetPlan(userId, month, {
        totalLimitAmount: 3000,
        categoryBudgets: [{ category: 'Alimentação', limitAmount: 3000 }],
      });

      expect(result.totalLimitAmount).toBe(3000);
      expect(result.categories).toHaveLength(1);
    });
  });
});
