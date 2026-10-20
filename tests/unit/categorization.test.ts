import { describe, expect, it } from 'vitest';
import { CANONICAL_CATEGORIES, Category, CategoryEnum, SYSTEM_DEFAULTS } from '../../src/config/constants.js';
import { GeminiService } from '../../src/services/gemini.service.js';

describe('Categorization Logic (Token Minimization & Reassociation)', () => {
  it('deve conter exatamente 11 categorias canônicas incluindo Pagamento de Fatura e Investimentos', () => {
    expect(CANONICAL_CATEGORIES).toHaveLength(11);
    expect(CANONICAL_CATEGORIES).toContain('Pagamento de Fatura');
    expect(CANONICAL_CATEGORIES).toContain('Investimentos');

    expect(CategoryEnum.safeParse('Pagamento de Fatura').success).toBe(true);
    expect(CategoryEnum.safeParse('Investimentos').success).toBe(true);
    expect(CategoryEnum.safeParse('CategoriaInexistente').success).toBe(false);
  });

  it('deve conter as diretrizes de Pagamento de Fatura e Investimentos no prompt do sistema do Gemini', () => {
    const prompt = GeminiService.buildCategorizationSystemPrompt();
    expect(prompt).toContain('Pagamento de Fatura');
    expect(prompt).toContain('Investimentos');
    expect(prompt).toContain('fatura de cartão de crédito');
    expect(prompt).toContain('corretoras');
  });

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

  it('deve reassociar categorias e aplicar fallback seguro para Não Categorizado', () => {
    const aiCategoryResult: Record<string, string> = {
      'SUPERMERCADO EXTRA': 'Alimentação',
      'POSTO IPIRANGA': 'Transporte',
      'TED RECEBIDA SALARIO': 'Receita',
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
    expect(validatedResult['TED RECEBIDA SALARIO']).toBe('Receita');
    expect(validatedResult['PAGAMENTO DESCONHECIDO']).toBe('Não Categorizado');
  });

  it('deve conter as instruções contábeis de faturas no prompt de diagnóstico gerado pelo GeminiService', () => {
    const summary = {
      month: '2026-10',
      totalIncome: 5000,
      totalExpenses: 2000,
      invoiceSettlements: 1500,
      netBalance: 3000,
      savingsRate: 60,
      topCategories: [{ category: 'Alimentação', amount: 2000, percentage: 100 }],
    };

    const { systemPrompt, userPrompt } = GeminiService.buildFinancialDiagnosisPrompts(summary);

    expect(systemPrompt).toContain('Princípios Contábeis Importantes');
    expect(systemPrompt).toContain('Pagamento de Fatura');
    expect(systemPrompt).toContain('liquidação de passivo');
    expect(userPrompt).toContain('Quitação de Faturas de Cartão: R$ 1500.00');
    expect(userPrompt).toContain('Total de Despesas Primárias (Consumo): R$ 2000.00');
  });
});
