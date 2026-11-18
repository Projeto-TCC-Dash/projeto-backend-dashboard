import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateCurrentMonthTransactions,
  parseSeedExtraArgs,
  runSeedExtra,
} from '../../scripts/seed-extra.js';
import { AccountModel } from '../../src/models/account.model.js';
import { TransactionModel } from '../../src/models/transaction.model.js';
import { UserModel } from '../../src/models/user.model.js';
import { AnalysisService } from '../../src/services/analysis.service.js';

describe('Extra Current-Month Seed Script (scripts/seed-extra.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseSeedExtraArgs', () => {
    it('deve interpretar argumentos CLI válidos (--email, --month, --count, --batch)', () => {
      const parsed = parseSeedExtraArgs([
        '--email=meu@teste.com',
        '--month=2026-11',
        '--count=25',
        '--batch=lote01',
      ]);

      expect(parsed).toEqual({
        email: 'meu@teste.com',
        month: '2026-11',
        count: 25,
        batchId: 'lote01',
      });
    });

    it('deve lançar erro se --month ou --count forem inválidos', () => {
      expect(() => parseSeedExtraArgs(['--month=11/2026'])).toThrow(/Formato inválido/);
      expect(() => parseSeedExtraArgs(['--count=0'])).toThrow(/entre 1 e 200/);
      expect(() => parseSeedExtraArgs(['--count=500'])).toThrow(/entre 1 e 200/);
    });
  });

  describe('generateCurrentMonthTransactions', () => {
    it('deve gerar exatamente a quantidade solicitada para o mês atual com externalIds únicos', () => {
      const fixedNow = new Date('2026-11-18T12:00:00Z');
      const result = generateCurrentMonthTransactions({
        count: 20,
        now: fixedNow,
        batchId: 'b1',
      });

      expect(result.month).toBe('2026-11');
      expect(result.batchId).toBe('b1');
      expect(result.transactions).toHaveLength(20);

      const ids = new Set(result.transactions.map((t) => t.externalId));
      expect(ids.size).toBe(20);

      for (const tx of result.transactions) {
        expect(tx.externalId.startsWith('extra-2026-11-b1-')).toBe(true);
        expect(tx.date.getUTCFullYear()).toBe(2026);
        expect(tx.date.getUTCMonth()).toBe(10); // Novembro (0-indexed)
        expect(tx.date.getUTCDate()).toBeLessThanOrEqual(18);
        expect(tx.source).toBe('SEED');
      }

      const deductibleCount = result.transactions.filter((t) => t.fiscal?.isTaxDeductible).length;
      expect(deductibleCount).toBeGreaterThanOrEqual(4);
    });

    it('deve gerar lotes distintos quando chamado sem batchId fixo', () => {
      const fixedNow = new Date('2026-11-18T12:00:00Z');
      const batchA = generateCurrentMonthTransactions({ count: 5, now: fixedNow });
      const batchB = generateCurrentMonthTransactions({ count: 5, now: fixedNow });

      expect(batchA.batchId).not.toBe(batchB.batchId);
      expect(batchA.transactions[0]?.externalId).not.toBe(batchB.transactions[0]?.externalId);
    });
  });

  describe('runSeedExtra', () => {
    it('deve lançar erro descritivo caso o usuário não exista', async () => {
      vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose as unknown as typeof mongoose);
      vi.spyOn(UserModel, 'findOne').mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      } as never);

      await expect(
        runSeedExtra({ email: 'inexistente@teste.com', count: 5 })
      ).rejects.toThrow(/não encontrado/);
    });

    it('deve inserir transações via bulkWrite e invalidar cache do usuário', async () => {
      const userId = new mongoose.Types.ObjectId();
      const checkingId = new mongoose.Types.ObjectId();
      const cardId = new mongoose.Types.ObjectId();

      vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose as unknown as typeof mongoose);
      vi.spyOn(UserModel, 'findOne').mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          _id: userId,
          email: 'teste.usuario@exemplo.com',
        }),
      } as never);

      vi.spyOn(AccountModel, 'findOne')
        .mockReturnValueOnce({
          exec: vi.fn().mockResolvedValue({ _id: checkingId, type: 'CHECKING' }),
        } as never)
        .mockReturnValueOnce({
          exec: vi.fn().mockResolvedValue({ _id: cardId, type: 'CREDIT_CARD' }),
        } as never);

      const bulkWriteSpy = vi.spyOn(TransactionModel, 'bulkWrite').mockResolvedValue({
        upsertedCount: 10,
      } as never);

      const invalidateSpy = vi.spyOn(AnalysisService, 'invalidate').mockResolvedValue(1);

      const res = await runSeedExtra({
        email: 'teste.usuario@exemplo.com',
        month: '2026-11',
        count: 10,
        batchId: 'unit1',
      });

      expect(res.month).toBe('2026-11');
      expect(res.transactionsInserted).toBe(10);
      expect(res.duplicatesIgnored).toBe(0);
      expect(res.totalIncomeAdded).toBeGreaterThan(0);
      expect(res.totalExpensesAdded).toBeGreaterThan(0);
      expect(bulkWriteSpy).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledWith(userId.toString());
    });
  });
});
