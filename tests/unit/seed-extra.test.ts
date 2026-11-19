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
    it('deve interpretar argumentos CLI válidos (--email, --month, --count, --batch, --type)', () => {
      const parsed = parseSeedExtraArgs([
        '--email=meu@teste.com',
        '--month=2026-11',
        '--count=25',
        '--batch=lote01',
        '--type=investimentos',
      ]);

      expect(parsed).toEqual({
        email: 'meu@teste.com',
        month: '2026-11',
        count: 25,
        batchId: 'lote01',
        type: 'investimentos',
      });
    });

    it('deve aceitar aliases em inglês/português e lançar erro em parâmetros inválidos', () => {
      expect(parseSeedExtraArgs(['--type=income']).type).toBe('receitas');
      expect(parseSeedExtraArgs(['--type=expenses']).type).toBe('gastos');
      expect(parseSeedExtraArgs(['--type=investments']).type).toBe('investimentos');
      expect(parseSeedExtraArgs(['--type=fiscal']).type).toBe('fiscais');

      expect(() => parseSeedExtraArgs(['--month=11/2026'])).toThrow(/Formato inválido/);
      expect(() => parseSeedExtraArgs(['--count=0'])).toThrow(/entre 1 e 200/);
      expect(() => parseSeedExtraArgs(['--count=500'])).toThrow(/entre 1 e 200/);
      expect(() => parseSeedExtraArgs(['--type=invalido'])).toThrow(/Tipo inválido/);
    });
  });

  describe('generateCurrentMonthTransactions', () => {
    it('deve gerar exatamente a quantidade solicitada para o mês atual com receitas, gastos e investimentos', () => {
      const fixedNow = new Date('2026-11-18T12:00:00Z');
      const result = generateCurrentMonthTransactions({
        count: 15,
        now: fixedNow,
        batchId: 'b1',
      });

      expect(result.month).toBe('2026-11');
      expect(result.batchId).toBe('b1');
      expect(result.type).toBe('all');
      expect(result.transactions).toHaveLength(15);

      const ids = new Set(result.transactions.map((t) => t.externalId));
      expect(ids.size).toBe(15);

      for (const tx of result.transactions) {
        expect(tx.externalId.startsWith('extra-2026-11-b1-')).toBe(true);
        expect(tx.date.getUTCFullYear()).toBe(2026);
        expect(tx.date.getUTCMonth()).toBe(10); // Novembro (0-indexed)
        expect(tx.date.getUTCDate()).toBeLessThanOrEqual(18);
        expect(tx.source).toBe('SEED');
      }

      const categories = new Set(result.transactions.map((t) => t.category));
      expect(categories.has('Receita')).toBe(true);
      expect(categories.has('Investimentos')).toBe(true);
      expect(categories.has('Pagamento de Fatura')).toBe(true);

      const deductibleCount = result.transactions.filter((t) => t.fiscal?.isTaxDeductible).length;
      expect(deductibleCount).toBeGreaterThanOrEqual(4);
    });

    it('deve filtrar corretamente por --type (receitas, investimentos, fiscais, gastos)', () => {
      const fixedNow = new Date('2026-11-18T12:00:00Z');

      const incomes = generateCurrentMonthTransactions({ count: 6, type: 'receitas', now: fixedNow });
      expect(incomes.transactions.every((t) => t.amount > 0)).toBe(true);

      const investments = generateCurrentMonthTransactions({
        count: 6,
        type: 'investimentos',
        now: fixedNow,
      });
      expect(
        investments.transactions.every(
          (t) => t.category === 'Investimentos' || t.fiscal?.taxCategory === 'PENSION_PGBL'
        )
      ).toBe(true);

      const fiscals = generateCurrentMonthTransactions({ count: 6, type: 'fiscais', now: fixedNow });
      expect(fiscals.transactions.every((t) => Boolean(t.fiscal?.isTaxDeductible))).toBe(true);

      const expenses = generateCurrentMonthTransactions({ count: 6, type: 'gastos', now: fixedNow });
      expect(
        expenses.transactions.every(
          (t) =>
            t.amount < 0 &&
            t.category !== 'Investimentos' &&
            t.category !== 'Pagamento de Fatura'
        )
      ).toBe(true);
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

    it('deve inserir transações via bulkWrite, vincular conta de investimento e invalidar cache', async () => {
      const userId = new mongoose.Types.ObjectId();
      const checkingId = new mongoose.Types.ObjectId();
      const cardId = new mongoose.Types.ObjectId();
      const investId = new mongoose.Types.ObjectId();

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
        } as never)
        .mockReturnValueOnce({
          exec: vi.fn().mockResolvedValue({ _id: investId, type: 'INVESTMENT' }),
        } as never);

      const bulkWriteSpy = vi.spyOn(TransactionModel, 'bulkWrite').mockResolvedValue({
        upsertedCount: 15,
      } as never);

      const invalidateSpy = vi.spyOn(AnalysisService, 'invalidate').mockResolvedValue(1);

      const res = await runSeedExtra({
        email: 'teste.usuario@exemplo.com',
        month: '2026-11',
        count: 15,
        batchId: 'unit1',
      });

      expect(res.month).toBe('2026-11');
      expect(res.type).toBe('all');
      expect(res.transactionsInserted).toBe(15);
      expect(res.duplicatesIgnored).toBe(0);
      expect(res.totalIncomeAdded).toBeGreaterThan(0);
      expect(res.totalExpensesAdded).toBeGreaterThan(0);
      expect(res.totalInvestmentsAdded).toBeGreaterThan(0);
      expect(bulkWriteSpy).toHaveBeenCalledTimes(1);
      const ops = bulkWriteSpy.mock.calls[0]?.[0] as Array<{
        updateOne: { update: { $setOnInsert: { accountId: mongoose.Types.ObjectId } } };
      }>;
      expect(ops).toHaveLength(15);
      const accountIdsUsed = new Set(
        ops.map((op) => op.updateOne.update.$setOnInsert.accountId.toString())
      );
      expect(accountIdsUsed.has(checkingId.toString())).toBe(true);
      expect(accountIdsUsed.has(cardId.toString())).toBe(true);
      expect(accountIdsUsed.has(investId.toString())).toBe(true);
      expect(invalidateSpy).toHaveBeenCalledWith(userId.toString());
    });
  });
});
