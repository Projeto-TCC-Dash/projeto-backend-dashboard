import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { FiscalProofDocumentModel } from '../../src/models/fiscal-proof.model.js';
import { UserModel } from '../../src/models/user.model.js';
import { AuthService } from '../../src/services/auth.service.js';
import { FiscalOcrService } from '../../src/services/fiscal-ocr.service.js';
import { FiscalService } from '../../src/services/fiscal.service.js';

describe('Fiscal OCR Routes Integration Tests', () => {
  const app = buildApp();
  const testUserId = new mongoose.Types.ObjectId().toString();
  const boundary = '----WebKitFormBoundaryFiscalTest123';
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({ id: testUserId, email: 'ocr.teste@exemplo.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/fiscal/ocr deve retornar 401 se não autenticado', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/fiscal/ocr',
    });

    expect(res.statusCode).toBe(401);
  });

  it('POST /api/fiscal/ocr deve retornar 403 se o usuário não possuir chave BYOK', async () => {
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        hasAiKey: () => false,
      }),
    } as any);

    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="recibo.pdf"',
      'Content-Type: application/pdf',
      '',
      '%PDF-1.4 dummy pdf content',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const res = await app.inject({
      method: 'POST',
      url: '/api/fiscal/ocr',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: Buffer.from(payload),
    });

    expect(res.statusCode).toBe(403);
  });

  it('POST /api/fiscal/ocr deve retornar 400 se formato não for permitido', async () => {
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        hasAiKey: () => true,
      }),
    } as any);

    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="documento.txt"',
      'Content-Type: text/plain',
      '',
      'Texto qualquer',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const res = await app.inject({
      method: 'POST',
      url: '/api/fiscal/ocr',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: Buffer.from(payload),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Formato de arquivo não suportado');
  });

  it('POST /api/fiscal/ocr deve processar arquivo, chamar OCR e retornar dados estruturados', async () => {
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        hasAiKey: () => true,
      }),
    } as any);

    vi.spyOn(AuthService, 'getDecryptedApiKey').mockResolvedValueOnce('mock-gemini-key');

    vi.spyOn(FiscalOcrService, 'extractReceiptData').mockResolvedValueOnce({
      providerDocument: '12345678000195',
      providerName: 'Hospital São Luiz',
      totalAmount: 850,
      issueDate: '2026-11-10T14:00:00.000Z',
      description: 'Consulta médica',
    });

    const mockProofDoc: any = {
      _id: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(testUserId),
      originalFilename: 'recibo.pdf',
    };
    vi.spyOn(FiscalProofDocumentModel, 'create').mockResolvedValueOnce(mockProofDoc);

    vi.spyOn(FiscalService, 'findSuggestedMatches').mockResolvedValueOnce([
      {
        transactionId: new mongoose.Types.ObjectId().toString(),
        date: new Date('2026-11-10T00:00:00Z'),
        amount: -850,
        cleanDescription: 'HOSPITAL SAO LUIZ',
        confidence: 'HIGH',
      },
    ]);

    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="recibo.pdf"',
      'Content-Type: application/pdf',
      '',
      '%PDF-1.4 dummy pdf content for test',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const res = await app.inject({
      method: 'POST',
      url: '/api/fiscal/ocr',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: Buffer.from(payload),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.proofDocumentId).toBe(mockProofDoc._id.toString());
    expect(body.extractedData.providerName).toBe('Hospital São Luiz');
    expect(body.extractedData.totalAmount).toBe(850);
    expect(body.suggestedMatches).toHaveLength(1);
    expect(body.suggestedMatches[0].confidence).toBe('HIGH');
  });
});
