import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { InvestmentService } from '../../src/services/investment.service.js';

describe('Investments Routes Integration Tests', () => {
  const app = buildApp();
  const testUserId = new mongoose.Types.ObjectId().toString();
  const testAccountId = new mongoose.Types.ObjectId().toString();
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({ id: testUserId, email: 'invest.teste@exemplo.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/investments/holdings', () => {
    it('deve retornar 401 se não autenticado', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/investments/holdings',
      });

      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 200 com a distribuição patrimonial e recomendações de risco', async () => {
      vi.spyOn(InvestmentService, 'getPortfolioSummary').mockResolvedValueOnce({
        totalInvested: 80000,
        riskProfile: 'MODERATE',
        holdings: [
          { macroClass: 'FIXED_INCOME', amount: 50000, percentage: 62.5 },
          { macroClass: 'EQUITIES', amount: 30000, percentage: 37.5 },
        ],
        allocationDiagnosis: {
          adherentToRiskProfile: true,
          recommendations: ['Carteira equilibrada para o perfil Moderado.'],
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/investments/holdings',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.totalInvested).toBe(80000);
      expect(body.riskProfile).toBe('MODERATE');
      expect(body.allocationDiagnosis.adherentToRiskProfile).toBe(true);
      expect(body.holdings).toHaveLength(2);
    });
  });

  describe('PUT /api/investments/holdings', () => {
    it('deve retornar 401 se não autenticado', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/investments/holdings',
        payload: {
          accountId: testAccountId,
          macroClass: 'FIXED_INCOME',
          amount: 25000,
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 400 se o corpo for inválido', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/investments/holdings',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          accountId: 'invalid-id',
          macroClass: 'FIXED_INCOME',
          amount: -100, // negativo
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 404 se a conta de investimentos não for encontrada', async () => {
      vi.spyOn(InvestmentService, 'upsertHolding').mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'PUT',
        url: '/api/investments/holdings',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          accountId: testAccountId,
          macroClass: 'FIXED_INCOME',
          amount: 25000,
        },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('Conta de investimentos');
    });

    it('deve retornar 200 ao atualizar a alocação patrimonial', async () => {
      vi.spyOn(InvestmentService, 'upsertHolding').mockResolvedValueOnce({
        totalInvested: 25000,
        riskProfile: 'CONSERVATIVE',
        holdings: [{ macroClass: 'FIXED_INCOME', amount: 25000, percentage: 100 }],
        allocationDiagnosis: {
          adherentToRiskProfile: true,
          recommendations: ['Alocação 100% conservadora.'],
        },
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/investments/holdings',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          accountId: testAccountId,
          macroClass: 'FIXED_INCOME',
          amount: 25000,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.totalInvested).toBe(25000);
      expect(body.holdings[0].percentage).toBe(100);
    });
  });
});
