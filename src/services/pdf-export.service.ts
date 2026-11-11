import PDFDocument from 'pdfkit';
import { IExportRecord, IExportSummaryMetrics } from './export.service.js';

export interface IPdfUserData {
  id: string;
  email: string;
  name?: string;
}

export class PdfExportService {
  /**
   * Gera o Buffer do documento PDF diagramado com cabeçalho institucional, KPIs e extrato paginado.
   */
  public static async generate(
    user: IPdfUserData,
    records: IExportRecord[],
    metrics: IExportSummaryMetrics
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
      const redColor = '#DC2626';
      const blueColor = '#2563EB';

      // 1. Cabeçalho Institucional
      doc.rect(40, 40, 515, 60).fill('#F8FAFC');
      doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold').text('PLATAFORMA FINANCEIRA', 55, 52);
      doc.fontSize(10).font('Helvetica').fillColor(secondaryColor).text('Relatório Consolidado de Extrato Financeiro', 55, 72);

      const emitidoPara = user.name ? `${user.name} (${user.email})` : user.email;
      doc.fontSize(8).fillColor(secondaryColor).text(`Titular: ${emitidoPara}`, 320, 52, { align: 'right', width: 220 });
      doc.text(`Período: ${metrics.periodLabel}`, 320, 65, { align: 'right', width: 220 });
      doc.text(`Emissão: ${metrics.generatedAt.toLocaleString('pt-BR')}`, 320, 78, { align: 'right', width: 220 });

      // 2. Sumário de KPIs em Cards
      let y = 115;
      const cardWidth = 165;
      const cardHeight = 45;

      // Card Receitas
      doc.rect(40, y, cardWidth, cardHeight).fill('#F0FDF4');
      doc.strokeColor('#BBF7D0').rect(40, y, cardWidth, cardHeight).stroke();
      doc.fillColor(greenColor).fontSize(8).font('Helvetica-Bold').text('TOTAL RECEITAS', 50, y + 8);
      doc.fontSize(13).text(`R$ ${metrics.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 50, y + 22);

      // Card Despesas
      doc.rect(215, y, cardWidth, cardHeight).fill('#FEF2F2');
      doc.strokeColor('#FECACA').rect(215, y, cardWidth, cardHeight).stroke();
      doc.fillColor(redColor).fontSize(8).font('Helvetica-Bold').text('TOTAL DESPESAS', 225, y + 8);
      doc.fontSize(13).text(`R$ ${metrics.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 225, y + 22);

      // Card Saldo Líquido
      doc.rect(390, y, cardWidth, cardHeight).fill('#EFF6FF');
      doc.strokeColor('#BFDBFE').rect(390, y, cardWidth, cardHeight).stroke();
      doc.fillColor(blueColor).fontSize(8).font('Helvetica-Bold').text('SALDO LÍQUIDO', 400, y + 8);
      doc.fontSize(13).text(`R$ ${metrics.netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 400, y + 22);

      // 3. Cabeçalho da Tabela
      y = 175;
      const drawTableHeader = (currY: number) => {
        doc.rect(40, currY, 515, 20).fill('#0F172A');
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
        doc.text('DATA', 45, currY + 6, { width: 55, align: 'left' });
        doc.text('DESCRIÇÃO', 105, currY + 6, { width: 175, align: 'left' });
        doc.text('CATEGORIA', 285, currY + 6, { width: 85, align: 'left' });
        doc.text('CONTA', 375, currY + 6, { width: 85, align: 'left' });
        doc.text('VALOR', 465, currY + 6, { width: 85, align: 'right' });
      };

      drawTableHeader(y);
      y += 20;

      // 4. Linhas de Transações
      if (records.length === 0) {
        doc.rect(40, y, 515, 30).fill('#F8FAFC');
        doc.fillColor(secondaryColor).fontSize(9).font('Helvetica-Oblique')
          .text('Nenhuma transação encontrada para os filtros selecionados.', 50, y + 10, { align: 'center', width: 495 });
        y += 30;
      } else {
        doc.font('Helvetica').fontSize(8);
        for (let i = 0; i < records.length; i++) {
          const rec = records[i]!;

          // Quebra de página caso ultrapasse limite inferior
          if (y > 750) {
            doc.addPage();
            y = 40;
            drawTableHeader(y);
            y += 20;
            doc.font('Helvetica').fontSize(8);
          }

          const isEven = i % 2 === 0;
          if (isEven) {
            doc.rect(40, y, 515, 18).fill('#F8FAFC');
          }

          const valueColor = rec.amount > 0 ? greenColor : primaryColor;

          doc.fillColor(primaryColor);
          doc.text(rec.dateFormatted, 45, y + 5, { width: 55, align: 'left' });

          const truncatedDesc = rec.description.length > 35 ? `${rec.description.substring(0, 32)}...` : rec.description;
          doc.text(truncatedDesc, 105, y + 5, { width: 175, align: 'left' });
          doc.text(rec.category, 285, y + 5, { width: 85, align: 'left' });
          doc.text(rec.accountName, 375, y + 5, { width: 85, align: 'left' });

          doc.fillColor(valueColor);
          doc.text(rec.amountFormatted, 465, y + 5, { width: 85, align: 'right' });

          doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(40, y + 18).lineTo(555, y + 18).stroke();
          y += 18;
        }
      }

      // 5. Numeração de Páginas no Rodapé
      const pageRange = doc.bufferedPageRange();
      for (let p = 0; p < pageRange.count; p++) {
        doc.switchToPage(p);
        doc.fontSize(7).fillColor('#94A3B8').text(
          `Página ${p + 1} de ${pageRange.count}  •  Documento gerado automaticamente pela Plataforma Financeira`,
          40,
          800,
          { align: 'center', width: 515 }
        );
      }

      doc.end();
    });
  }
}
