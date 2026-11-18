import { GoogleGenAI } from '@google/genai';
import { SYSTEM_DEFAULTS } from '../config/constants.js';
import {
  GeminiApiError,
  GeminiErrorParser,
  withGeminiRetry,
} from '../utils/gemini-errors.js';

export interface ExtractedReceiptData {
  providerDocument?: string;
  providerName?: string;
  totalAmount?: number;
  issueDate?: string;
  description?: string;
}

export class FiscalOcrService {
  /**
   * Envia a imagem ou PDF de um comprovante fiscal diretamente para o Gemini Vision
   * utilizando a chave BYOK do usuário e Structured Outputs (JSON Schema estrito).
   */
  public static async extractReceiptData(
    apiKey: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<ExtractedReceiptData> {
    const ai = new GoogleGenAI({ apiKey });

    const contents = [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: fileBuffer.toString('base64'),
              mimeType,
            },
          },
          {
            text: `Você é um leitor óptico (OCR) e extrator fiscal inteligente especializado em documentos fiscais brasileiros (recibos médicos/odontológicos, NFS-e e notas fiscais).
Analise o documento e extraia com máxima precisão os campos:
- providerDocument: CPF (11 dígitos) ou CNPJ (14 dígitos) do prestador ou emitente, contendo estritamente dígitos numéricos.
- providerName: Razão social, nome da clínica ou nome civil do profissional emitente.
- totalAmount: Valor numérico total pago ou cobrado (float positivo).
- issueDate: Data de emissão ou realização no formato ISO-8601 (YYYY-MM-DDTHH:mm:ss.sssZ).
- description: Breve resumo do procedimento ou serviço prestado.`,
          },
        ],
      },
    ];

    const jsonSchema = {
      type: 'object',
      properties: {
        providerDocument: { type: 'string' },
        providerName: { type: 'string' },
        totalAmount: { type: 'number' },
        issueDate: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['totalAmount'],
    };

    try {
      return await withGeminiRetry(
        async () => {
          const response = await ai.models.generateContent({
            model: SYSTEM_DEFAULTS.GEMINI_MODEL,
            contents,
            config: {
              responseMimeType: 'application/json',
              responseSchema: jsonSchema,
              temperature: 0.1,
            },
          });

          const responseText = response.text;
          if (!responseText) {
            throw new Error('Resposta vazia recebida do modelo Gemini ao analisar comprovante.');
          }

          const parsed = JSON.parse(responseText) as ExtractedReceiptData;

          // Limpar qualquer caractere não numérico do documento
          if (parsed.providerDocument) {
            parsed.providerDocument = parsed.providerDocument.replace(/\D/g, '');
          }

          return parsed;
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
