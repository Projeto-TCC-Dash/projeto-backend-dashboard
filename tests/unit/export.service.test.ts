import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { AccountModel } from '../../src/models/account.model.js';
import { TransactionModel } from '../../src/models/transaction.model.js';
import { UserModel } from '../../src/models/user.model.js';
import { AccountAccessDeniedError, ExportService } from '../../src/services/export.service.js';

describe('ExportService Unit Tests', () => {
  const mockUserId = new Types.ObjectId().toString();
  const mockAccountId = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatters', () => {
    it('deve formatar data no padrão DD/MM/YYYY', () => {
      const date = new Date('2026-10-30T15:30:00Z');
      expect(ExportService.formatDateBR(date)).toBe('30/10/2026');
    });

    it('deve formatar valores monetários em formato brasileiro', () => {
      expect(ExportService.formatCurrencyBR(1250.5)).toBe('R$ 1.250,50');
      expect(ExportService.formatCurrencyBR(-45.99)).toBe('-R$ 45,99');
      expect(ExportService.formatCurrencyBR(0)).toBe('R$ 0,00');
    });

    it('deve formatar decimal brasileiro sem R$', () => {
      expect(ExportService.formatDecimalBR(1250.5)).toBe('1250,50');
      expect(ExportService.formatDecimalBR(-45.99)).toBe('-45,99');
    });
  });

  describe('getExportData', () => {
    it('deve lançar AccountAccessDeniedError se o accountId não pertencer ao usuário', async () => {
      vi.spyOn(AccountModel, 'findOne').mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      } as any);

      await expect(
        ExportService.getExportData(mockUserId, {
          format: 'csv',
          accountId: mockAccountId,
        })
      ).rejects.toThrow(AccountAccessDeniedError);
    });

    it('deve calcular métricas segregando pagamentos de fatura e somando receitas e despesas', async () => {
      vi.spyOn(UserModel, 'findById').mockReturnValue({
        select: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({ email: 'teste@exemplo.com', name: 'Investidor Teste' }),
        }),
      } as any);

      vi.spyOn(AccountModel, 'find').mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue([
              { _id: new Types.ObjectId(mockAccountId), name: 'Nubank' },
            ]),
          }),
        }),
      } as any);

      const mockTransactions = [
        {
          _id: new Types.ObjectId(),
          userId: new Types.ObjectId(mockUserId),
          accountId: new Types.ObjectId(mockAccountId),
          date: new Date('2026-10-25T10:00:00Z'),
          amount: 5000,
          rawDescription: 'SALARIO',
          cleanDescription: 'Salário Mensal',
          category: 'Receita',
        },
        {
          _id: new Types.ObjectId(),
          userId: new Types.ObjectId(mockUserId),
          accountId: new Types.ObjectId(mockAccountId),
          date: new Date('2026-10-26T10:00:00Z'),
          amount: -200,
          rawDescription: 'SUPERMERCADO',
          cleanDescription: 'Mercado',
          category: 'Alimentação',
        },
        {
          _id: new Types.ObjectId(),
          userId: new Types.ObjectId(mockUserId),
          accountId: new Types.ObjectId(mockAccountId),
          date: new Date('2026-10-27T10:00:00Z'),
          amount: -1500,
          rawDescription: 'PAGTO FATURA',
          cleanDescription: 'Pagamento de Fatura Nubank',
          category: 'Pagamento de Fatura',
        },
      ];

      vi.spyOn(TransactionModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockTransactions),
          }),
        }),
      } as any);

      const result = await ExportService.getExportData(mockUserId, {
        format: 'csv',
        month: '2026-10',
      });

      expect(result.records).toHaveLength(3);
      expect(result.metrics.totalIncome).toBe(5000);
      // Despesas não devem incluir os R$ 1500 de fatura
      expect(result.metrics.totalExpenses).toBe(200);
      expect(result.metrics.netBalance).toBe(4800);
      expect(result.records[0]?.accountName).toBe('Nubank');
      expect(result.records[2]?.type).toBe('PAGAMENTO_FATURA');
    });
  });
});
