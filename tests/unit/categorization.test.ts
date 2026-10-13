import { describe, expect, it } from 'vitest';
import { CANONICAL_CATEGORIES, Category, SYSTEM_DEFAULTS } from '../../src/config/constants.js';

describe('Categorization Logic (Token Minimization & Reassociation)', () => {
  it('deve deduplicar em memória estabelecimentos repetidos', () => {
    const rawDescriptions = [
      'SUPERMERCADO EXTRA',
      'SUPERMERCADO EXTRA',
      'POSTO IPIRANGA',
      'POSTO IPIRANGA',
      'SUPERMERCADO EXTRA',
      'FARMACIA DROGASIL',
    ];

    const uniqueSet = new Set(rawDescriptions);
    const uniqueArray = Array.from(uniqueSet);

    expect(uniqueArray).toHaveLength(3);
    expect(uniqueArray).toEqual(['SUPERMERCADO EXTRA', 'POSTO IPIRANGA', 'FARMACIA DROGASIL']);
    // Redução de 50% de tokens neste lote sintético
    const reductionPercent = ((rawDescriptions.length - uniqueArray.length) / rawDescriptions.length) * 100;
    expect(reductionPercent).toBe(50);
  });

  it('deve reassociar categorias e aplicar fallback seguro para Outros', () => {
    const aiCategoryResult: Record<string, string> = {
      'SUPERMERCADO EXTRA': 'Alimentação',
      'POSTO IPIRANGA': 'Transporte',
      'PAGAMENTO DESCONHECIDO': 'CategoriaInvalidaNaoExiste',
    };

    const validatedResult: Record<string, Category> = {};
    for (const [merchant, cat] of Object.entries(aiCategoryResult)) {
      if (CANONICAL_CATEGORIES.includes(cat as any)) {
        validatedResult[merchant] = cat as Category;
      } else {
        validatedResult[merchant] = SYSTEM_DEFAULTS.DEFAULT_CATEGORY;
      }
    }

    expect(validatedResult['SUPERMERCADO EXTRA']).toBe('Alimentação');
    expect(validatedResult['POSTO IPIRANGA']).toBe('Transporte');
    expect(validatedResult['PAGAMENTO DESCONHECIDO']).toBe('Outros');
  });
});
