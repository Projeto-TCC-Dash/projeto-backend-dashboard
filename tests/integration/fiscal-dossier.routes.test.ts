import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { UserModel } from '../../src/models/user.model.js';
import { FiscalDossierExportService } from '../../src/services/fiscal-dossier-export.service.js';
import { FiscalService } from '../../src/services/fiscal.service.js';

describe('Fiscal Dossier Routes Integration Tests (GET /api/fiscal/dossier)', () => {
  const app = buildApp();
  const testUserId = new mongoose.Types.ObjectId().toString();
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({ id: testUserId, email: 'fiscal.dossier@exemplo.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(UserModel, 'findById').mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        _id: new mongoose.Types.ObjectId(testUserId),
        email: 'fiscal.dossier@exemplo.com',
        name: 'Usuário Fiscal Teste',
      }),
    } as any);

    vi.spyOn(FiscalService, 'getDossierRecords').mockResolvedValue([]);
  });

  it('deve retornar 401 caso não haja autenticação JWT', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fiscal/dossier?year=2026&format=pdf',
    });

    expect(res.statusCode).toBe(401);
  });

  it('deve retornar 400 se o ano informado for inválido', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fiscal/dossier?year=26&format=pdf',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('deve retornar 400 se o formato for inválido (não suportado)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fiscal/dossier?year=2026&format=doc',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('deve exportar dossiê fiscal em formato PDF com headers corretos', async () => {
    const mockPdfBuffer = Buffer.from('%PDF-1.4 mock content');
    vi.spyOn(FiscalService, 'getAnnualSummary').mockResolvedValueOnce({
      year: '2026',
      totalDeductibleExpenses: 2500,
      confirmedDeductibleExpenses: 2500,
      pendingDocumentationExpenses: 0,
      byCategory: [
        {
          taxCategory: 'HEALTH',
          totalAmount: 2500,
          confirmedAmount: 2500,
          pendingAmount: 0,
          count: 2,
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

    vi.spyOn(FiscalDossierExportService, 'generate').mockResolvedValueOnce(mockPdfBuffer);

    const res = await app.inject({
      method: 'GET',
      url: '/api/fiscal/dossier?year=2026&format=pdf',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="dossie-fiscal-2026.pdf"');
    expect(res.rawPayload).toEqual(mockPdfBuffer);
  });

  it('deve exportar dossiê fiscal em formato XLSX com headers corretos', async () => {
    const mockXlsxBuffer = Buffer.from('mock xlsx binary payload');
    vi.spyOn(FiscalService, 'getAnnualSummary').mockResolvedValueOnce({
      year: '2026',
      totalDeductibleExpenses: 1200,
      confirmedDeductibleExpenses: 800,
      pendingDocumentationExpenses: 400,
      byCategory: [],
      pjSummary: {
        applicable: true,
        grossRevenueYearToDate: 60000,
        annualLimit: 81000,
        ceilingPercentage: 74.1,
        proLaboreTotal: 12000,
        dividendsTotal: 25000,
      },
    });

    vi.spyOn(FiscalDossierExportService, 'generate').mockResolvedValueOnce(mockXlsxBuffer);

    const res = await app.inject({
      method: 'GET',
      url: '/api/fiscal/dossier?year=2026&format=xlsx',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(res.headers['content-disposition']).toBe('attachment; filename="dossie-fiscal-2026.xlsx"');
    expect(res.rawPayload).toEqual(mockXlsxBuffer);
  });
});
