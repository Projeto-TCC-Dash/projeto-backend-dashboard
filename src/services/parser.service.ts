import crypto from 'node:crypto';
import { parse as parseCsv } from 'csv-parse/sync';
import iconv from 'iconv-lite';
// @ts-ignore - node-ofx-parser não possui declarações de tipo nativas
import ofxParser from 'node-ofx-parser';
import { SanitizerService } from './sanitizer.service.js';

export interface ParsedTransaction {
  externalId: string;
  rawDescription: string;
  cleanDescription: string;
  amount: number;
  date: Date;
  source: 'OFX' | 'CSV';
}

export class ParserService {
  /**
   * Decodifica o Buffer para string suportando UTF-8 e ISO-8859-1 (Latin1).
   */
  public static decodeBuffer(buffer: Buffer): string {
    // Tenta primeiro UTF-8
    const utf8Text = buffer.toString('utf-8');
    // Se contiver caracteres de substituição comuns de decodificação incorreta (\uFFFD), tenta ISO-8859-1
    if (utf8Text.includes('\uFFFD')) {
      return iconv.decode(buffer, 'iso-8859-1');
    }
    return utf8Text;
  }

  /**
   * Realiza o parsing de arquivo OFX extraindo todas as transações de contas correntes e cartões.
   */
  public static parseOFX(buffer: Buffer): ParsedTransaction[] {
    const content = this.decodeBuffer(buffer);
    const parsed = (ofxParser.default || ofxParser).parse(content);

    const transactions: ParsedTransaction[] = [];

    // Localiza recursivamente todos os blocos STMTTRN
    const extractStmttrn = (node: any) => {
      if (!node || typeof node !== 'object') {
        return;
      }

      if (node.STMTTRN) {
        const trns = Array.isArray(node.STMTTRN) ? node.STMTTRN : [node.STMTTRN];
        for (const item of trns) {
          const rawDesc = String(item.MEMO || item.NAME || 'LANÇAMENTO SEM IDENTIFICAÇÃO').trim();
          const amountNum = parseFloat(String(item.TRNAMT || '0').replace(',', '.'));
          const fitId = String(item.FITID || '').trim();

          const date = this.parseOfxDate(String(item.DTPOSTED || ''));

          if (fitId && !isNaN(amountNum)) {
            transactions.push({
              externalId: fitId,
              rawDescription: rawDesc,
              cleanDescription: SanitizerService.cleanDescription(rawDesc),
              amount: amountNum,
              date,
              source: 'OFX',
            });
          }
        }
      }

      for (const key of Object.keys(node)) {
        if (key !== 'STMTTRN' && typeof node[key] === 'object') {
          extractStmttrn(node[key]);
        }
      }
    };

    extractStmttrn(parsed);

    // Fallback via Regex se o parser falhar com tags SGML malformadas
    if (transactions.length === 0) {
      return this.parseOfxWithRegex(content);
    }

    return transactions;
  }

  /**
   * Parser de contingência baseado em Regex para extratos OFX 1.x brutos.
   */
  private static parseOfxWithRegex(content: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const stmttrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>|<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>)/gi;
    let match: RegExpExecArray | null;

    while ((match = stmttrnRegex.exec(content)) !== null) {
      const block = match[1] || match[2] || '';

      const fitidMatch = /<FITID>\s*([^\r\n<]+)/i.exec(block);
      const amountMatch = /<TRNAMT>\s*([^\r\n<]+)/i.exec(block);
      const dateMatch = /<DTPOSTED>\s*([^\r\n<]+)/i.exec(block);
      const memoMatch = /<MEMO>\s*([^\r\n<]+)/i.exec(block);
      const nameMatch = /<NAME>\s*([^\r\n<]+)/i.exec(block);

      const fitId = (fitidMatch && fitidMatch[1]) ? fitidMatch[1].trim() : '';
      const rawAmount = (amountMatch && amountMatch[1]) ? amountMatch[1].trim() : '0';
      const rawDate = (dateMatch && dateMatch[1]) ? dateMatch[1].trim() : '';
      const rawDesc = (memoMatch && memoMatch[1]) ? memoMatch[1].trim() : (nameMatch && nameMatch[1]) ? nameMatch[1].trim() : 'SEM DESCRICAO';

      if (fitId) {
        const amount = parseFloat(rawAmount.replace(',', '.'));
        transactions.push({
          externalId: fitId,
          rawDescription: rawDesc,
          cleanDescription: SanitizerService.cleanDescription(rawDesc),
          amount,
          date: this.parseOfxDate(rawDate),
          source: 'OFX',
        });
      }
    }

    return transactions;
  }

  private static parseOfxDate(dateStr: string): Date {
    const clean = dateStr.replace(/\[.*\]/, '').trim();
    if (clean.length >= 8) {
      const year = parseInt(clean.substring(0, 4), 10);
      const month = parseInt(clean.substring(4, 6), 10) - 1;
      const day = parseInt(clean.substring(6, 8), 10);
      return new Date(Date.UTC(year, month, day, 12, 0, 0));
    }
    return new Date();
  }

  /**
   * Realiza o parsing de arquivo CSV com detecção de delimitador e mapeamento de colunas.
   */
  public static parseCSV(buffer: Buffer): ParsedTransaction[] {
    const content = this.decodeBuffer(buffer);

    // Identifica o delimitador mais provável
    const firstLine = content.split('\n')[0] || '';
    const delimiter = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';

    const records = parseCsv(content, {
      delimiter,
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Array<Record<string, string>>;

    const transactions: ParsedTransaction[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      if (!row) continue;

      // Normaliza as chaves do cabeçalho
      const normalizedRow: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        normalizedRow[k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()] = v;
      }

      const dateStr =
        normalizedRow['data'] || normalizedRow['date'] || normalizedRow['dt'] || '';
      const descStr =
        normalizedRow['descricao'] ||
        normalizedRow['description'] ||
        normalizedRow['historico'] ||
        normalizedRow['memo'] ||
        normalizedRow['titulo'] ||
        'Lançamento CSV';
      const amountStr =
        normalizedRow['valor'] || normalizedRow['amount'] || normalizedRow['vl'] || '0';
      const idStr =
        normalizedRow['id'] ||
        normalizedRow['fitid'] ||
        normalizedRow['documento'] ||
        normalizedRow['doc'] ||
        '';

      const amount = parseFloat(
        amountStr.replace(/\./g, '').replace(',', '.').replace(/R\$\s*/g, '').trim()
      );

      const parsedDate = this.parseCsvDate(dateStr);

      // Se não houver ID externo no CSV, gera um hash determinístico
      const externalId =
        idStr ||
        crypto
          .createHash('sha256')
          .update(`${parsedDate.toISOString()}_${amount}_${descStr}_${i}`)
          .digest('hex')
          .substring(0, 24);

      if (!isNaN(amount)) {
        transactions.push({
          externalId,
          rawDescription: descStr,
          cleanDescription: SanitizerService.cleanDescription(descStr),
          amount,
          date: parsedDate,
          source: 'CSV',
        });
      }
    }

    return transactions;
  }

  private static parseCsvDate(dateStr: string): Date {
    // Formatos comuns: DD/MM/YYYY ou YYYY-MM-DD
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [d, m, y] = dateStr.split('/').map((n) => parseInt(n, 10));
      if (d && m && y) {
        return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  }
}
