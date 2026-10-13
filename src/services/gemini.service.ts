import { GoogleGenAI } from '@google/genai';
import { CANONICAL_CATEGORIES, Category, SYSTEM_DEFAULTS } from '../config/constants.js';

export class GeminiService {
  /**
   * Executa um teste ativo mínimo na API do Gemini para validar a chave do usuário antes de aceitá-la.
   */
  public static async validateApiKey(apiKey: string): Promise<void> {
    try {
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.generateContent({
        model: SYSTEM_DEFAULTS.GEMINI_MODEL,
        contents: 'Ping de validação de chave de API',
      });
    } catch (error: any) {
      console.error('❌ Falha na validação ativa da API Key no Gemini:', error?.message || error);
      throw new Error(
        'A chave de API fornecida é inválida, foi revogada ou possui problemas de cota no Google AI Studio.'
      );
    }
  }

  /**
   * Categoriza uma lista de estabelecimentos comerciais únicos utilizando Structured Outputs (JSON Schema estrito).
   */
  public static async categorizeMerchants(
    apiKey: string,
    merchants: string[]
  ): Promise<Record<string, Category>> {
    if (merchants.length === 0) {
      return {};
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `Você é um motor de categorização financeira de alta precisão.
Sua tarefa é analisar nomes de estabelecimentos comerciais extraídos de extratos bancários brasileiros e classificá-los EXCLUSIVAMENTE em uma das 7 categorias permitidas:
${CANONICAL_CATEGORIES.join(', ')}.

Diretrizes:
- Supermercados, restaurantes, padarias, lanchonetes, delivery de comida -> Alimentação
- Combustível, postos, uber, 99, táxi, metrô, ônibus, pedágio, passagens -> Transporte
- Aluguel, condomínio, luz, energia, água, gás, internet residencial -> Moradia
- Farmácias, drogarias, hospitais, clínicas, consultas, exames, planos de saúde -> Saúde
- Cinema, streaming, jogos, bares, eventos, viagens a lazer, compras supérfluas -> Lazer
- Cursos, escolas, faculdades, livros técnicos, treinamentos -> Educação
- Qualquer despesa que não se encaixe com clareza nas opções acima -> Outros`;

    const jsonSchema = {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              merchant: { type: 'string' },
              category: {
                type: 'string',
                enum: [...CANONICAL_CATEGORIES],
              },
            },
            required: ['merchant', 'category'],
          },
        },
      },
      required: ['categories'],
    };

    const userPrompt = `Classifique os seguintes estabelecimentos comerciais:\n${JSON.stringify(
      merchants,
      null,
      2
    )}`;

    try {
      const response = await ai.models.generateContent({
        model: SYSTEM_DEFAULTS.GEMINI_MODEL,
        contents: `${systemPrompt}\n\n${userPrompt}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: jsonSchema,
          temperature: 0.1,
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Resposta vazia recebida do modelo Gemini.');
      }

      const parsed = JSON.parse(responseText) as {
        categories: Array<{ merchant: string; category: Category }>;
      };

      const result: Record<string, Category> = {};
      for (const item of parsed.categories) {
        if (CANONICAL_CATEGORIES.includes(item.category)) {
          result[item.merchant] = item.category;
        } else {
          result[item.merchant] = SYSTEM_DEFAULTS.DEFAULT_CATEGORY;
        }
      }

      return result;
    } catch (err: any) {
      console.error('❌ Erro na chamada de categorização ao Gemini:', err?.message || err);
      // Fallback gracioso: mapeia para 'Outros' se a chamada falhar
      const fallback: Record<string, Category> = {};
      for (const m of merchants) {
        fallback[m] = SYSTEM_DEFAULTS.DEFAULT_CATEGORY;
      }
      return fallback;
    }
  }

  /**
   * Abre um fluxo contínuo de resposta (streaming) com o Gemini para a persona de consultor financeiro.
   */
  public static async *streamFinancialAdvisor(
    apiKey: string,
    systemInstruction: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    newMessage: string
  ): AsyncIterable<string> {
    const ai = new GoogleGenAI({ apiKey });

    const contents = [
      {
        role: 'user',
        parts: [{ text: systemInstruction }],
      },
      {
        role: 'model',
        parts: [{ text: 'Entendido. Estou pronto para atuar como seu consultor financeiro pessoal.' }],
      },
      ...history.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
      {
        role: 'user',
        parts: [{ text: newMessage }],
      },
    ];

    const stream = await ai.models.generateContentStream({
      model: SYSTEM_DEFAULTS.GEMINI_MODEL,
      contents,
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }

  /**
   * Gera diagnóstico e recomendações financeiras detalhadas para um mês utilizando Structured Outputs.
   */
  public static async generateFinancialDiagnosis(
    apiKey: string,
    summary: {
      month: string;
      totalIncome: number;
      totalExpenses: number;
      netBalance: number;
      savingsRate: number;
      topCategories: Array<{ category: string; amount: number; percentage: number }>;
    }
  ): Promise<{ diagnosis: string; recommendations: string[] }> {
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `Você é um especialista em planejamento financeiro pessoal de alto nível.
Analise os números consolidados do mês do usuário e produza um diagnóstico executivo com tom construtivo, empático e prático, acompanhado de recomendações acionáveis.`;

    const userPrompt = `DADOS FINANCEIROS CONSOLIDADOS DO MÊS (${summary.month}):
- Total de Receitas: R$ ${summary.totalIncome.toFixed(2)}
- Total de Despesas: R$ ${summary.totalExpenses.toFixed(2)}
- Saldo Líquido: R$ ${summary.netBalance.toFixed(2)}
- Taxa de Poupança: ${summary.savingsRate.toFixed(1)}%
- Maiores Gastos:
${summary.topCategories
  .map((c) => `  * ${c.category}: R$ ${c.amount.toFixed(2)} (${c.percentage.toFixed(1)}%)`)
  .join('\n')}

Retorne um JSON estrito contendo:
- "diagnosis": texto analítico da saúde financeira do mês (máx 3 parágrafos curtos).
- "recommendations": lista com 3 a 5 ações concretas e priorizadas para melhorar o orçamento.`;

    const schema = {
      type: 'object',
      properties: {
        diagnosis: { type: 'string' },
        recommendations: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['diagnosis', 'recommendations'],
    };

    try {
      const response = await ai.models.generateContent({
        model: SYSTEM_DEFAULTS.GEMINI_MODEL,
        contents: `${systemPrompt}\n\n${userPrompt}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.2,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('Resposta vazia da IA.');
      }

      return JSON.parse(text) as { diagnosis: string; recommendations: string[] };
    } catch (err: any) {
      console.warn('⚠️ Falha na geração estruturada com Gemini, aplicando diagnóstico heurístico de contingência:', err?.message || err);
      // Fallback heurístico inteligente caso a chamada ao Gemini falhe
      const isPositive = summary.netBalance >= 0;
      return {
        diagnosis: isPositive
          ? `No mês de ${summary.month}, você manteve um saldo positivo de R$ ${summary.netBalance.toFixed(2)}, poupando ${summary.savingsRate.toFixed(1)}% das suas receitas totais.`
          : `No mês de ${summary.month}, suas despesas superaram suas receitas em R$ ${Math.abs(summary.netBalance).toFixed(2)}. É recomendável rever despesas não essenciais.`,
        recommendations: [
          'Priorize manter ou formar uma reserva de emergência equivalente a 6 meses de custo fixo.',
          summary.topCategories[0]
            ? `Avalie oportunidades de otimização na categoria ${summary.topCategories[0].category}, que concentrou ${summary.topCategories[0].percentage.toFixed(1)}% do seu orçamento.`
            : 'Mantenha o registro contínuo dos seus lançamentos para obter previsibilidade orçamentária.',
          'Evite o uso de cheque especial ou rotativo de cartão de crédito.',
        ],
      };
    }
  }
}

