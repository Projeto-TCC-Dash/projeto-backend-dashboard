import { describe, expect, it, vi } from 'vitest';
import { FiscalDossierExportService } from '../../src/services/fiscal-dossier-export.service.js';

describe('FiscalDossierExportService Unit Tests', () => {
  const mockUser = {
    id: '507f1f77bcf86cd799439011',
    email: 'contribuinte@exemplo.com',
    name: 'Dr. Contribuinte Teste',
  };

  const mockSummary = {
    year: '2026',
    totalDeductibleExpenses: 3450.5,
    confirmedDeductibleExpenses: 2500,
    pendingDocumentationExpenses: 950.5,
    byCategory: [
      {
        taxCategory: 'HEALTH' as const,
        totalAmount: 2500,
        confirmedAmount: 2500,
        pendingAmount: 0,
        count: 2,
      },
      {
        taxCategory: 'EDUCATION' as const,
        totalAmount: 950.5,
        confirmedAmount: 0,
        pendingAmount: 950.5,
        count: 1,
      },
    ],
    pjSummary: {
      applicable: true,
      grossRevenueYearToDate: 65000,
      annualLimit: 81000,
      ceilingPercentage: 80.2,
      proLaboreTotal: 10000,
      dividendsTotal: 20000,
    },
  };

  const mockRecords = [
    {
      date: new Date('2026-05-10T00:00:00Z'),
      description: 'CONSULTA CARDIOLOGICA',
      taxCategory: 'HEALTH',
      providerName: 'Clínica Cardio',
      providerDocument: '12345678000195',
      deductibleAmount: 1500,
      status: 'CONFIRMED',
    },
    {
      date: new Date('2026-06-15T00:00:00Z'),
      description: 'EXAME LABORATORIAL',
      taxCategory: 'HEALTH',
      providerName: 'Laboratório Central',
      providerDocument: '98765432000188',
      deductibleAmount: 1000,
      status: 'CONFIRMED',
    },
    {
      date: new Date('2026-08-20T00:00:00Z'),
      description: 'POS-GRADUACAO IA',
      taxCategory: 'EDUCATION',
      providerName: 'Instituto Educacional',
      providerDocument: '11223344000155',
      deductibleAmount: 950.5,
      status: 'PENDING',
    },
  ];

  it('deve formatar valores monetários em padrão BRL', () => {
    expect(FiscalDossierExportService.formatCurrencyBR(1250.5)).toBe('R$ 1.250,50');
    expect(FiscalDossierExportService.formatCurrencyBR(-45)).toBe('-R$ 45,00');
  });

  it('deve formatar CPF e CNPJ adequadamente', () => {
    expect(FiscalDossierExportService.formatCpfCnpj('12345678901')).toBe('123.456.789-01');
    expect(FiscalDossierExportService.formatCpfCnpj('12345678000195')).toBe('12.345.678/0001-95');
    expect(FiscalDossierExportService.formatCpfCnpj()).toBe('-');
  });

  it('deve gerar Buffer válido de PDF contendo assinatura PDF-1.4', async () => {
    const pdfBuffer = await FiscalDossierExportService.generate(
      mockUser,
      mockSummary,
      mockRecords,
      'pdf'
    );

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(500);
    expect(pdfBuffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('deve gerar Buffer válido de XLSX contendo assinatura PK de ZIP/OpenXML', async () => {
    const xlsxBuffer = await FiscalDossierExportService.generate(
      mockUser,
      mockSummary,
      mockRecords,
      'xlsx'
    );

    expect(Buffer.isBuffer(xlsxBuffer)).toBe(true);
    expect(xlsxBuffer.length).toBeGreaterThan(500);
    // Assinatura PK do cabeçalho zip/xlsx
    expect(xlsxBuffer.subarray(0, 2).toString()).toBe('PK');
  });

  it('deve usar horário de Brasília (America/Sao_Paulo) e gerar PDF vazio com exatamente 1 página', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-25T17:16:34.000Z'));

    try {
      const toLocaleSpy = vi.spyOn(Date.prototype, 'toLocaleString');
      const pdfBuffer = await FiscalDossierExportService.generate(
        mockUser,
        {
          ...mockSummary,
          totalDeductibleExpenses: 0,
          confirmedDeductibleExpenses: 0,
          pendingDocumentationExpenses: 0,
          byCategory: [],
        },
        [],
        'pdf'
      );

      expect(toLocaleSpy).toHaveBeenCalledWith('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      });
      const pdfText = pdfBuffer.toString('latin1');
      const pageMatches = pdfText.match(/\/Type\s*\/Page\b(?!s)/g) ?? [];
      expect(pageMatches).toHaveLength(1);
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });
});
