import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { IExportRecord, IExportSummaryMetrics } from '../../src/services/export.service.js';
import { XlsxExportService } from '../../src/services/xlsx-export.service.js';

describe('XlsxExportService Unit Tests', () => {
  it('deve gerar planilha Excel válida com formatações e dados corretos', async () => {
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
      {
        date: new Date('2026-10-20T10:00:00Z'),
        dateFormatted: '20/10/2026',
        description: 'Salário',
        category: 'Receita',
        accountName: 'Conta Corrente',
        type: 'RECEITA',
        amount: 6000,
        amountFormatted: 'R$ 6.000,00',
        decimalFormatted: '6000,00',
      },
    ];

    const metrics: IExportSummaryMetrics = {
      totalCount: 2,
      totalIncome: 6000,
      totalExpenses: 180.5,
      netBalance: 5819.5,
      periodLabel: '10/2026',
      generatedAt: new Date('2026-10-30T12:00:00Z'),
    };

    const buffer = await XlsxExportService.generate(records, metrics);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // Validação de integridade lendo de volta com o ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheet = workbook.getWorksheet('Extrato Financeiro');
    expect(sheet).toBeDefined();

    // Valida título e sumário
    expect(sheet?.getCell('A1').value).toBe('Extrato Financeiro de Lançamentos');
    expect(sheet?.getCell('B4').value).toBe(6000);
    expect(sheet?.getCell('D4').value).toBe(180.5);

    // Valida cabeçalho de dados na linha 6
    expect(sheet?.getRow(6).values).toContain('Descrição');
    expect(sheet?.getRow(6).values).toContain('Valor (R$)');

    // Valida primeira linha de dados na linha 7
    const firstDataRow = sheet?.getRow(7);
    expect(firstDataRow?.getCell(2).value).toBe('Supermercado Central');
    expect(firstDataRow?.getCell(6).value).toBe(-180.5);
    expect(firstDataRow?.getCell(6).numFmt).toContain('R$');
  });
});
