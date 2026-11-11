import { describe, expect, it } from 'vitest';
import { IExportRecord, IExportSummaryMetrics } from '../../src/services/export.service.js';
import { PdfExportService } from '../../src/services/pdf-export.service.js';

describe('PdfExportService Unit Tests', () => {
  it('deve gerar documento PDF válido como Buffer não vazio com cabeçalho e transações', async () => {
    const user = {
      id: '507f1f77bcf86cd799439011',
      email: 'investidor@teste.com',
      name: 'Investidor Teste',
    };

    const records: IExportRecord[] = [
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
    ];

    const metrics: IExportSummaryMetrics = {
      totalCount: 1,
      totalIncome: 0,
      totalExpenses: 180.5,
      netBalance: -180.5,
      periodLabel: '10/2026',
      generatedAt: new Date('2026-10-30T12:00:00Z'),
    };

    const buffer = await PdfExportService.generate(user, records, metrics);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // Valida magic bytes de cabeçalho PDF (%PDF-)
    const pdfHeader = buffer.subarray(0, 5).toString('utf-8');
    expect(pdfHeader).toBe('%PDF-');
  });

  it('deve gerar documento PDF válido mesmo sem transações (mensagem informativa)', async () => {
    const user = { id: '123', email: 'vazio@teste.com' };
    const metrics: IExportSummaryMetrics = {
      totalCount: 0,
      totalIncome: 0,
      totalExpenses: 0,
      netBalance: 0,
      periodLabel: '10/2026',
      generatedAt: new Date(),
    };

    const buffer = await PdfExportService.generate(user, [], metrics);
    expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
  });
});
