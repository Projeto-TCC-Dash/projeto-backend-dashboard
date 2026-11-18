import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionModel } from '../../src/models/transaction.model.js';
import { UserModel } from '../../src/models/user.model.js';
import { FiscalService } from '../../src/services/fiscal.service.js';

describe('FiscalService Unit Tests', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const transactionId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateTransactionFiscal', () => {
    it('deve retornar null se a transação não existir ou pertencer a outro usuário', async () => {
      vi.spyOn(TransactionModel, 'findOne').mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      } as any);

      const result = await FiscalService.updateTransactionFiscal(userId, transactionId, {
        isTaxDeductible: true,
      });

      expect(result).toBeNull();
    });

    it('deve atualizar metadados fiscais com CPF/CNPJ higienizado', async () => {
      const mockTx: any = {
        _id: new mongoose.Types.ObjectId(transactionId),
        userId: new mongoose.Types.ObjectId(userId),
        amount: -450,
        fiscal: undefined,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(TransactionModel, 'findOne').mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTx),
      } as any);

      const result = await FiscalService.updateTransactionFiscal(userId, transactionId, {
        isTaxDeductible: true,
        taxCategory: 'HEALTH',
        providerDocument: '12.345.678/0001-90',
        providerName: 'Clínica Odonto Teste',
        status: 'CONFIRMED',
      });

      expect(mockTx.fiscal).toBeDefined();
      expect(mockTx.fiscal.isTaxDeductible).toBe(true);
      expect(mockTx.fiscal.taxCategory).toBe('HEALTH');
      expect(mockTx.fiscal.providerDocument).toBe('12345678000190');
      expect(mockTx.fiscal.providerName).toBe('Clínica Odonto Teste');
      expect(mockTx.fiscal.deductibleAmount).toBe(450);
      expect(mockTx.fiscal.status).toBe('CONFIRMED');
      expect(mockTx.fiscal.verifiedAt).toBeInstanceOf(Date);
      expect(mockTx.save).toHaveBeenCalled();
    });
  });

  describe('getAnnualSummary', () => {
    it('deve consolidar despesas dedutíveis por categoria e computar totais confirmados e pendentes', async () => {
      const mockDeductibleTxs: any[] = [
        {
          _id: new mongoose.Types.ObjectId(),
          amount: -500,
          fiscal: {
            isTaxDeductible: true,
            taxCategory: 'HEALTH',
            deductibleAmount: 500,
            status: 'CONFIRMED',
          },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          amount: -300,
          fiscal: {
            isTaxDeductible: true,
            taxCategory: 'HEALTH',
            deductibleAmount: 300,
            status: 'PENDING',
          },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          amount: -1200,
          fiscal: {
            isTaxDeductible: true,
            taxCategory: 'EDUCATION',
            deductibleAmount: 1200,
            status: 'CONFIRMED',
          },
        },
      ];

      vi.spyOn(TransactionModel, 'find').mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockDeductibleTxs),
      } as any);

      vi.spyOn(UserModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          financialProfile: { incomeType: 'CLT' },
        }),
      } as any);

      const summary = await FiscalService.getAnnualSummary(userId, '2026');

      expect(summary.year).toBe('2026');
      expect(summary.totalDeductibleExpenses).toBe(2000);
      expect(summary.confirmedDeductibleExpenses).toBe(1700);
      expect(summary.pendingDocumentationExpenses).toBe(300);

      const health = summary.byCategory.find((c) => c.taxCategory === 'HEALTH');
      expect(health).toBeDefined();
      expect(health?.totalAmount).toBe(800);
      expect(health?.confirmedAmount).toBe(500);
      expect(health?.pendingAmount).toBe(300);
      expect(health?.count).toBe(2);

      const edu = summary.byCategory.find((c) => c.taxCategory === 'EDUCATION');
      expect(edu).toBeDefined();
      expect(edu?.totalAmount).toBe(1200);
      expect(edu?.confirmedAmount).toBe(1200);
      expect(edu?.count).toBe(1);

      expect(summary.pjSummary.applicable).toBe(false);
    });
  });
});
