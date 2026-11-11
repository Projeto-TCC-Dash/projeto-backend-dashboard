import { IExportRecord } from './export.service.js';

export class CsvExportService {
  /**
   * Escapa valores de string para o padrão CSV (envolve com aspas e duplica aspas internas).
   */
  private static escapeCsvField(field: string): string {
    if (field.includes(';') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return `"${field}"`;
  }

  /**
   * Gera o Buffer do arquivo CSV codificado em UTF-8 com BOM e delimitador ';'.
   */
  public static generate(records: IExportRecord[]): Buffer {
    const BOM = '\uFEFF';
    const header = ['Data', 'Descrição', 'Categoria', 'Conta', 'Tipo', 'Valor'].join(';');

    const rows = records.map((rec) => {
      return [
        rec.dateFormatted,
        this.escapeCsvField(rec.description),
        this.escapeCsvField(rec.category),
        this.escapeCsvField(rec.accountName),
        rec.type,
        rec.decimalFormatted,
      ].join(';');
    });

    const csvContent = [BOM + header, ...rows].join('\r\n');
    return Buffer.from(csvContent, 'utf-8');
  }
}
