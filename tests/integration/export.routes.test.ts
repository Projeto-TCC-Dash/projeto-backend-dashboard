import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { buildApp } from '../../src/app.js';
import { AccountAccessDeniedError, ExportService, IExportDataResult } from '../../src/services/export.service.js';
import { SessionService } from '../../src/services/session.service.js';

describe('Export Routes Integration Tests (GET /api/transactions/export)', () => {
  const app = buildApp();
  const testUserId = new Types.ObjectId().toString();
  const testSessionId = '123e4567-e89b-12d3-a456-426614174000';
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({
      id: testUserId,
      email: 'investidor@exemplo.com',
      sessionId: testSessionId,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(SessionService, 'isSessionActive').mockResolvedValue(true);
  });

  const mockExportData: IExportDataResult = {
    user: {
      id: testUserId,
      email: 'investidor@exemplo.com',
      name: 'Investidor Teste',
    },
    records: [
      {
        date: new Date('2026-10-30T10:00:00Z'),
        dateFormatted: '30/10/2026',
        description: 'Supermercado Central',
        category: 'Alimentação',
        accountName: 'Cartão de Crédito',
        type: 'DESPESA',
        amount: -180.5,
        amountFormatted: '-R$ 180,50',
        decimalFormatted: '-180,50',
      },
      {
        date: new Date('2026-10-20T10:00:00Z'),
        dateFormatted: '20/10/2026',
        description: 'Salário',
        category: 'Receita',
        accountName: 'Conta Principal',
        type: 'RECEITA',
        amount: 5000,
        amountFormatted: 'R$ 5.000,00',
        decimalFormatted: '5000,00',
      },
    ],
    metrics: {
      totalCount: 2,
      totalIncome: 5000,
      totalExpenses: 180.5,
      netBalance: 4819.5,
      periodLabel: '10/2026',
      generatedAt: new Date('2026-10-30T12:00:00Z'),
    },
    filenamePeriod: '2026-10',
  };

  it('deve retornar 401 Unauthorized se requisição não for autenticada', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/transactions/export?format=csv',
    });
    expect(res.statusCode).toBe(401);
  });

  it('deve retornar 400 Bad Request se format for omitido', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/transactions/export',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('deve retornar 400 Bad Request se startDate for posterior a endDate', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/transactions/export?format=csv&startDate=2026-10-30&endDate=2026-10-01',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Falha na validação dos dados de entrada.');
  });

  it('deve exportar com sucesso em CSV (status 200, Content-Type text/csv e UTF-8 BOM)', async () => {
    vi.spyOn(ExportService, 'getExportData').mockResolvedValueOnce(mockExportData);

    const res = await app.inject({
      method: 'GET',
      url: '/api/transactions/export?format=csv&month=2026-10',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('extrato-2026-10.csv');

    // Valida BOM e conteúdo CSV
    expect(res.rawPayload.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const bodyText = res.body;
    expect(bodyText).toContain('Data;Descrição;Categoria;Conta;Tipo;Valor');
    expect(bodyText).toContain('Supermercado Central');
    expect(bodyText).toContain('-180,50');
  });

  it('deve exportar com sucesso em XLSX (status 200, Content-Type vnd.openxmlformats)', async () => {
    vi.spyOn(ExportService, 'getExportData').mockResolvedValueOnce(mockExportData);

    const res = await app.inject({
      method: 'GET',
      url: '/api/transactions/export?format=xlsx&month=2026-10',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toContain('extrato-2026-10.xlsx');
    expect(res.rawPayload.length).toBeGreaterThan(1000);
  });

  it('deve exportar com sucesso em PDF (status 200, Content-Type application/pdf)', async () => {
    vi.spyOn(ExportService, 'getExportData').mockResolvedValueOnce(mockExportData);

    const res = await app.inject({
      method: 'GET',
      url: '/api/transactions/export?format=pdf&month=2026-10',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('relatorio-financeiro-2026-10.pdf');
    expect(res.rawPayload.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
  });

  it('deve retornar 404 Not Found se accountId pertencer a outro usuário ou for inexistente', async () => {
    vi.spyOn(ExportService, 'getExportData').mockRejectedValueOnce(new AccountAccessDeniedError());

    const res = await app.inject({
      method: 'GET',
      url: `/api/transactions/export?format=csv&accountId=${new Types.ObjectId().toString()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Conta bancária informada não encontrada');
  });
});
