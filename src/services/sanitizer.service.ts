export class SanitizerService {
  /**
   * Sanitiza a descrição de uma transação expurgando dados sensíveis de titularidade (LGPD)
   * e ruídos técnicos bancários.
   */
  public static cleanDescription(rawDescription: string): string {
    if (!rawDescription) {
      return 'DESCONHECIDO';
    }

    let text = rawDescription.toUpperCase();

    // 1. Expurgar padrões de CPF (ex: 123.456.789-00 ou 12345678900)
    text = text.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '');

    // 2. Expurgar padrões de CNPJ (ex: 12.345.678/0001-90 ou 12345678000190)
    text = text.replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '');

    // 3. Expurgar termos bancários de Agência e Conta Corrente
    text = text.replace(/\b(AG|AGENCIA)\s*[:.-]?\s*\d+\b/gi, '');
    text = text.replace(/\b(CC|CONTA|CTA)\s*[:.-]?\s*\d+([.-]?\d+)?\b/gi, '');

    // 4. Expurgar prefixos de operação comuns (PIX, TED, DOC, COMPRA CARTAO, etc.)
    text = text.replace(/\b(PIX\s*(TRANSF|RECEBIDA|ENVIADA)?|TED|DOC|COMPRA\s*(CARTAO|DEBITO|CREDITO)?|PAGTO\s*ELETRON)\b/gi, '');

    // 5. Expurgar sequências longas de dígitos (como códigos de autorização/NSU > 5 dígitos)
    text = text.replace(/\b\d{6,}\b/g, '');

    // 6. Limpar pontuações residuais, caracteres especiais estranhos e múltiplos espaços
    text = text.replace(/[\\/*_#@$%&()[\]{}]/g, ' ');
    text = text.replace(/\s+/g, ' ').trim();

    return text || rawDescription.trim().toUpperCase() || 'DESCONHECIDO';
  }
}
