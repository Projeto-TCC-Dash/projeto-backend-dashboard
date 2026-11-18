import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { FiscalAnnualSummaryResponse } from '../schemas/fiscal.schemas.js';

export interface IFiscalUserData {
  id: string;
  email: string;
  name?: string;
}

export interface IFiscalDossierRecord {
  date: Date;
  description: string;
  taxCategory?: string;
  providerName?: string;
  providerDocument?: string;
  deductibleAmount: number;
  status: string;
}

export class FiscalDossierExportService {
  private static readonly LEGAL_DISCLAIMER =
    'AVISO LEGAL: Este dossiê fiscal atua exclusivamente como ferramenta de organização e planejamento financeiro-tributário pessoal/empresarial, não substituindo a escrituração contábil formal nem o parecer de um profissional de contabilidade legalmente habilitado.';

  /**
   * Formata número para moeda brasileira (ex: "R$ 1.250,50").
   */
  public static formatCurrencyBR(amount: number): string {
    const isNegative = amount < 0;
    const absVal = Math.abs(amount).toFixed(2);
    const [intPart, decPart] = absVal.split('.');
    const formattedInt = (intPart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const formattedVal = `${formattedInt},${decPart}`;
    return isNegative ? `-R$ ${formattedVal}` : `R$ ${formattedVal}`;
  }

  /**
   * Formata data para o formato brasileiro DD/MM/YYYY.
   */
  public static formatDateBR(date: Date): string {
    const d = new Date(date);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Formata CPF (11 dígitos) ou CNPJ (14 dígitos).
   */
  public static formatCpfCnpj(doc?: string): string {
    if (!doc) return '-';
    const cleaned = doc.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  }

  /**
   * Gera o Dossiê Fiscal no formato solicitado (PDF ou XLSX).
   */
  public static async generate(
    user: IFiscalUserData,
    summary: FiscalAnnualSummaryResponse,
    records: IFiscalDossierRecord[],
    format: 'pdf' | 'xlsx'
  ): Promise<Buffer> {
    if (format === 'pdf') {
      return this.generatePdf(user, summary, records);
    }
    return this.generateXlsx(user, summary, records);
  }

  /**
   * Gera o relatório PDF diagramado do Dossiê Fiscal Anual.
   */
  public static async generatePdf(
    user: IFiscalUserData,
    summary: FiscalAnnualSummaryResponse,
    records: IFiscalDossierRecord[]
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const primaryColor = '#0F172A';
      const secondaryColor = '#475569';
      const greenColor = '#16A34A';
      const amberColor = '#D97706';
      const blueColor = '#2563EB';

      // 1. Cabeçalho Institucional
      doc.rect(40, 40, 515, 65).fill('#F8FAFC');
      doc
        .fillColor(primaryColor)
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('DOSSIÊ FISCAL ANUAL', 55, 50);
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(secondaryColor)
        .text(`Exercício Base: ${summary.year}  |  Declaração de Ajuste Anual`, 55, 70);

      const titular = user.name ? `${user.name} (${user.email})` : user.email;
      doc
        .fontSize(8)
        .fillColor(secondaryColor)
        .text(`Contribuinte: ${titular}`, 310, 50, { align: 'right', width: 230 });
      doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, 310, 64, {
        align: 'right',
        width: 230,
      });
      doc.text('Auditoria Digital v2.1', 310, 78, { align: 'right', width: 230 });

      // 2. Disclaimer Legal (FR-014)
      let y = 115;
      doc.rect(40, y, 515, 30).fill('#FEF3C7');
      doc.strokeColor('#FDE68A').rect(40, y, 515, 30).stroke();
      doc
        .fillColor('#92400E')
        .fontSize(7)
        .font('Helvetica')
        .text(this.LEGAL_DISCLAIMER, 48, y + 6, { width: 500, align: 'justify' });

      // 3. KPIs de Deduções Fiscais
      y = 155;
      const cardWidth = 165;
      const cardHeight = 45;

      // Card Total Dedutível
      doc.rect(40, y, cardWidth, cardHeight).fill('#F0FDF4');
      doc.strokeColor('#BBF7D0').rect(40, y, cardWidth, cardHeight).stroke();
      doc.fillColor(greenColor).fontSize(8).font('Helvetica-Bold').text('TOTAL DEDUTÍVEL', 50, y + 8);
      doc.fontSize(12).text(this.formatCurrencyBR(summary.totalDeductibleExpenses), 50, y + 22);

      // Card Homologado / Confirmado
      doc.rect(215, y, cardWidth, cardHeight).fill('#EFF6FF');
      doc.strokeColor('#BFDBFE').rect(215, y, cardWidth, cardHeight).stroke();
      doc.fillColor(blueColor).fontSize(8).font('Helvetica-Bold').text('CONFIRMADO COM NOTA', 225, y + 8);
      doc.fontSize(12).text(this.formatCurrencyBR(summary.confirmedDeductibleExpenses), 225, y + 22);

      // Card Pendente Documentação
      doc.rect(390, y, cardWidth, cardHeight).fill('#FFFBEB');
      doc.strokeColor('#FDE68A').rect(390, y, cardWidth, cardHeight).stroke();
      doc.fillColor(amberColor).fontSize(8).font('Helvetica-Bold').text('PENDENTE COMPROVANTE', 400, y + 8);
      doc.fontSize(12).text(this.formatCurrencyBR(summary.pendingDocumentationExpenses), 400, y + 22);

      y = 210;

      // 4. Painel PJ / Autônomo (se aplicável)
      if (summary.pjSummary.applicable) {
        doc.rect(40, y, 515, 45).fill('#F8FAFC');
        doc.strokeColor('#E2E8F0').rect(40, y, 515, 45).stroke();
        doc
          .fillColor(primaryColor)
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('PAINEL FISCAL PJ / AUTÔNOMO', 50, y + 6);

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor(secondaryColor)
          .text(
            `Faturamento Bruto: ${this.formatCurrencyBR(summary.pjSummary.grossRevenueYearToDate)}  |  ` +
              `Teto MEI: ${this.formatCurrencyBR(summary.pjSummary.annualLimit)} (${summary.pjSummary.ceilingPercentage}% consumido)  |  ` +
              `Pró-Labore: ${this.formatCurrencyBR(summary.pjSummary.proLaboreTotal)}  |  ` +
              `Dividendos: ${this.formatCurrencyBR(summary.pjSummary.dividendsTotal)}`,
            50,
            y + 22
          );

        y += 55;
      }

      // 5. Tabela Detalhada de Deduções
      doc
        .fillColor(primaryColor)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Demonstrativo de Despesas Dedutíveis', 40, y);
      y += 18;

      // Cabeçalho da Tabela
      const tableHeaders = ['Data', 'Descrição / Prestador', 'Categoria', 'CPF/CNPJ', 'Status', 'Valor (R$)'];
      const colX = [40, 95, 230, 335, 420, 485];
      const colWidths = [50, 130, 100, 80, 60, 70];

      doc.rect(40, y, 515, 18).fill('#F1F5F9');
      doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold');
      tableHeaders.forEach((h, idx) => {
        doc.text(h, colX[idx], y + 5, { width: colWidths[idx], align: idx === 5 ? 'right' : 'left' });
      });

      y += 22;
      doc.font('Helvetica').fontSize(7);

      if (records.length === 0) {
        doc
          .fillColor(secondaryColor)
          .text('Nenhum lançamento dedutível registrado para este exercício.', 40, y + 10, {
            align: 'center',
            width: 515,
          });
      } else {
        for (const rec of records) {
          if (y > 750) {
            doc.addPage();
            y = 50;

            doc.rect(40, y, 515, 18).fill('#F1F5F9');
            doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold');
            tableHeaders.forEach((h, idx) => {
              doc.text(h, colX[idx], y + 5, { width: colWidths[idx], align: idx === 5 ? 'right' : 'left' });
            });
            y += 22;
            doc.font('Helvetica').fontSize(7);
          }

          const desc = rec.providerName ? `${rec.description} (${rec.providerName})` : rec.description;
          const statusText = rec.status === 'CONFIRMED' ? 'Confirmado' : 'Pendente';
          const statusColor = rec.status === 'CONFIRMED' ? greenColor : amberColor;

          doc.fillColor(secondaryColor).text(this.formatDateBR(rec.date), colX[0], y, { width: colWidths[0] });
          doc.fillColor(primaryColor).text(desc, colX[1], y, { width: colWidths[1], lineBreak: false });
          doc.fillColor(secondaryColor).text(rec.taxCategory || 'Geral', colX[2], y, { width: colWidths[2] });
          doc.fillColor(secondaryColor).text(this.formatCpfCnpj(rec.providerDocument), colX[3], y, { width: colWidths[3] });
          doc.fillColor(statusColor).text(statusText, colX[4], y, { width: colWidths[4] });
          doc
            .fillColor(primaryColor)
            .text(rec.deductibleAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), colX[5], y, {
              width: colWidths[5],
              align: 'right',
            });

          y += 16;
        }
      }

      // Rodapé com numeração de páginas
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(7)
          .fillColor(secondaryColor)
          .text(
            `Página ${i + 1} de ${range.count}  |  Plataforma Financeira Inteligente  |  Documento para fins de planejamento tributário`,
            40,
            800,
            { align: 'center', width: 515 }
          );
      }

      doc.end();
    });
  }

  /**
   * Gera o Dossiê Fiscal em formato XLSX com fórmulas e estilos padronizados.
   */
  public static async generateXlsx(
    user: IFiscalUserData,
    summary: FiscalAnnualSummaryResponse,
    records: IFiscalDossierRecord[]
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Plataforma Financeira Inteligente';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`Dossiê Fiscal ${summary.year}`, {
      views: [{ showGridLines: true }],
    });

    // 1. Título e Metadados
    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `Dossiê Fiscal Anual - Exercício ${summary.year}`;
    titleCell.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(1).height = 26;

    sheet.mergeCells('A2:G2');
    const subCell = sheet.getCell('A2');
    const titular = user.name ? `${user.name} (${user.email})` : user.email;
    subCell.value = `Contribuinte: ${titular}  |  Gerado em: ${new Date().toLocaleString('pt-BR')}`;
    subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(2).height = 18;

    // Disclaimer Legal
    sheet.mergeCells('A3:G3');
    const discCell = sheet.getCell('A3');
    discCell.value = this.LEGAL_DISCLAIMER;
    discCell.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FFB45309' } };
    discCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(3).height = 18;

    // 2. Sumário Executivo de Deduções
    sheet.getCell('A5').value = 'Total Dedutível:';
    sheet.getCell('A5').font = { bold: true, color: { argb: 'FF16A34A' } };
    sheet.getCell('B5').value = summary.totalDeductibleExpenses;
    sheet.getCell('B5').numFmt = '"R$" #,##0.00';
    sheet.getCell('B5').font = { bold: true };

    sheet.getCell('C5').value = 'Confirmado com Doc:';
    sheet.getCell('C5').font = { bold: true, color: { argb: 'FF2563EB' } };
    sheet.getCell('D5').value = summary.confirmedDeductibleExpenses;
    sheet.getCell('D5').numFmt = '"R$" #,##0.00';
    sheet.getCell('D5').font = { bold: true };

    sheet.getCell('E5').value = 'Pendente Comprovante:';
    sheet.getCell('E5').font = { bold: true, color: { argb: 'FFD97706' } };
    sheet.getCell('F5').value = summary.pendingDocumentationExpenses;
    sheet.getCell('F5').numFmt = '"R$" #,##0.00';
    sheet.getCell('F5').font = { bold: true };
    sheet.getRow(5).height = 20;

    let currentRow = 7;

    // Seção PJ (se aplicável)
    if (summary.pjSummary.applicable) {
      sheet.mergeCells(`A${currentRow}:G${currentRow}`);
      sheet.getCell(`A${currentRow}`).value = 'Painel Fiscal PJ / Autônomo';
      sheet.getCell(`A${currentRow}`).font = { bold: true, size: 11, color: { argb: 'FF0F172A' } };
      currentRow++;

      sheet.getCell(`A${currentRow}`).value = 'Faturamento Bruto:';
      sheet.getCell(`B${currentRow}`).value = summary.pjSummary.grossRevenueYearToDate;
      sheet.getCell(`B${currentRow}`).numFmt = '"R$" #,##0.00';

      sheet.getCell(`C${currentRow}`).value = 'Teto MEI (Ref):';
      sheet.getCell(`D${currentRow}`).value = summary.pjSummary.annualLimit;
      sheet.getCell(`D${currentRow}`).numFmt = '"R$" #,##0.00';

      sheet.getCell(`E${currentRow}`).value = '% Teto Atingido:';
      sheet.getCell(`F${currentRow}`).value = `${summary.pjSummary.ceilingPercentage}%`;
      currentRow++;

      sheet.getCell(`A${currentRow}`).value = 'Pró-Labore Anual:';
      sheet.getCell(`B${currentRow}`).value = summary.pjSummary.proLaboreTotal;
      sheet.getCell(`B${currentRow}`).numFmt = '"R$" #,##0.00';

      sheet.getCell(`C${currentRow}`).value = 'Dividendos / Lucros:';
      sheet.getCell(`D${currentRow}`).value = summary.pjSummary.dividendsTotal;
      sheet.getCell(`D${currentRow}`).numFmt = '"R$" #,##0.00';
      currentRow += 2;
    }

    // 3. Cabeçalho dos Lançamentos
    const headerRowNumber = currentRow;
    const headerRow = sheet.getRow(headerRowNumber);
    headerRow.values = [
      'Data',
      'Descrição',
      'Categoria Fiscal',
      'Favorecido / Prestador',
      'CPF/CNPJ Prestador',
      'Status Comprovação',
      'Valor Dedutível (R$)',
    ];
    headerRow.height = 24;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
      cell.font = {
        name: 'Arial',
        size: 10,
        bold: true,
        color: { argb: 'FF0F172A' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });

    // 4. Linhas de Dados
    records.forEach((rec, index) => {
      const row = sheet.getRow(headerRowNumber + 1 + index);
      const isConfirmed = rec.status === 'CONFIRMED';

      row.values = [
        this.formatDateBR(rec.date),
        rec.description,
        rec.taxCategory || 'Geral',
        rec.providerName || '-',
        this.formatCpfCnpj(rec.providerDocument),
        isConfirmed ? 'Confirmado' : 'Pendente',
        rec.deductibleAmount,
      ];
      row.height = 20;

      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
      row.getCell(6).font = {
        color: { argb: isConfirmed ? 'FF16A34A' : 'FFD97706' },
        bold: true,
      };

      const amountCell = row.getCell(7);
      amountCell.numFmt = '"R$" #,##0.00';
      amountCell.alignment = { horizontal: 'right' };
      amountCell.font = { bold: true };
    });

    // Ajuste de largura das colunas
    sheet.columns = [
      { width: 14 },
      { width: 32 },
      { width: 22 },
      { width: 28 },
      { width: 22 },
      { width: 20 },
      { width: 20 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
