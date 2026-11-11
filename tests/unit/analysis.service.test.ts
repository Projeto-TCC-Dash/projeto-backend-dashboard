import { describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { FinancialAnalysisModel } from '../../src/models/analysis.model.js';
import { AnalysisService } from '../../src/services/analysis.service.js';

describe('AnalysisService - Unit Tests', () => {
  const baseTransactions = [
    {
      amount: 5000,
      date: new Date('2026-10-05T10:00:00Z'),
      category: 'Outros',
    },
    {
      amount: -1200,
      date: new Date('2026-10-10T12:00:00Z'),
      category: 'Alimentação',
    },
    {
      amount: -800,
      date: new Date('2026-10-15T14:00:00Z'),
      category: 'Transporte',
    },
  ];

  describe('calculateStateHash', () => {
    it('deve gerar o mesmo hash determinístico para o mesmo conjunto de transações', () => {
      const hash1 = AnalysisService.calculateStateHash(baseTransactions);
      const hash2 = AnalysisService.calculateStateHash(baseTransactions);

      expect(hash1).toBeDefined();
      expect(hash1).toHaveLength(64); // SHA-256 em hex
      expect(hash1).toBe(hash2);
    });

    it('deve gerar hashes diferentes quando o valor de uma transação for alterado', () => {
      const hashOriginal = AnalysisService.calculateStateHash(baseTransactions);

      const modified = [
        ...baseTransactions.slice(0, 2),
        {
          amount: -950, // alterado de -800 para -950
          date: new Date('2026-10-15T14:00:00Z'),
          category: 'Transporte',
        },
      ];
      const hashModified = AnalysisService.calculateStateHash(modified);

      expect(hashModified).not.toBe(hashOriginal);
    });

    it('deve gerar hashes diferentes quando uma nova transação for adicionada', () => {
      const hashOriginal = AnalysisService.calculateStateHash(baseTransactions);

      const added = [
        ...baseTransactions,
        {
          amount: -50,
          date: new Date('2026-10-20T18:00:00Z'),
          category: 'Lazer',
        },
      ];
      const hashAdded = AnalysisService.calculateStateHash(added);

      expect(hashAdded).not.toBe(hashOriginal);
    });

    it('deve gerar hashes diferentes quando a categoria for reclassificada', () => {
      const hashOriginal = AnalysisService.calculateStateHash(baseTransactions);

      const recategorized = [
        baseTransactions[0]!,
        {
          amount: -1200,
          date: new Date('2026-10-10T12:00:00Z'),
          category: 'Saúde', // alterado de Alimentação para Saúde
        },
        baseTransactions[2]!,
      ];
      const hashRecategorized = AnalysisService.calculateStateHash(recategorized);

      expect(hashRecategorized).not.toBe(hashOriginal);
    });

    it('deve retornar hash consistente para lista vazia', () => {
      const hashEmpty1 = AnalysisService.calculateStateHash([]);
      const hashEmpty2 = AnalysisService.calculateStateHash([]);

      expect(hashEmpty1).toHaveLength(64);
      expect(hashEmpty1).toBe(hashEmpty2);
    });
  });

  describe('calculateMetrics', () => {
    it('deve calcular corretamente receitas, despesas, saldo e taxa de poupança', () => {
      const metrics = AnalysisService.calculateMetrics(baseTransactions);

      expect(metrics.totalIncome).toBe(5000);
      expect(metrics.totalExpenses).toBe(2000);
      expect(metrics.netBalance).toBe(3000);
      // savingsRate = (3000 / 5000) * 100 = 60.0%
      expect(metrics.savingsRate).toBe(60);
      expect(metrics.topCategories).toHaveLength(2);
      expect(metrics.topCategories[0]).toEqual({
        category: 'Alimentação',
        amount: 1200,
        percentage: 60,
      });
      expect(metrics.topCategories[1]).toEqual({
        category: 'Transporte',
        amount: 800,
        percentage: 40,
      });
    });

    it('deve segregar transações de Pagamento de Fatura sem duplicar despesas primárias e sem poluir topCategories', () => {
      const transactionsWithInvoice = [
        { amount: 5000, category: 'Receita' },
        { amount: -1000, category: 'Alimentação' },
        { amount: -500, category: 'Lazer' },
        { amount: -1500, category: 'Pagamento de Fatura' },
      ];

      const metrics = AnalysisService.calculateMetrics(transactionsWithInvoice);

      expect(metrics.totalIncome).toBe(5000);
      expect(metrics.totalExpenses).toBe(1500); // 1000 + 500 (NÃO 3000!)
      expect(metrics.invoiceSettlements).toBe(1500);
      expect(metrics.netBalance).toBe(3500);
      // savingsRate = (3500 / 5000) * 100 = 70.0%
      expect(metrics.savingsRate).toBe(70);
      expect(metrics.topCategories).toHaveLength(2);
      expect(metrics.topCategories[0]).toEqual({
        category: 'Alimentação',
        amount: 1000,
        percentage: 66.7,
      });
      expect(metrics.topCategories[1]).toEqual({
        category: 'Lazer',
        amount: 500,
        percentage: 33.3,
      });
      expect(metrics.topCategories.some((c) => c.category === 'Pagamento de Fatura')).toBe(false);
    });

    it('deve tratar meses sem receitas sem gerar divisão por zero', () => {
      const noIncome = [
        { amount: -500, category: 'Alimentação' },
        { amount: -200, category: 'Lazer' },
      ];
      const metrics = AnalysisService.calculateMetrics(noIncome);

      expect(metrics.totalIncome).toBe(0);
      expect(metrics.totalExpenses).toBe(700);
      expect(metrics.netBalance).toBe(-700);
      expect(metrics.savingsRate).toBe(0);
    });

    it('deve tratar meses sem despesas sem gerar divisão por zero', () => {
      const noExpenses = [{ amount: 3500, category: 'Outros' }];
      const metrics = AnalysisService.calculateMetrics(noExpenses);

      expect(metrics.totalIncome).toBe(3500);
      expect(metrics.totalExpenses).toBe(0);
      expect(metrics.netBalance).toBe(3500);
      expect(metrics.savingsRate).toBe(100);
      expect(metrics.topCategories).toEqual([]);
    });
  });

  describe('invalidate', () => {
    it('deve chamar deleteMany com o userId correto e retornar a quantidade de registros excluídos', async () => {
      const mockUserId = '507f1f77bcf86cd799439011';
      const deleteManySpy = vi.spyOn(FinancialAnalysisModel, 'deleteMany').mockReturnValue({
        exec: vi.fn().mockResolvedValue({ deletedCount: 3 }),
      } as any);

      const count = await AnalysisService.invalidate(mockUserId);

      expect(deleteManySpy).toHaveBeenCalledWith({
        userId: new mongoose.Types.ObjectId(mockUserId),
      });
      expect(count).toBe(3);

      deleteManySpy.mockRestore();
    });
  });
});
