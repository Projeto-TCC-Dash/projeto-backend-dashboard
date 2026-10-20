import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { UserService, UserNotFoundError } from '../../src/services/user.service.js';

describe('User Profile Routes (HTTP Inject & Contracts)', () => {
  const app = buildApp();
  const testUserId = '507f1f77bcf86cd799439011';
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({ id: testUserId, email: 'perfil@exemplo.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/user/profile', () => {
    it('deve retornar 401 se a requisição não contiver token JWT', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/user/profile',
      });
      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 200 com os dados do perfil do usuário autenticado', async () => {
      vi.spyOn(UserService, 'getProfile').mockResolvedValueOnce({
        id: testUserId,
        email: 'perfil@exemplo.com',
        hasAiKey: true,
        financialProfile: {
          incomeType: 'PJ_AUTONOMO',
          declaredMonthlyIncome: 8500,
          goals: ['RESERVA_EMERGENCIA'],
          riskProfile: 'MODERATE',
          updatedAt: new Date('2026-10-19T10:00:00Z'),
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(testUserId);
      expect(body.email).toBe('perfil@exemplo.com');
      expect(body.hasAiKey).toBe(true);
      expect(body.financialProfile.incomeType).toBe('PJ_AUTONOMO');
      expect(body.financialProfile.declaredMonthlyIncome).toBe(8500);
    });

    it('deve retornar 404 se o usuário não for encontrado', async () => {
      vi.spyOn(UserService, 'getProfile').mockRejectedValueOnce(
        new UserNotFoundError('Usuário não encontrado.')
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/user/profile', () => {
    it('deve retornar 401 se a requisição não contiver token JWT', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/user/profile',
        payload: { incomeType: 'CLT' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 400 se a renda declarada for negativa', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
        payload: { declaredMonthlyIncome: -500 },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.statusCode).toBe(400);
      expect(body.error).toBe('Bad Request');
    });

    it('deve retornar 400 se o regime de renda for um enum inválido', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
        payload: { incomeType: 'REGIME_INEXISTENTE' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 400 se o perfil de risco for um enum inválido', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
        payload: { riskProfile: 'SUPER_RISK' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 400 se uma meta financeira for inválida', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
        payload: { goals: ['COMPRAR_FOGUETE'] },
      });

      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 200 e o perfil atualizado quando o payload for válido', async () => {
      vi.spyOn(UserService, 'updateFinancialProfile').mockResolvedValueOnce({
        id: testUserId,
        email: 'perfil@exemplo.com',
        hasAiKey: false,
        financialProfile: {
          incomeType: 'CLT',
          declaredMonthlyIncome: 6500,
          goals: ['RESERVA_EMERGENCIA', 'QUITAR_DIVIDAS'],
          riskProfile: 'CONSERVATIVE',
          updatedAt: new Date('2026-10-19T21:00:00Z'),
        },
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          incomeType: 'CLT',
          declaredMonthlyIncome: 6500,
          goals: ['RESERVA_EMERGENCIA', 'QUITAR_DIVIDAS'],
          riskProfile: 'CONSERVATIVE',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(testUserId);
      expect(body.financialProfile.incomeType).toBe('CLT');
      expect(body.financialProfile.goals).toEqual(['RESERVA_EMERGENCIA', 'QUITAR_DIVIDAS']);
    });
  });
});
