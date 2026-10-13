import { describe, expect, it } from 'vitest';
import { ParserService } from '../../src/services/parser.service.js';
import { SanitizerService } from '../../src/services/sanitizer.service.js';

describe('SanitizerService (LGPD Conformidade)', () => {
  it('deve expurgar CPF de descrições de transferências', () => {
    const raw = 'PIX TRANSF 123.456.789-00 JOAO SILVA';
    const clean = SanitizerService.cleanDescription(raw);

    expect(clean).not.toContain('123.456.789-00');
    expect(clean).not.toContain('PIX');
    expect(clean).toContain('JOAO SILVA');
  });

  it('deve expurgar CNPJ e agência/conta bancária', () => {
    const raw = 'TED 12.345.678/0001-90 AG 1234 CC 56789-0 POSTO SHELL';
    const clean = SanitizerService.cleanDescription(raw);

    expect(clean).not.toContain('12.345.678/0001-90');
    expect(clean).not.toContain('1234');
    expect(clean).not.toContain('56789-0');
    expect(clean).toContain('POSTO SHELL');
  });

  it('deve limpar prefixos de cartão de crédito/débito', () => {
    const raw = 'COMPRA CARTAO SUPERMERCADO PAO DE ACUCAR';
    const clean = SanitizerService.cleanDescription(raw);

    expect(clean).toBe('SUPERMERCADO PAO DE ACUCAR');
  });
});

describe('ParserService (OFX & CSV)', () => {
  it('deve processar extrato OFX e extrair FITID, data, valor e descrição', () => {
    const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261010120000[-03:EST]
            <TRNAMT>-85.50
            <FITID>OFX-FITID-1001
            <MEMO>PIX TRANSF 123.456.789-00 FARMACIA DROGASIL
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

    const buffer = Buffer.from(ofxContent, 'utf-8');
    const transactions = ParserService.parseOFX(buffer);

    expect(transactions).toHaveLength(1);
    const tx = transactions[0]!;
    expect(tx.externalId).toBe('OFX-FITID-1001');
    expect(tx.amount).toBe(-85.5);
    expect(tx.source).toBe('OFX');
    expect(tx.cleanDescription).toContain('FARMACIA DROGASIL');
    expect(tx.cleanDescription).not.toContain('123.456.789-00');
  });

  it('deve processar extrato CSV com cabeçalhos e delimitador ponto e vírgula', () => {
    const csvContent = `Data;Descricao;Valor;Documento
10/10/2026;MERCADO EXTRA LTDA;-150,30;DOC12345
11/10/2026;POSTO IPIRANGA;-55,00;DOC12346`;

    const buffer = Buffer.from(csvContent, 'utf-8');
    const transactions = ParserService.parseCSV(buffer);

    expect(transactions).toHaveLength(2);
    expect(transactions[0]?.externalId).toBe('DOC12345');
    expect(transactions[0]?.amount).toBe(-150.3);
    expect(transactions[0]?.cleanDescription).toContain('MERCADO EXTRA LTDA');
    expect(transactions[1]?.externalId).toBe('DOC12346');
    expect(transactions[1]?.amount).toBe(-55.0);
  });
});
