import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionModel } from '../../src/models/transaction.model.js';
import { UserModel } from '../../src/models/user.model.js';
import { AccountService } from '../../src/services/account.service.js';
import { AnalysisService } from '../../src/services/analysis.service.js';
import { BudgetService } from '../../src/services/budget.service.js';
import { ChatService } from '../../src/services/chat.service.js';
import { TransactionService } from '../../src/services/transaction.service.js';

describe('TransactionService.deleteTransaction - Unit Tests', () => {
  const userId = '507f1f77bcf86cd799439011';
  const transactionId = '507f1f77bcf86cd799439022';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(BudgetService, 'getAlertingBudgetsSummary').mockResolvedValue([]);
  });

  it('deve excluir a transação atomicamente via findOneAndDelete e invalidar o cache de análise do usuário', async () => {
    const mockDeletedDoc = {
      _id: new mongoose.Types.ObjectId(transactionId),
      userId: new mongoose.Types.ObjectId(userId),
      amount: -150,
      cleanDescription: 'Supermercado Teste',
    };

    const findOneAndDeleteSpy = vi.spyOn(TransactionModel, 'findOneAndDelete').mockReturnValue({
      exec: vi.fn().mockResolvedValue(mockDeletedDoc),
    } as any);

    const invalidateSpy = vi.spyOn(AnalysisService, 'invalidate').mockResolvedValue(1);

    const result = await TransactionService.deleteTransaction(userId, transactionId);

    expect(result).toBe(true);
    expect(findOneAndDeleteSpy).toHaveBeenCalledWith({
      _id: new mongoose.Types.ObjectId(transactionId),
      userId: new mongoose.Types.ObjectId(userId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith(userId);
  });

  it('deve retornar false e não chamar invalidação quando a transação não existir ou pertencer a outro usuário', async () => {
    const findOneAndDeleteSpy = vi.spyOn(TransactionModel, 'findOneAndDelete').mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    } as any);

    const invalidateSpy = vi.spyOn(AnalysisService, 'invalidate').mockResolvedValue(0);

    const result = await TransactionService.deleteTransaction(userId, transactionId);

    expect(result).toBe(false);
    expect(findOneAndDeleteSpy).toHaveBeenCalledWith({
      _id: new mongoose.Types.ObjectId(transactionId),
      userId: new mongoose.Types.ObjectId(userId),
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('deve invalidar o cache de análise ao atualizar uma transação existente', async () => {
    const mockUpdatedDoc = {
      _id: new mongoose.Types.ObjectId(transactionId),
      userId: new mongoose.Types.ObjectId(userId),
      category: 'Saúde',
    };

    vi.spyOn(TransactionModel, 'findOneAndUpdate').mockReturnValue({
      exec: vi.fn().mockResolvedValue(mockUpdatedDoc),
    } as any);
    const invalidateSpy = vi.spyOn(AnalysisService, 'invalidate').mockResolvedValue(1);

    const result = await TransactionService.updateTransaction(userId, transactionId, {
      category: 'Saúde',
    });

    expect(result).toBe(mockUpdatedDoc);
    expect(invalidateSpy).toHaveBeenCalledWith(userId);
  });

  describe('getMonthlyFinancialSummary - Invoice Segregation', () => {
    it('deve segregar Pagamento de Fatura de totalExpenses no resumo financeiro mensal', async () => {
      const mockTransactions = [
        { amount: 5000, category: 'Receita' },
        { amount: -800, category: 'Alimentação' },
        { amount: -400, category: 'Transporte' },
        { amount: -2000, category: 'Pagamento de Fatura' },
      ];

      vi.spyOn(TransactionModel, 'find').mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTransactions),
      } as any);

      const summary = await TransactionService.getMonthlyFinancialSummary(userId, new Date('2026-10-15T12:00:00Z'));

      expect(summary.totalIncome).toBe(5000);
      expect(summary.totalExpenses).toBe(1200); // 800 + 400 (NÃO 3200!)
      expect(summary.invoiceSettlements).toBe(2000);
      expect(summary.netBalance).toBe(3800);
      expect(summary.categoryTotals['Pagamento de Fatura']).toBe(2000);
      expect(summary.categoryTotals['Alimentação']).toBe(800);
    });
  });

  describe('ChatService.buildSystemInstruction - Persona Context', () => {
    it('deve conter orientações de segregação de faturas no prompt de sistema do chat', async () => {
      const mockSummary = {
        month: '2026-10',
        totalIncome: 6000,
        totalExpenses: 2500,
        invoiceSettlements: 1800,
        netBalance: 3500,
        categoryTotals: { Alimentação: 1500, Lazer: 1000, 'Pagamento de Fatura': 1800 },
      };

      vi.spyOn(TransactionService, 'getMonthlyFinancialSummary').mockResolvedValue(mockSummary);
      vi.spyOn(UserModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      } as any);

      const instruction = await ChatService.buildSystemInstruction(userId);

      expect(instruction).toContain('Despesas Operacionais (Consumo): R$ 2500.00');
      expect(instruction).toContain('Quitação de Faturas de Cartão: R$ 1800.00');
      expect(instruction).toContain('Diferencie despesas operacionais primárias');
    });

    it('deve injetar o perfil financeiro do usuário nas instruções de sistema da persona do chat', async () => {
      const mockSummary = {
        month: '2026-10',
        totalIncome: 10000,
        totalExpenses: 4000,
        invoiceSettlements: 1000,
        netBalance: 6000,
        categoryTotals: { Alimentação: 2000, Moradia: 2000 },
      };

      vi.spyOn(TransactionService, 'getMonthlyFinancialSummary').mockResolvedValue(mockSummary);
      vi.spyOn(UserModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          financialProfile: {
            incomeType: 'CLT',
            declaredMonthlyIncome: 8000,
            goals: ['COMPRAR_IMOVEL', 'INVESTIR_LONGO_PRAZO'],
            riskProfile: 'CONSERVATIVE',
          },
        }),
      } as any);

      const instruction = await ChatService.buildSystemInstruction(userId);

      expect(instruction).toContain('PERFIL FINANCEIRO DO USUÁRIO');
      expect(instruction).toContain('Regime de Renda: CLT');
      expect(instruction).toContain('Renda Mensal Declarada: R$ 8000.00');
      expect(instruction).toContain('COMPRAR_IMOVEL, INVESTIR_LONGO_PRAZO');
      expect(instruction).toContain('CONSERVATIVE');
      expect(instruction).toContain('Personalize seu aconselhamento');
    });

    it('deve aplicar fallback elegante nas instruções do chat quando o perfil financeiro não for informado', async () => {
      const mockSummary = {
        month: '2026-10',
        totalIncome: 5000,
        totalExpenses: 2000,
        invoiceSettlements: 0,
        netBalance: 3000,
        categoryTotals: {},
      };

      vi.spyOn(TransactionService, 'getMonthlyFinancialSummary').mockResolvedValue(mockSummary);
      vi.spyOn(UserModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      } as any);

      const instruction = await ChatService.buildSystemInstruction(userId);

      expect(instruction).toContain('PERFIL FINANCEIRO DO USUÁRIO: Não informado');
    });
  });

  describe('TransactionService.importTransactions - Deduplicação em memória', () => {
    it('deve deduplicar transações com externalId repetido no mesmo lote antes de chamar bulkWrite', async () => {
      const mockAccountId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439088');
      vi.spyOn(AccountService, 'getOrCreateDefaultAccount').mockResolvedValue({
        _id: mockAccountId,
      } as any);

      const bulkWriteSpy = vi.spyOn(TransactionModel, 'bulkWrite').mockResolvedValue({
        upsertedCount: 2,
      } as any);
      const invalidateSpy = vi.spyOn(AnalysisService, 'invalidate').mockResolvedValue(1);

      const result = await TransactionService.importTransactions(userId, [
        {
          externalId: 'DOC-DUP-1',
          rawDescription: 'COMPRA A',
          cleanDescription: 'COMPRA A',
          amount: -50,
          date: new Date('2026-10-10T12:00:00Z'),
          source: 'CSV',
        },
        {
          externalId: 'DOC-DUP-1',
          rawDescription: 'COMPRA A DUPLICADA',
          cleanDescription: 'COMPRA A DUPLICADA',
          amount: -50,
          date: new Date('2026-10-10T12:00:00Z'),
          source: 'CSV',
        },
        {
          externalId: 'DOC-UNIQ-2',
          rawDescription: 'COMPRA B',
          cleanDescription: 'COMPRA B',
          amount: -120.5,
          date: new Date('2026-10-11T12:00:00Z'),
          source: 'CSV',
        },
      ]);

      expect(bulkWriteSpy).toHaveBeenCalledTimes(1);
      const operations = bulkWriteSpy.mock.calls[0]?.[0] as any[];
      expect(operations).toHaveLength(2);
      expect(operations[0].updateOne.filter.externalId).toBe('DOC-DUP-1');
      expect(operations[1].updateOne.filter.externalId).toBe('DOC-UNIQ-2');
      expect(result).toEqual({
        totalExtracted: 3,
        imported: 2,
        duplicatesIgnored: 1,
      });
      expect(invalidateSpy).toHaveBeenCalledWith(userId);
    });
  });
});
