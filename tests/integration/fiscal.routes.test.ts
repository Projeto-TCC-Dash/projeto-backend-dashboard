import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { FiscalService } from '../../src/services/fiscal.service.js';

describe('Fiscal Routes Integration Tests', () => {
  const app = buildApp();
  const testUserId = new mongoose.Types.ObjectId().toString();
  const testTransactionId = new mongoose.Types.ObjectId().toString();
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({ id: testUserId, email: 'fiscal.teste@exemplo.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('PATCH /api/transactions/:id/fiscal', () => {
    it('deve retornar 401 se a requisição não contiver token JWT', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/transactions/${testTransactionId}/fiscal`,
        payload: { isTaxDeductible: true },
      });

      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 400 se id da transação for inválido', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/transactions/invalid-id/fiscal',
        headers: { authorization: `Bearer ${token}` },
        payload: { isTaxDeductible: true },
      });

      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 404 se a transação não for encontrada', async () => {
      vi.spyOn(FiscalService, 'updateTransactionFiscal').mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/transactions/${testTransactionId}/fiscal`,
        headers: { authorization: `Bearer ${token}` },
        payload: { isTaxDeductible: true, taxCategory: 'HEALTH' },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('Transação não encontrada');
    });

    it('deve retornar 200 com os dados atualizados ao classificar despesa dedutível', async () => {
      const mockUpdated: any = {
        _id: new mongoose.Types.ObjectId(testTransactionId),
        amount: -850,
        cleanDescription: 'HOSPITAL SAO LUIZ',
        fiscal: {
          isTaxDeductible: true,
          taxCategory: 'HEALTH',
          providerDocument: '12345678000195',
          providerName: 'Hospital São Luiz',
          deductibleAmount: 850,
          status: 'CONFIRMED',
          notes: 'Consulta médica',
        },
      };

      vi.spyOn(FiscalService, 'updateTransactionFiscal').mockResolvedValueOnce(mockUpdated);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/transactions/${testTransactionId}/fiscal`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          isTaxDeductible: true,
          taxCategory: 'HEALTH',
          providerDocument: '12345678000195',
          providerName: 'Hospital São Luiz',
          deductibleAmount: 850,
          status: 'CONFIRMED',
          notes: 'Consulta médica',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(testTransactionId);
      expect(body.fiscal.isTaxDeductible).toBe(true);
      expect(body.fiscal.taxCategory).toBe('HEALTH');
      expect(body.fiscal.providerDocument).toBe('12345678000195');
      expect(body.fiscal.status).toBe('CONFIRMED');
    });
  });

  describe('GET /api/fiscal/summary', () => {
    it('deve retornar 401 se a requisição não contiver token JWT', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/fiscal/summary?year=2026',
      });

      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 400 se o ano não for informado ou for inválido', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/fiscal/summary?year=26',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 200 com o consolidado anual de despesas dedutíveis', async () => {
      vi.spyOn(FiscalService, 'getAnnualSummary').mockResolvedValueOnce({
        year: '2026',
        totalDeductibleExpenses: 3500,
        confirmedDeductibleExpenses: 2500,
        pendingDocumentationExpenses: 1000,
        byCategory: [
          {
            taxCategory: 'HEALTH',
            totalAmount: 2500,
            confirmedAmount: 2500,
            pendingAmount: 0,
            count: 3,
          },
          {
            taxCategory: 'EDUCATION',
            totalAmount: 1000,
            confirmedAmount: 0,
            pendingAmount: 1000,
            count: 1,
          },
        ],
        pjSummary: {
          applicable: false,
          grossRevenueYearToDate: 0,
          annualLimit: 81000,
          ceilingPercentage: 0,
          proLaboreTotal: 0,
          dividendsTotal: 0,
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/fiscal/summary?year=2026',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.year).toBe('2026');
      expect(body.totalDeductibleExpenses).toBe(3500);
      expect(body.confirmedDeductibleExpenses).toBe(2500);
      expect(body.byCategory).toHaveLength(2);
    });
  });
});
