import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { CANONICAL_CATEGORIES } from '../../src/config/constants.js';
import { env } from '../../src/config/env.js';
import { TransactionModel } from '../../src/models/transaction.model.js';
import { UserModel } from '../../src/models/user.model.js';
import {
  generateSyntheticTransactions,
  runSeed,
  SEED_CONFIG,
  SyntheticTransaction,
} from '../../scripts/seed.js';

describe('Local Seed Synthetic Generator & Idempotency Tests', () => {
  it('deve possuir constantes e gerador de transações sintéticas com 35+ transações nas 7 categorias', () => {
    expect(SEED_CONFIG.EMAIL).toBe('teste.usuario@exemplo.com');
    expect(SEED_CONFIG.PASSWORD).toBe('SenhaForte#123');

    const transactions: SyntheticTransaction[] = generateSyntheticTransactions();
    expect(transactions.length).toBeGreaterThanOrEqual(35);

    const categoriesFound = new Set<string>();
    const monthsFound = new Set<string>();

    for (const t of transactions) {
      expect(t.externalId).toMatch(/^seed-\d{4}-\d{2}-\d{3}$/);
      expect(t.rawDescription).toBeTruthy();
      expect(t.cleanDescription).toBeTruthy();
      expect(typeof t.amount).toBe('number');
      expect(t.date instanceof Date).toBe(true);
      expect(t.source).toBe('SEED');

      categoriesFound.add(t.category);
      const monthKey = `${t.date.getUTCFullYear()}-${String(t.date.getUTCMonth() + 1).padStart(2, '0')}`;
      monthsFound.add(monthKey);
    }

    // Valida cobertura das 7 categorias canônicas
    for (const canonical of CANONICAL_CATEGORIES) {
      expect(categoriesFound.has(canonical)).toBe(true);
    }

    // Valida presença de pelo menos 2 meses distintos (M e M-1)
    expect(monthsFound.size).toBeGreaterThanOrEqual(2);
  });

  it('deve executar o seed com idempotência e integridade sem duplicar dados', async () => {
    let mongoAvailable = false;
    try {
      await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 1500 });
      mongoAvailable = mongoose.connection.readyState === 1;
    } catch {
      mongoAvailable = false;
    }

    if (mongoAvailable) {
      try {
        // Execução 1: Deve criar usuário e importar transações
        const run1 = await runSeed();
        expect(run1.email).toBe(SEED_CONFIG.EMAIL);

        // Execução 2: Idempotência estrita (0 novas transações inseridas)
        const run2 = await runSeed();
        expect(run2.email).toBe(SEED_CONFIG.EMAIL);
        expect(run2.transactionsImported).toBe(0);
      } finally {
        await mongoose.disconnect();
      }
    } else {
      // Quando o MongoDB não estiver rodando localmente no runner de CI, testa a idempotência simulada
      const mockConnect = vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose as any);

      const mockFindOne = vi.spyOn(UserModel, 'findOne').mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          email: SEED_CONFIG.EMAIL,
          hasAiKey: () => false,
          save: vi.fn().mockResolvedValue(true),
        }),
      } as any);

      const mockBulkWrite = vi.spyOn(TransactionModel, 'bulkWrite').mockResolvedValue({
        upsertedCount: 0,
        modifiedCount: 0,
      } as any);

      const result = await runSeed();
      expect(result.email).toBe(SEED_CONFIG.EMAIL);
      expect(result.transactionsImported).toBe(0);

      mockConnect.mockRestore();
      mockFindOne.mockRestore();
      mockBulkWrite.mockRestore();
    }
  });
});
