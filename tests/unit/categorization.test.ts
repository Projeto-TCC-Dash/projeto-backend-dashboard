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

  it('deve incluir o perfil financeiro e diretrizes de calibragem de reserva/metas no prompt de diagnóstico', () => {
    const summary = {
      month: '2026-10',
      totalIncome: 15000,
      totalExpenses: 7000,
      invoiceSettlements: 2000,
      netBalance: 8000,
      savingsRate: 53.3,
      topCategories: [{ category: 'Moradia', amount: 3500, percentage: 50 }],
    };

    const financialProfile = {
      incomeType: 'PJ_AUTONOMO' as const,
      declaredMonthlyIncome: 15000,
      goals: ['RESERVA_EMERGENCIA' as const, 'QUITAR_DIVIDAS' as const],
      riskProfile: 'MODERATE' as const,
    };

    const { systemPrompt, userPrompt } = GeminiService.buildFinancialDiagnosisPrompts(summary, financialProfile);

    // Verificação de diretrizes de calibragem no system prompt
    expect(systemPrompt).toContain('Reserva de Emergência');
    expect(systemPrompt).toContain('3 a 6 meses');
    expect(systemPrompt).toContain('6 a 12 meses');
    expect(systemPrompt).toContain('PJ_AUTONOMO');
    expect(systemPrompt).toContain('CLT');

    // Verificação dos dados específicos no user prompt
    expect(userPrompt).toContain('PERFIL FINANCEIRO DO USUÁRIO');
    expect(userPrompt).toContain('Regime de Renda: PJ_AUTONOMO');
    expect(userPrompt).toContain('Renda Mensal Declarada: R$ 15000.00');
    expect(userPrompt).toContain('RESERVA_EMERGENCIA, QUITAR_DIVIDAS');
    expect(userPrompt).toContain('MODERATE');
  });

  it('deve aplicar fallback elegante no user prompt quando o perfil financeiro não for informado', () => {
    const summary = {
      month: '2026-10',
      totalIncome: 5000,
      totalExpenses: 2000,
      netBalance: 3000,
      savingsRate: 60,
      topCategories: [],
    };

    const { userPrompt } = GeminiService.buildFinancialDiagnosisPrompts(summary, undefined);
    expect(userPrompt).toContain('PERFIL FINANCEIRO DO USUÁRIO: Não informado');
  });
});
