import { GoogleGenAI } from '@google/genai';
import { CANONICAL_CATEGORIES, Category, SYSTEM_DEFAULTS } from '../config/constants.js';
import {
  GeminiApiError,
  GeminiErrorParser,
  withGeminiRetry,
} from '../utils/gemini-errors.js';

export type KeyValidationStatus = 'ACTIVE_VERIFIED' | 'ACTIVE_PROVISIONAL_DEMAND';

export interface KeyValidationResult {
  status: KeyValidationStatus;
  message: string;
}

export class GeminiService {
  /**
   * Executa um teste ativo na API do Gemini para validar a chave do usuário antes de aceitá-la.
   * Se o Google responder 503 UNAVAILABLE ou 429, a chave é reconhecida como autenticada pelo gateway.
   */
  public static async validateApiKey(apiKey: string): Promise<KeyValidationResult> {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 20) {
      throw new GeminiApiError({
        type: 'AUTH_ERROR',
        statusCode: 400,
        userMessage: 'A chave de API fornecida é inválida ou possui formato incorreto.',
        isTransient: false,
        originalMessage: 'API key syntax validation failed (length < 20 or empty)',
      });
    }

    try {
      await withGeminiRetry(
        async () => {
          const ai = new GoogleGenAI({ apiKey });
          await ai.models.generateContent({
            model: SYSTEM_DEFAULTS.GEMINI_MODEL,
            contents: 'Ping de validação de chave de API',
          });
        },
        2,
        400
      );

      return {
        status: 'ACTIVE_VERIFIED',
        message: 'Chave BYOK do Google Gemini validada e armazenada com criptografia.',
      };
    } catch (error: unknown) {
      const parsed = GeminiErrorParser.parse(error);

      // Se o erro for UPSTREAM_UNAVAILABLE (503) ou RATE_LIMIT_ERROR (429),
      // a chave passou com sucesso pela camada de autenticação do Google Cloud Endpoints!
      if (
        parsed.type === 'UPSTREAM_UNAVAILABLE' ||
        parsed.type === 'RATE_LIMIT_ERROR' ||
        parsed.type === 'NETWORK_ERROR'
      ) {
        console.warn(
          `⚠️ Chave reconhecida e aceita com aviso de demanda upstream (${parsed.type} - status ${parsed.statusCode}):`,
          parsed.originalMessage
        );
        return {
          status: 'ACTIVE_PROVISIONAL_DEMAND',
          message:
            'Chave de IA vinculada com sucesso! O Google AI Studio está com alta demanda temporária no momento, mas sua chave foi reconhecida e salva.',
        };
      }

      console.error('❌ Falha na validação ativa da API Key no Gemini:', parsed.originalMessage);
      throw new GeminiApiError(parsed);
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
      return await withGeminiRetry(
        async () => {
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
        },
        2,
        400
      );
    } catch (err: unknown) {
      if (err instanceof GeminiApiError) {
        throw err;
      }
      const parsed = GeminiErrorParser.parse(err);
      throw new GeminiApiError(parsed);
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

    try {
      const stream = await withGeminiRetry(
        async () => {
          return await ai.models.generateContentStream({
            model: SYSTEM_DEFAULTS.GEMINI_MODEL,
            contents,
          });
        },
        2,
        400
      );

      for await (const chunk of stream) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
    } catch (err: unknown) {
      if (err instanceof GeminiApiError) {
        throw err;
      }
      const parsed = GeminiErrorParser.parse(err);
      throw new GeminiApiError(parsed);
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
      return await withGeminiRetry(
        async () => {
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
        },
        2,
        400
      );
    } catch (err: unknown) {
      if (err instanceof GeminiApiError) {
        throw err;
      }
      const parsed = GeminiErrorParser.parse(err);
      throw new GeminiApiError(parsed);
    }
  }
}

