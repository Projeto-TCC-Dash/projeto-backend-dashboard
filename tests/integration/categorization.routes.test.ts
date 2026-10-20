import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { SYSTEM_DEFAULTS } from '../../src/config/constants.js';
import { TransactionModel } from '../../src/models/transaction.model.js';
import { UserModel } from '../../src/models/user.model.js';
import { AccountService } from '../../src/services/account.service.js';
import { TransactionService } from '../../src/services/transaction.service.js';

describe('Categorization Routes & Initial Default Category (HTTP Inject & BYOK Guard)', () => {
  const app = buildApp();
  const testUserId = '507f1f77bcf86cd799439011';
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({ id: testUserId, email: 'teste@exemplo.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('deve ter SYSTEM_DEFAULTS.DEFAULT_CATEGORY configurado como Não Categorizado', () => {
    expect(SYSTEM_DEFAULTS.DEFAULT_CATEGORY).toBe('Não Categorizado');
  });

  it('deve retornar 401 se não autenticado em /api/transactions/categorize', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions/categorize',
    });

    expect(res.statusCode).toBe(401);
  });

  it('deve retornar 403 em /api/transactions/categorize se autenticado sem chave BYOK', async () => {
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        _id: testUserId,
        email: 'teste@exemplo.com',
        hasAiKey: () => false,
      }),
    } as any);

    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions/categorize',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('TransactionService.getUniqueUncategorizedMerchants deve buscar transações com category: Não Categorizado', async () => {
    const findSpy = vi.spyOn(TransactionModel, 'find').mockReturnValue({
      exec: vi.fn().mockResolvedValue([
        { cleanDescription: 'POSTO IPIRANGA' },
        { cleanDescription: 'PADARIA REAL' },
        { cleanDescription: 'POSTO IPIRANGA' },
      ]),
    } as any);

    const merchants = await TransactionService.getUniqueUncategorizedMerchants(testUserId);

    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Não Categorizado',
      }),
      { cleanDescription: 1 }
    );
    expect(merchants).toEqual(['POSTO IPIRANGA', 'PADARIA REAL']);
  });

  it('TransactionService.importTransactions deve definir category padrão como Não Categorizado no $setOnInsert', async () => {
    const defaultAccountId = '507f1f77bcf86cd799439088';
    vi.spyOn(AccountService, 'getOrCreateDefaultAccount').mockResolvedValueOnce({
      _id: defaultAccountId,
    } as any);

    const bulkWriteSpy = vi.spyOn(TransactionModel, 'bulkWrite').mockResolvedValueOnce({
      upsertedCount: 1,
    } as any);

    await TransactionService.importTransactions(testUserId, [
      {
        externalId: 'ext-csv-1',
        rawDescription: 'MERCADO BOM PRECO',
        cleanDescription: 'MERCADO BOM PRECO',
        amount: -55.4,
        date: new Date('2026-10-13'),
        source: 'CSV',
      },
    ]);

    expect(bulkWriteSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          updateOne: expect.objectContaining({
            update: expect.objectContaining({
              $setOnInsert: expect.objectContaining({
                category: 'Não Categorizado',
              }),
            }),
          }),
        }),
      ]),
      { ordered: false }
    );
  });
});
