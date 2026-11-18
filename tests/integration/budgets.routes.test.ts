import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { BudgetNotFoundError, BudgetService } from '../../src/services/budget.service.js';

describe('Budgets Routes Integration Tests', () => {
  const app = buildApp();
  const testUserId = new mongoose.Types.ObjectId().toString();
  const month = '2026-11';
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({ id: testUserId, email: 'budget.teste@exemplo.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/budgets/:month', () => {
    it('deve retornar 401 se não autenticado', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/budgets/${month}`,
      });

      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 400 se o mês for malformado', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/budgets/2026-1',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 404 se não houver orçamento para o mês', async () => {
      vi.spyOn(BudgetService, 'getBudgetOverview').mockRejectedValueOnce(
        new BudgetNotFoundError()
      );

      const res = await app.inject({
        method: 'GET',
        url: `/api/budgets/${month}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('Nenhum orçamento configurado');
    });

    it('deve retornar 200 com a visão detalhada de consumo do orçamento', async () => {
      vi.spyOn(BudgetService, 'getBudgetOverview').mockResolvedValueOnce({
        month,
        totalLimitAmount: 5000,
        totalSpentAmount: 3800,
        totalRemainingAmount: 1200,
        globalPercentConsumed: 76,
        globalStatus: 'WARNING',
        categories: [
          {
            category: 'Alimentação',
            limitAmount: 2000,
            spentAmount: 1900,
            remainingAmount: 100,
            percentConsumed: 95,
            status: 'WARNING',
          },
          {
            category: 'Transporte',
            limitAmount: 1000,
            spentAmount: 400,
            remainingAmount: 600,
            percentConsumed: 40,
            status: 'REGULAR',
          },
        ],
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/budgets/${month}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.month).toBe(month);
      expect(body.totalLimitAmount).toBe(5000);
      expect(body.globalStatus).toBe('WARNING');
      expect(body.categories).toHaveLength(2);
    });
  });

  describe('PUT /api/budgets/:month', () => {
    it('deve retornar 401 se não autenticado', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/budgets/${month}`,
        payload: {
          totalLimitAmount: 4000,
          categoryBudgets: [{ category: 'Alimentação', limitAmount: 2000 }],
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 400 se o corpo for inválido', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/budgets/${month}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          totalLimitAmount: -500, // negativo
          categoryBudgets: [],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 200 ao configurar o orçamento com sucesso', async () => {
      vi.spyOn(BudgetService, 'upsertBudgetPlan').mockResolvedValueOnce({
        month,
        totalLimitAmount: 4000,
        totalSpentAmount: 1000,
        totalRemainingAmount: 3000,
        globalPercentConsumed: 25,
        globalStatus: 'REGULAR',
        categories: [
          {
            category: 'Alimentação',
            limitAmount: 2000,
            spentAmount: 800,
            remainingAmount: 1200,
            percentConsumed: 40,
            status: 'REGULAR',
          },
        ],
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/budgets/${month}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          totalLimitAmount: 4000,
          categoryBudgets: [{ category: 'Alimentação', limitAmount: 2000 }],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.totalLimitAmount).toBe(4000);
      expect(body.globalStatus).toBe('REGULAR');
    });
  });
});
