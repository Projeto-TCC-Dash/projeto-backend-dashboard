export type GeminiErrorType =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'MODEL_NOT_FOUND'
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
  public readonly originalMessage: string;

  constructor(parsed: ParsedGeminiError) {
    super(parsed.userMessage);
    this.name = 'GeminiApiError';
    this.statusCode = parsed.statusCode;
    this.type = parsed.type;
    this.isTransient = parsed.isTransient;
    this.originalMessage = parsed.originalMessage;
  }
}

function extractCauseDetails(error: unknown): string {
  const parts: string[] = [];
  let current: unknown =
    error && typeof error === 'object' ? (error as { cause?: unknown }).cause : undefined;
  let depth = 0;

  while (current && depth < 3) {
    if (current instanceof Error) {
      const code = (current as { code?: unknown }).code;
      parts.push(
        `${current.name}: ${current.message}${code ? ` (${String(code)})` : ''}`
      );
      current = (current as { cause?: unknown }).cause;
    } else if (typeof current === 'object') {
      parts.push(JSON.stringify(current));
      break;
    } else {
      parts.push(String(current));
      break;
    }
    depth++;
  }

  return parts.join(' -> ');
}

export class GeminiErrorParser {
  /**
   * Inspeciona e classifica erros retornados pelo Google GenAI SDK ou rede.
   */
  public static parse(error: unknown): ParsedGeminiError {
    const rawMsg = error instanceof Error ? error.message : String(error || '');
    const causeDetails = extractCauseDetails(error);
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

    const fullOriginalMsg =
      causeDetails && !extractedMsg.includes(causeDetails)
        ? `${extractedMsg} [cause: ${causeDetails}]`
        : extractedMsg;

    const lowerMsg = (extractedMsg + ' ' + causeDetails + ' ' + (extractedStatus || '')).toLowerCase();

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
          'Os servidores do Google Gemini estão com alta demanda no momento. Aguarde alguns segundos e clique em Tentar novamente.',
        isTransient: true,
        originalMessage: fullOriginalMsg,
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
          'Você atingiu o limite temporário de uso da sua chave no Google AI Studio. Aguarde cerca de 1 minuto e tente novamente (ou verifique sua cota no AI Studio).',
        isTransient: true,
        originalMessage: fullOriginalMsg,
        originalStatus: extractedStatus,
      };
    }

    // 3. Autenticação Incorreta, Expirada ou Revogada (400 / 401 / 403 / API key not valid / PERMISSION_DENIED)
    if (
      extractedStatus === 401 ||
      extractedStatus === 403 ||
      extractedStatus === 'PERMISSION_DENIED' ||
      lowerMsg.includes('api key not valid') ||
      lowerMsg.includes('api_key_invalid') ||
      lowerMsg.includes('api key expired') ||
      lowerMsg.includes('permission_denied') ||
      lowerMsg.includes('invalid api key') ||
      lowerMsg.includes('unauthorized') ||
      lowerMsg.includes('forbidden')
    ) {
      return {
        type: 'AUTH_ERROR',
        statusCode: 400,
        userMessage:
          'Sua chave da API Gemini parece inválida, expirada ou sem permissão. Atualize sua chave em Configurações → Segurança.',
        isTransient: false,
        originalMessage: fullOriginalMsg,
        originalStatus: extractedStatus,
      };
    }

    // 3.1. Modelo não encontrado / Indisponível (404 / NOT_FOUND)
    if (
      extractedStatus === 404 ||
      extractedStatus === 'NOT_FOUND' ||
      lowerMsg.includes('is not found for api version') ||
      lowerMsg.includes('not supported for generatecontent')
    ) {
      return {
        type: 'MODEL_NOT_FOUND',
        statusCode: 503,
        userMessage:
          'O serviço de IA está temporariamente indisponível por incompatibilidade do modelo na plataforma. Tente novamente mais tarde; sua chave não precisa ser alterada.',
        isTransient: false,
        originalMessage: fullOriginalMsg,
        originalStatus: extractedStatus,
      };
    }

    // 4. Falhas de Rede e Timeout (ETIMEDOUT, ENOTFOUND, ECONNRESET, AbortError, timeout)
    if (
      lowerMsg.includes('etimedout') ||
      lowerMsg.includes('enotfound') ||
      lowerMsg.includes('econnrefused') ||
      lowerMsg.includes('econnreset') ||
      lowerMsg.includes('fetch failed') ||
      lowerMsg.includes('network error') ||
      lowerMsg.includes('timed out') ||
      lowerMsg.includes('timeout') ||
      lowerMsg.includes('aborterror') ||
      lowerMsg.includes('operation was aborted')
    ) {
      return {
        type: 'NETWORK_ERROR',
        statusCode: 503,
        userMessage:
          'Falha de conexão ao tentar falar com o Google AI Studio. Tente novamente em instantes.',
        isTransient: true,
        originalMessage: fullOriginalMsg,
        originalStatus: extractedStatus,
      };
    }

    // 5. Erro Genérico Desconhecido (upstream Google AI Studio indisponível)
    return {
      type: 'UNKNOWN_ERROR',
      statusCode: 503,
      userMessage: 'Ocorreu um erro inesperado ao se comunicar com o Google AI Studio.',
      isTransient: false,
      originalMessage: fullOriginalMsg,
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
