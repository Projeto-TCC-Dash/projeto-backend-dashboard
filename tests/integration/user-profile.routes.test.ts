import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import {
  UserService,
  UserNotFoundError,
  InvalidAvatarFileError,
} from '../../src/services/user.service.js';

describe('User Profile Routes (HTTP Inject & Contracts)', () => {
  const app = buildApp();
  const testUserId = '507f1f77bcf86cd799439011';
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({ id: testUserId, email: 'perfil@exemplo.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/user/profile', () => {
    it('deve retornar 401 se a requisição não contiver token JWT', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/user/profile',
      });
      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 200 com os dados do perfil do usuário autenticado', async () => {
      vi.spyOn(UserService, 'getProfile').mockResolvedValueOnce({
        id: testUserId,
        email: 'perfil@exemplo.com',
        hasAiKey: true,
        financialProfile: {
          incomeType: 'PJ_AUTONOMO',
          declaredMonthlyIncome: 8500,
          goals: ['RESERVA_EMERGENCIA'],
          riskProfile: 'MODERATE',
          updatedAt: new Date('2026-10-19T10:00:00Z'),
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(testUserId);
      expect(body.email).toBe('perfil@exemplo.com');
      expect(body.hasAiKey).toBe(true);
      expect(body.financialProfile.incomeType).toBe('PJ_AUTONOMO');
      expect(body.financialProfile.declaredMonthlyIncome).toBe(8500);
    });

    it('deve retornar 404 se o usuário não for encontrado', async () => {
      vi.spyOn(UserService, 'getProfile').mockRejectedValueOnce(
        new UserNotFoundError('Usuário não encontrado.')
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/user/profile', () => {
    it('deve retornar 401 se a requisição não contiver token JWT', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/user/profile',
        payload: { incomeType: 'CLT' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 400 se a renda declarada for negativa', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
        payload: { declaredMonthlyIncome: -500 },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.statusCode).toBe(400);
      expect(body.error).toBe('Bad Request');
    });

    it('deve retornar 400 se o regime de renda for um enum inválido', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
        payload: { incomeType: 'REGIME_INEXISTENTE' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 400 se o perfil de risco for um enum inválido', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
        payload: { riskProfile: 'SUPER_RISK' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 400 se uma meta financeira for inválida', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
        payload: { goals: ['COMPRAR_FOGUETE'] },
      });

      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 200 e o perfil atualizado quando o payload for válido', async () => {
      vi.spyOn(UserService, 'updateFinancialProfile').mockResolvedValueOnce({
        id: testUserId,
        email: 'perfil@exemplo.com',
        hasAiKey: false,
        financialProfile: {
          incomeType: 'CLT',
          declaredMonthlyIncome: 6500,
          goals: ['RESERVA_EMERGENCIA', 'QUITAR_DIVIDAS'],
          riskProfile: 'CONSERVATIVE',
          updatedAt: new Date('2026-10-19T21:00:00Z'),
        },
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          incomeType: 'CLT',
          declaredMonthlyIncome: 6500,
          goals: ['RESERVA_EMERGENCIA', 'QUITAR_DIVIDAS'],
          riskProfile: 'CONSERVATIVE',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(testUserId);
      expect(body.financialProfile.incomeType).toBe('CLT');
      expect(body.financialProfile.goals).toEqual(['RESERVA_EMERGENCIA', 'QUITAR_DIVIDAS']);
    });
  });

  describe('PATCH /api/user/profile', () => {
    it('deve retornar 401 se a requisição não contiver token JWT', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/user/profile',
        payload: { name: 'Débora Goulart' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 400 se o nome tiver menos de 2 caracteres', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'A' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 400 se o nome tiver mais de 100 caracteres', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'A'.repeat(101) },
      });
      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 200 e atualizar o nome com sucesso', async () => {
      vi.spyOn(UserService, 'updateProfileName').mockResolvedValueOnce({
        id: testUserId,
        email: 'perfil@exemplo.com',
        name: 'Débora Goulart',
        avatarUrl: null,
        hasAiKey: false,
        security: {
          hasLocalPassword: true,
          googleLinked: false,
        },
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Débora Goulart' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(testUserId);
      expect(body.name).toBe('Débora Goulart');
    });

    it('deve retornar 404 se o usuário não for encontrado', async () => {
      vi.spyOn(UserService, 'updateProfileName').mockRejectedValueOnce(
        new UserNotFoundError('Usuário não encontrado.')
      );

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Débora Goulart' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/user/avatar', () => {
    const boundary = '----WebKitFormBoundaryAvatarTest123';

    it('deve retornar 401 se a requisição não contiver token JWT', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/user/avatar',
      });
      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 400 se nenhum arquivo for enviado no payload multipart', async () => {
      const payload = `--${boundary}--\r\n`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/user/avatar',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: Buffer.from(payload),
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toMatch(/nenhum arquivo/i);
    });

    it('deve retornar 400 se o arquivo for de formato inválido', async () => {
      vi.spyOn(UserService, 'uploadAvatar').mockRejectedValueOnce(
        new InvalidAvatarFileError('Formato de imagem não suportado. Formatos aceitos: JPG, PNG e WebP.')
      );

      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="arquivo.pdf"',
        'Content-Type: application/pdf',
        '',
        'fake-pdf-content',
        `--${boundary}--`,
      ].join('\r\n');

      const res = await app.inject({
        method: 'POST',
        url: '/api/user/avatar',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: Buffer.from(payload),
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toMatch(/não suportado/i);
    });

    it('deve retornar 200 com URL do avatar ao fazer upload válido', async () => {
      vi.spyOn(UserService, 'uploadAvatar').mockResolvedValueOnce({
        success: true,
        message: 'Avatar atualizado com sucesso',
        avatarUrl: `/uploads/avatars/${testUserId}-12345.png`,
      });

      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="foto.png"',
        'Content-Type: image/png',
        '',
        'fake-png-content',
        `--${boundary}--`,
      ].join('\r\n');

      const res = await app.inject({
        method: 'POST',
        url: '/api/user/avatar',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: Buffer.from(payload),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.avatarUrl).toBe(`/uploads/avatars/${testUserId}-12345.png`);
    });
  });

  describe('DELETE /api/user/avatar', () => {
    it('deve retornar 401 se a requisição não contiver token JWT', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/user/avatar',
      });
      expect(res.statusCode).toBe(401);
    });

    it('deve retornar 200 e confirmar a remoção do avatar', async () => {
      vi.spyOn(UserService, 'deleteAvatar').mockResolvedValueOnce({
        success: true,
        message: 'Avatar removido com sucesso',
        avatarUrl: null,
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/user/avatar',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.avatarUrl).toBeNull();
    });
  });

  describe('GET /uploads/avatars/:filename', () => {
    it('deve retornar 404 se a imagem do avatar não for encontrada', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/uploads/avatars/inexistente.png',
      });
      expect(res.statusCode).toBe(404);
    });

    it('deve servir imagem existente com Content-Type adequado', async () => {
      const tempFilename = `test-avatar-${Date.now()}.png`;
      const uploadDir = path.join(process.cwd(), 'uploads/avatars');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const testFilePath = path.join(uploadDir, tempFilename);
      fs.writeFileSync(testFilePath, Buffer.from('fake-image-bytes'));

      try {
        const res = await app.inject({
          method: 'GET',
          url: `/uploads/avatars/${tempFilename}`,
        });

        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('image/png');
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });
  });
});
