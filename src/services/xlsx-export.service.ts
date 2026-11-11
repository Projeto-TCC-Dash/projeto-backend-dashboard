import ExcelJS from 'exceljs';
import { IExportRecord, IExportSummaryMetrics } from './export.service.js';

export class XlsxExportService {
  /**
   * Gera o Buffer do arquivo de planilha eletrônica XLSX formatado com estilos e numFmt.
   */
  public static async generate(
    records: IExportRecord[],
    metrics: IExportSummaryMetrics
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Plataforma Financeira Inteligente';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Extrato Financeiro', {
      views: [{ showGridLines: true }],
    });

    // 1. Título e Metadados do Relatório
    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Extrato Financeiro de Lançamentos';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(1).height = 28;

    sheet.mergeCells('A2:F2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `Período: ${metrics.periodLabel}  |  Gerado em: ${metrics.generatedAt.toLocaleString('pt-BR')}`;
    subtitleCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(2).height = 18;

    // 2. Tabela de Sumário de Indicadores (KPIs)
    sheet.getCell('A4').value = 'Total Receitas:';
    sheet.getCell('A4').font = { bold: true, color: { argb: 'FF16A34A' } };
    sheet.getCell('B4').value = metrics.totalIncome;
    sheet.getCell('B4').numFmt = '"R$" #,##0.00';
    sheet.getCell('B4').font = { bold: true };

    sheet.getCell('C4').value = 'Total Despesas:';
    sheet.getCell('C4').font = { bold: true, color: { argb: 'FFDC2626' } };
    sheet.getCell('D4').value = metrics.totalExpenses;
    sheet.getCell('D4').numFmt = '"R$" #,##0.00';
    sheet.getCell('D4').font = { bold: true };

    sheet.getCell('E4').value = 'Saldo Líquido:';
    sheet.getCell('E4').font = { bold: true, color: { argb: 'FF2563EB' } };
    sheet.getCell('F4').value = metrics.netBalance;
    sheet.getCell('F4').numFmt = '"R$" #,##0.00';
    sheet.getCell('F4').font = { bold: true };
    sheet.getRow(4).height = 20;

    // 3. Cabeçalhos da Tabela
    const headerRowNumber = 6;
    const headerRow = sheet.getRow(headerRowNumber);
    headerRow.values = ['Data', 'Descrição', 'Categoria', 'Conta', 'Tipo', 'Valor (R$)'];
    headerRow.height = 24;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' },
      };
      cell.font = {
        name: 'Arial',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    // 4. Preenchimento das Linhas de Transações
    let currentRow = headerRowNumber + 1;
    for (const rec of records) {
      const row = sheet.getRow(currentRow);
      row.values = [
        rec.date,
        rec.description,
        rec.category,
        rec.accountName,
        rec.type,
        rec.amount,
      ];
      row.height = 20;

      // Coluna Data
      row.getCell(1).numFmt = 'dd/mm/yyyy';
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      // Coluna Descrição
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

      // Coluna Categoria
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

      // Coluna Conta
      row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };

      // Coluna Tipo
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

      // Coluna Valor com numFmt numérico nativo
      const valueCell = row.getCell(6);
      valueCell.numFmt = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
      valueCell.alignment = { horizontal: 'right', vertical: 'middle' };

      // Linhas zebradas
      const isEven = currentRow % 2 === 0;
      row.eachCell((cell) => {
        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });

      currentRow++;
    }

    // 5. Ajuste Dinâmico da Largura das Colunas
    sheet.columns.forEach((column) => {
      let maxLen = 12;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const cellValue = cell.value ? cell.value.toString() : '';
        if (cellValue.length > maxLen) {
          maxLen = Math.min(cellValue.length, 50);
        }
      });
      column.width = maxLen + 4;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
