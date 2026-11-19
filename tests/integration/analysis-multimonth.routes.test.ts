import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { AnalysisService } from '../../src/services/analysis.service.js';

describe('Multi-Month Analysis Route Integration Tests', () => {
  const app = buildApp();
  const testUserId = new mongoose.Types.ObjectId().toString();
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({ id: testUserId, email: 'multimonth.teste@exemplo.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/analysis/multi-month deve retornar 401 se não autenticado', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analysis/multi-month',
    });

    expect(res.statusCode).toBe(401);
  });

  it('GET /api/analysis/multi-month deve retornar 400 se o range for inválido', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analysis/multi-month?range=5', // apenas 3, 6, 12 permitidos
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('GET /api/analysis/multi-month deve retornar 200 com a análise histórica consolidada', async () => {
    vi.spyOn(AnalysisService, 'getMultiMonthSummary').mockResolvedValueOnce({
      rangeMonths: 6,
      averageSavingsRate: 22.5,
      averageMonthlyExpenses: 5500,
      averageMonthlyIncome: 7100,
      fixedCostTrend: {
        status: 'STABLE',
        percentageChange: 4.2,
      },
      monthlyHistory: [
        {
          month: '2026-06',
          totalIncome: 7000,
          totalExpenses: 5400,
          netBalance: 1600,
          savingsRate: 22.8,
        },
        {
          month: '2026-07',
          totalIncome: 7200,
          totalExpenses: 5600,
          netBalance: 1600,
          savingsRate: 22.2,
        },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/analysis/multi-month?range=6',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.rangeMonths).toBe(6);
    expect(body.averageSavingsRate).toBe(22.5);
    expect(body.fixedCostTrend.status).toBe('STABLE');
    expect(body.monthlyHistory).toHaveLength(2);
  });
});
