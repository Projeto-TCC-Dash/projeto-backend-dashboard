import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionModel } from '../../src/models/transaction.model.js';
import { AnalysisService } from '../../src/services/analysis.service.js';
import { ChatService } from '../../src/services/chat.service.js';
import { TransactionService } from '../../src/services/transaction.service.js';

describe('TransactionService.deleteTransaction - Unit Tests', () => {
  const userId = '507f1f77bcf86cd799439011';
  const transactionId = '507f1f77bcf86cd799439022';

  beforeEach(() => {
    vi.restoreAllMocks();
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

      const instruction = await ChatService.buildSystemInstruction(userId);

      expect(instruction).toContain('Despesas Operacionais (Consumo): R$ 2500.00');
      expect(instruction).toContain('Quitação de Faturas de Cartão: R$ 1800.00');
      expect(instruction).toContain('Diferencie despesas operacionais primárias');
    });
  });
});
