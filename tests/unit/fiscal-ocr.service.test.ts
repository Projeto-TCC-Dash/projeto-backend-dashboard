import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleGenAI } from '@google/genai';
import { FiscalOcrService } from '../../src/services/fiscal-ocr.service.js';

vi.mock('@google/genai');

describe('FiscalOcrService Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve extrair campos estruturados de comprovante via Gemini Multimodal', async () => {
    const mockGenerateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        providerDocument: '12345678000195',
        providerName: 'Hospital São Luiz',
        totalAmount: 450.5,
        issueDate: '2026-11-10T14:30:00.000Z',
        description: 'Consulta médica clínica geral',
      }),
    });

    (GoogleGenAI as any).mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    }));

    const dummyBuffer = Buffer.from('dummy-image-or-pdf-bytes');
    const result = await FiscalOcrService.extractReceiptData(
      'dummy-api-key',
      dummyBuffer,
      'application/pdf'
    );

    expect(result.providerDocument).toBe('12345678000195');
    expect(result.providerName).toBe('Hospital São Luiz');
    expect(result.totalAmount).toBe(450.5);
    expect(result.issueDate).toBe('2026-11-10T14:30:00.000Z');
    expect(result.description).toBe('Consulta médica clínica geral');
  });
});
