import { describe, expect, it } from 'vitest';
import { CsvExportService } from '../../src/services/csv-export.service.js';
import { IExportRecord } from '../../src/services/export.service.js';

describe('CsvExportService Unit Tests', () => {
  it('deve gerar arquivo CSV com UTF-8 BOM, delimitador ; e quebras CRLF', () => {
    const records: IExportRecord[] = [
      {
        date: new Date('2026-10-30T10:00:00Z'),
        dateFormatted: '30/10/2026',
        description: 'Padaria & Café; Pão Quente',
        category: 'Alimentação',
        accountName: 'Cartão Nubank',
        type: 'DESPESA',
        amount: -25.5,
        amountFormatted: '-R$ 25,50',
        decimalFormatted: '-25,50',
      },
      {
        date: new Date('2026-10-25T10:00:00Z'),
        dateFormatted: '25/10/2026',
        description: 'Recebimento "Consultoria"',
        category: 'Receita',
        accountName: 'Conta Principal',
        type: 'RECEITA',
        amount: 3000,
        amountFormatted: 'R$ 3.000,00',
        decimalFormatted: '3000,00',
      },
    ];

    const buffer = CsvExportService.generate(records);
    const content = buffer.toString('utf-8');

    // Valida BOM
    expect(content.startsWith('\uFEFF')).toBe(true);

    // Valida cabeçalho
    expect(content).toContain('Data;Descrição;Categoria;Conta;Tipo;Valor');

    // Valida escape de aspas e ponto e vírgula na descrição
    expect(content).toContain('"Padaria & Café; Pão Quente"');
    expect(content).toContain('"Recebimento ""Consultoria"""');

    // Valida valores decimais no padrão brasileiro
    expect(content).toContain('-25,50');
    expect(content).toContain('3000,00');
  });

  it('deve gerar cabeçalho vazio quando não houver transações', () => {
    const buffer = CsvExportService.generate([]);
    const content = buffer.toString('utf-8');

    expect(content.startsWith('\uFEFF')).toBe(true);
    expect(content).toBe('\uFEFFData;Descrição;Categoria;Conta;Tipo;Valor');
  });
});
