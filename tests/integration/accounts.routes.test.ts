import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import {
  AccountBadRequestError,
  AccountConflictError,
  AccountNotFoundError,
  AccountService,
} from '../../src/services/account.service.js';

describe('Accounts Routes (HTTP Inject & Contracts)', () => {
  const app = buildApp();
  const testUserId = '507f1f77bcf86cd799439011';
  const testAccountId = '507f1f77bcf86cd799439022';
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({ id: testUserId, email: 'teste@exemplo.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/accounts', () => {
    it('deve retornar 401 se requisição não contiver token JWT', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        payload: { name: 'Nubank', type: 'CHECKING' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 400 se nome estiver vazio ou tipo for inválido', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: '', type: 'INVALID_TYPE' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 400 se cor hexadecimal for inválida', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Nubank', type: 'CHECKING', color: 'cor-invalida' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 409 Conflict se AccountService lançar AccountConflictError', async () => {
      vi.spyOn(AccountService, 'createAccount').mockRejectedValueOnce(
        new AccountConflictError('Já existe uma conta com o nome "Nubank" para este usuário.')
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Nubank', type: 'CHECKING' },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.statusCode).toBe(409);
      expect(body.message).toContain('Já existe uma conta com o nome');
    });

    it('deve retornar 201 Created quando conta for criada com sucesso', async () => {
      const mockCreated: any = {
        id: testAccountId,
        userId: testUserId,
        name: 'Nubank Principal',
        type: 'CHECKING',
        initialBalance: 1500,
        institution: 'Nu Pagamentos',
        color: '#820AD1',
        balance: 1500,
        transactionCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.spyOn(AccountService, 'createAccount').mockResolvedValueOnce(mockCreated);

      const res = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Nubank Principal',
          type: 'CHECKING',
          initialBalance: 1500,
          institution: 'Nu Pagamentos',
          color: '#820AD1',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(testAccountId);
      expect(body.name).toBe('Nubank Principal');
      expect(body.balance).toBe(1500);
      expect(body.transactionCount).toBe(0);
    });
  });

  describe('GET /api/accounts', () => {
    it('deve retornar 401 se requisição não contiver token JWT', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/accounts',
      });
      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 200 OK com a listagem de contas e saldo consolidado', async () => {
      const mockList = {
        accounts: [
          {
            id: testAccountId,
            userId: testUserId,
            name: 'Nubank Principal',
            type: 'CHECKING' as const,
            initialBalance: 1500,
            color: '#820AD1',
            balance: 6000,
            transactionCount: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        totalAccounts: 1,
        netWorth: 6000,
      };

      vi.spyOn(AccountService, 'listAccountsWithBalances').mockResolvedValueOnce(mockList);

      const res = await app.inject({
        method: 'GET',
        url: '/api/accounts',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.totalAccounts).toBe(1);
      expect(body.netWorth).toBe(6000);
      expect(body.accounts[0].name).toBe('Nubank Principal');
    });
  });

  describe('PATCH /api/accounts/:id', () => {
    it('deve retornar 401 se não autenticado', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/accounts/${testAccountId}`,
        payload: { name: 'Novo Nome' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 400 se id da conta for malformado', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/accounts/id-invalido-123',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Novo Nome' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 400 se o corpo estiver vazio', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/accounts/${testAccountId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 404 se conta não for encontrada ou pertencer a outro usuário', async () => {
      vi.spyOn(AccountService, 'updateAccount').mockRejectedValueOnce(
        new AccountNotFoundError('Conta não encontrada ou acesso não autorizado.')
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/accounts/${testAccountId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Novo Nome' },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.statusCode).toBe(404);
    });

    it('deve retornar 409 se novo nome já estiver em uso por outra conta do usuário', async () => {
      vi.spyOn(AccountService, 'updateAccount').mockRejectedValueOnce(
        new AccountConflictError('Já existe uma conta com o nome "Nubank Antigo".')
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/accounts/${testAccountId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Nubank Antigo' },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.statusCode).toBe(409);
    });

    it('deve atualizar com sucesso e retornar 200 OK com os dados atualizados', async () => {
      const mockUpdated: any = {
        id: testAccountId,
        userId: testUserId,
        name: 'Nubank Reserva',
        type: 'CHECKING',
        initialBalance: 2000,
        institution: 'Nu Pagamentos',
        color: '#820AD1',
        balance: 2000,
        transactionCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.spyOn(AccountService, 'updateAccount').mockResolvedValueOnce(mockUpdated);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/accounts/${testAccountId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Nubank Reserva',
          initialBalance: 2000,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.name).toBe('Nubank Reserva');
      expect(body.initialBalance).toBe(2000);
    });
  });

  describe('DELETE /api/accounts/:id', () => {
    it('deve retornar 401 se não autenticado', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/accounts/${testAccountId}`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 400 se id da conta for malformado', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/accounts/id-invalido-123',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 404 se conta não existir ou pertencer a outro usuário', async () => {
      vi.spyOn(AccountService, 'deleteAccount').mockRejectedValueOnce(
        new AccountNotFoundError('Conta não encontrada ou acesso não autorizado.')
      );

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/accounts/${testAccountId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.statusCode).toBe(404);
    });

    it('deve retornar 400 se for a única conta restante do usuário', async () => {
      vi.spyOn(AccountService, 'deleteAccount').mockRejectedValueOnce(
        new AccountBadRequestError('Não é permitido excluir a única conta ativa do usuário.')
      );

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/accounts/${testAccountId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('única conta ativa');
    });

    it('deve retornar 409 Conflict se houver transações e cascade=false', async () => {
      vi.spyOn(AccountService, 'deleteAccount').mockRejectedValueOnce(
        new AccountConflictError(
          'A conta possui 3 transações vinculadas. Para excluir a conta juntamente com todas as suas transações, utilize ?cascade=true.'
        )
      );

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/accounts/${testAccountId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.statusCode).toBe(409);
      expect(body.message).toContain('?cascade=true');
    });

    it('deve retornar 204 No Content se conta não possuir transações vinculadas', async () => {
      vi.spyOn(AccountService, 'deleteAccount').mockResolvedValueOnce({
        deletedCount: 1,
        transactionsDeleted: 0,
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/accounts/${testAccountId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(204);
    });

    it('deve retornar 200 OK com contagem de transações deletadas quando cascade=true', async () => {
      vi.spyOn(AccountService, 'deleteAccount').mockResolvedValueOnce({
        deletedCount: 1,
        transactionsDeleted: 5,
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/accounts/${testAccountId}?cascade=true`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.deletedCount).toBe(1);
      expect(body.transactionsDeleted).toBe(5);
    });
  });
});
