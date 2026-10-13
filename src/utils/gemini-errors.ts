export type GeminiErrorType =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'UPSTREAM_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface ParsedGeminiError {
  type: GeminiErrorType;
  statusCode: number;
  userMessage: string;
  isTransient: boolean;
  originalMessage: string;
  originalStatus?: number | string;
}

export class GeminiApiError extends Error {
  public readonly statusCode: number;
  public readonly type: GeminiErrorType;
  public readonly isTransient: boolean;

  constructor(parsed: ParsedGeminiError) {
    super(parsed.userMessage);
    this.name = 'GeminiApiError';
    this.statusCode = parsed.statusCode;
    this.type = parsed.type;
    this.isTransient = parsed.isTransient;
  }
}

export class GeminiErrorParser {
  /**
   * Inspeciona e classifica erros retornados pelo Google GenAI SDK ou rede.
   */
  public static parse(error: unknown): ParsedGeminiError {
    const rawMsg = error instanceof Error ? error.message : String(error || '');
    let extractedMsg = rawMsg;
    let extractedStatus: number | string | undefined = undefined;

    // Tenta interpretar mensagens que contenham JSON retornado pela API do Google
    try {
      if (rawMsg.includes('{') && rawMsg.includes('}')) {
        const jsonStart = rawMsg.indexOf('{');
        const jsonEnd = rawMsg.lastIndexOf('}');
        const jsonCandidate = rawMsg.substring(jsonStart, jsonEnd + 1);
        const parsedJson = JSON.parse(jsonCandidate);

        if (parsedJson?.error) {
          extractedMsg = parsedJson.error.message || extractedMsg;
          extractedStatus = parsedJson.error.status || parsedJson.error.code || extractedStatus;
        } else if (parsedJson?.status || parsedJson?.code) {
          extractedMsg = parsedJson.message || extractedMsg;
          extractedStatus = parsedJson.status || parsedJson.code || extractedStatus;
        }
      }
    } catch {
      // Ignora erro de parse e mantém rawMsg
    }

    if (error && typeof error === 'object') {
      const errObj = error as Record<string, any>;
      if (!extractedStatus) {
        extractedStatus = errObj.status || errObj.code || errObj.statusCode;
      }
    }

    const lowerMsg = (extractedMsg + ' ' + (extractedStatus || '')).toLowerCase();

    // 1. Alta Demanda / Indisponibilidade Upstream (503 / UNAVAILABLE / Spikes in demand)
    if (
      extractedStatus === 503 ||
      extractedStatus === 'UNAVAILABLE' ||
      lowerMsg.includes('high demand') ||
      lowerMsg.includes('spikes in demand') ||
      lowerMsg.includes('unavailable') ||
      lowerMsg.includes('temporarily unavailable')
    ) {
      return {
        type: 'UPSTREAM_UNAVAILABLE',
        statusCode: 503,
        userMessage:
          'Os servidores do Google AI Studio estão com alta demanda temporária no momento. Por favor, tente novamente em instantes.',
        isTransient: true,
        originalMessage: extractedMsg,
        originalStatus: extractedStatus,
      };
    }

    // 2. Limite de Cota / Rate Limit (429 / RESOURCE_EXHAUSTED)
    if (
      extractedStatus === 429 ||
      extractedStatus === 'RESOURCE_EXHAUSTED' ||
      lowerMsg.includes('resource_exhausted') ||
      lowerMsg.includes('quota exceeded') ||
      lowerMsg.includes('rate limit') ||
      lowerMsg.includes('too many requests')
    ) {
      return {
        type: 'RATE_LIMIT_ERROR',
        statusCode: 429,
        userMessage:
          'O limite de requisições ou cota da sua chave no Google AI Studio foi atingido temporariamente.',
        isTransient: true,
        originalMessage: extractedMsg,
        originalStatus: extractedStatus,
      };
    }

    // 3. Autenticação Incorreta ou Revogada (400 / 401 / 403 / API key not valid / PERMISSION_DENIED)
    if (
      extractedStatus === 401 ||
      extractedStatus === 403 ||
      extractedStatus === 'PERMISSION_DENIED' ||
      lowerMsg.includes('api key not valid') ||
      lowerMsg.includes('api_key_invalid') ||
      lowerMsg.includes('permission_denied') ||
      lowerMsg.includes('invalid api key') ||
      lowerMsg.includes('unauthorized') ||
      lowerMsg.includes('forbidden')
    ) {
      return {
        type: 'AUTH_ERROR',
        statusCode: 400,
        userMessage: 'A chave de API fornecida é inválida ou foi revogada no Google AI Studio.',
        isTransient: false,
        originalMessage: extractedMsg,
        originalStatus: extractedStatus,
      };
    }

    // 4. Falhas de Rede e Timeout (ETIMEDOUT, ENOTFOUND, ECONNRESET)
    if (
      lowerMsg.includes('etimedout') ||
      lowerMsg.includes('enotfound') ||
      lowerMsg.includes('econnrefused') ||
      lowerMsg.includes('econnreset') ||
      lowerMsg.includes('fetch failed') ||
      lowerMsg.includes('network error')
    ) {
      return {
        type: 'NETWORK_ERROR',
        statusCode: 503,
        userMessage:
          'Não foi possível estabelecer conexão com os servidores do Google AI Studio. Verifique sua conexão com a internet.',
        isTransient: true,
        originalMessage: extractedMsg,
        originalStatus: extractedStatus,
      };
    }

    // 5. Erro Genérico Desconhecido
    return {
      type: 'UNKNOWN_ERROR',
      statusCode: 500,
      userMessage: 'Ocorreu um erro inesperado ao se comunicar com o Google AI Studio.',
      isTransient: false,
      originalMessage: extractedMsg,
      originalStatus: extractedStatus,
    };
  }
}

/**
 * Utilitário para executar operações no Gemini com retentativas rápidas para erros transitórios (503 / 429).
 */
export async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2,
  initialDelayMs = 400
): Promise<T> {
  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      return await operation();
    } catch (err: unknown) {
      attempt++;
      const parsed = GeminiErrorParser.parse(err);

      if (parsed.isTransient && attempt <= maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.floor(delay * 1.5);
        continue;
      }

      throw new GeminiApiError(parsed);
    }
  }
}
