import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { TransactionService } from '../../src/services/transaction.service.js';

describe('Transaction Routes - PATCH /api/transactions/:id & Category Filtering', () => {
  const app = buildApp();
  const testUserId = '507f1f77bcf86cd799439011';
  const testTransactionId = '507f1f77bcf86cd799439022';
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({ id: testUserId, email: 'teste@exemplo.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('PATCH /api/transactions/:id deve retornar 401 se não autenticado', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/transactions/${testTransactionId}`,
      payload: { category: 'Alimentação' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('PATCH /api/transactions/:id deve retornar 400 se id da transação for malformado', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/transactions/invalid-id-123',
      headers: { authorization: `Bearer ${token}` },
      payload: { category: 'Alimentação' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.statusCode).toBe(400);
    expect(body.error).toBe('Bad Request');
  });

  it('PATCH /api/transactions/:id deve retornar 400 se o corpo estiver vazio', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/transactions/${testTransactionId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.statusCode).toBe(400);
    expect(body.error).toBe('Bad Request');
  });

  it('PATCH /api/transactions/:id deve retornar 400 se categoria for inválida', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/transactions/${testTransactionId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { category: 'CategoriaInvalidaXYZ' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('PATCH /api/transactions/:id deve retornar 404 se transação não for encontrada ou pertencer a outro usuário', async () => {
    vi.spyOn(TransactionService, 'updateTransaction').mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/transactions/${testTransactionId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { category: 'Alimentação' },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Transação não encontrada ou acesso não autorizado');
  });

  it('PATCH /api/transactions/:id deve atualizar e retornar 200 com os dados atualizados', async () => {
    const mockUpdatedDoc: any = {
      _id: testTransactionId,
      externalId: 'ext-123',
      rawDescription: 'TED SALARIO',
      cleanDescription: 'Salário Mensal',
      amount: 5000,
      date: new Date('2026-10-13T10:00:00Z'),
      category: 'Receita',
      source: 'OFX',
    };

    vi.spyOn(TransactionService, 'updateTransaction').mockResolvedValueOnce(mockUpdatedDoc);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/transactions/${testTransactionId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        category: 'Receita',
        cleanDescription: 'Salário Mensal',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(testTransactionId);
    expect(body.category).toBe('Receita');
    expect(body.cleanDescription).toBe('Salário Mensal');
    expect(body.amount).toBe(5000);
  });

  it('GET /api/transactions?category=Receita deve aceitar e filtrar pela categoria Receita', async () => {
    const mockTx: any = {
      _id: testTransactionId,
      externalId: 'ext-rec-1',
      rawDescription: 'PROVENTOS DIVIDENDOS',
      cleanDescription: 'Dividendos',
      amount: 1500,
      date: new Date('2026-10-13T12:00:00Z'),
      category: 'Receita',
      source: 'CSV',
    };

    const listSpy = vi.spyOn(TransactionService, 'listTransactions').mockResolvedValueOnce([mockTx]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/transactions?category=Receita',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(listSpy).toHaveBeenCalledWith(
      testUserId,
      expect.objectContaining({ category: 'Receita' })
    );
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0].category).toBe('Receita');
  });

  it('PATCH /api/transactions/:id deve aceitar atualização do campo accountId', async () => {
    const targetAccountId = '507f1f77bcf86cd799439099';
    const mockUpdatedDoc: any = {
      _id: testTransactionId,
      accountId: targetAccountId,
      externalId: 'ext-123',
      rawDescription: 'TED SALARIO',
      cleanDescription: 'Salário Mensal',
      amount: 5000,
      date: new Date('2026-10-13T10:00:00Z'),
      category: 'Receita',
      source: 'OFX',
    };

    const updateSpy = vi.spyOn(TransactionService, 'updateTransaction').mockResolvedValueOnce(mockUpdatedDoc);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/transactions/${testTransactionId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { accountId: targetAccountId },
    });

    expect(res.statusCode).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(
      testUserId,
      testTransactionId,
      expect.objectContaining({ accountId: targetAccountId })
    );
  });

  it('GET /api/transactions?accountId=... deve filtrar por conta específica', async () => {
    const targetAccountId = '507f1f77bcf86cd799439099';
    const listSpy = vi.spyOn(TransactionService, 'listTransactions').mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/transactions?accountId=${targetAccountId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(listSpy).toHaveBeenCalledWith(
      testUserId,
      expect.objectContaining({ accountId: targetAccountId })
    );
  });

  describe('DELETE /api/transactions/:id', () => {
    it('deve retornar 401 se não autenticado', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/transactions/${testTransactionId}`,
      });

      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 400 se id da transação for malformado', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/transactions/invalid-id-xyz',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.statusCode).toBe(400);
      expect(body.error).toBe('Bad Request');
    });

    it('deve retornar 404 se transação não for encontrada ou pertencer a outro usuário', async () => {
      vi.spyOn(TransactionService, 'deleteTransaction').mockResolvedValueOnce(false);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/transactions/${testTransactionId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.message).toBe('Transação não encontrada ou acesso não autorizado');
    });

    it('deve excluir transação com sucesso e retornar 204 No Content', async () => {
      const deleteSpy = vi.spyOn(TransactionService, 'deleteTransaction').mockResolvedValueOnce(true);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/transactions/${testTransactionId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
      expect(deleteSpy).toHaveBeenCalledWith(testUserId, testTransactionId);
    });
  });
});

