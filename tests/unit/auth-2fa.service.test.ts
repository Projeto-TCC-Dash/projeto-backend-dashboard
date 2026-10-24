import bcrypt from 'bcryptjs';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { TwoFactorChallengeModel } from '../../src/models/two-factor-challenge.model.js';
import { UserModel } from '../../src/models/user.model.js';
import { AuthService } from '../../src/services/auth.service.js';
import { EmailService } from '../../src/services/email.service.js';
import { SessionService } from '../../src/services/session.service.js';

describe('AuthService - 2FA Unit Tests', () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockChallengeId = new mongoose.Types.ObjectId();
  const mockEmail = 'investidor@teste.com';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateOtp & hashOtp', () => {
    it('deve gerar código numérico de exatamente 6 dígitos', () => {
      const code = AuthService.generateOtp();
      expect(code).toMatch(/^\d{6}$/);
      const num = parseInt(code, 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThan(1000000);
    });

    it('deve calcular e validar hash SHA-256 de tempo constante', () => {
      const code = '123456';
      const hash = AuthService.hashOtp(code);
      expect(hash).toHaveLength(64);
      expect(AuthService.verifyOtpHash('123456', hash)).toBe(true);
      expect(AuthService.verifyOtpHash('654321', hash)).toBe(false);
      expect(AuthService.verifyOtpHash('12345', hash)).toBe(false);
    });
  });

  describe('login com interceptação 2FA', () => {
    it('deve emitir desafio e enviar e-mail se isTwoFactorEnabled = true', async () => {
      const mockUser = {
        _id: mockUserId,
        email: mockEmail,
        passwordHash: '$2a$10$hashed_password_mock',
        isTwoFactorEnabled: true,
        hasAiKey: () => false,
      };

      vi.spyOn(UserModel, 'findOne').mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      } as any);

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as any);

      vi.spyOn(TwoFactorChallengeModel, 'updateMany').mockReturnValue({
        exec: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      } as any);

      vi.spyOn(TwoFactorChallengeModel, 'create').mockResolvedValue({
        _id: mockChallengeId,
        userId: mockUserId,
      } as any);

      const emailSpy = vi.spyOn(EmailService, 'sendOtpEmail').mockResolvedValue(true);

      const result = await AuthService.login(
        { email: mockEmail, password: 'Senha123!' },
        () => 'fake-jwt'
      );

      expect(result).toHaveProperty('requires2FA', true);
      expect(result).toHaveProperty('challengeId', mockChallengeId.toString());
      expect(emailSpy).toHaveBeenCalledWith(mockEmail, expect.any(String), 'LOGIN');
    });
  });

  describe('verify2FA', () => {
    it('deve validar com sucesso e emitir sessão quando o código for correto', async () => {
      const otpCode = '654321';
      const otpHash = AuthService.hashOtp(otpCode);

      const mockChallenge = {
        _id: mockChallengeId,
        userId: mockUserId,
        type: 'LOGIN',
        otpHash,
        attempts: 0,
        maxAttempts: 5,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 600_000),
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(TwoFactorChallengeModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockChallenge),
      } as any);

      const mockUser = {
        _id: mockUserId,
        email: mockEmail,
        isTwoFactorEnabled: true,
        hasAiKey: () => true,
      };

      vi.spyOn(UserModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      } as any);

      vi.spyOn(SessionService, 'createSession').mockResolvedValue({
        _id: 'mock-session-uuid',
      } as any);

      const jwtSigner = vi.fn().mockReturnValue('jwt-final-com-session');

      const result = await AuthService.verify2FA(
        {
          challengeId: mockChallengeId.toString(),
          code: otpCode,
        },
        jwtSigner
      );

      expect(result.token).toBe('jwt-final-com-session');
      expect(mockChallenge.status).toBe('VERIFIED');
      expect(mockChallenge.save).toHaveBeenCalled();
      expect(jwtSigner).toHaveBeenCalledWith({
        id: mockUserId.toString(),
        email: mockEmail,
        sessionId: 'mock-session-uuid',
      });
    });

    it('deve incrementar tentativas e lançar erro se o código for incorreto', async () => {
      const mockChallenge = {
        _id: mockChallengeId,
        userId: mockUserId,
        type: 'LOGIN',
        otpHash: AuthService.hashOtp('654321'),
        attempts: 2,
        maxAttempts: 5,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 600_000),
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(TwoFactorChallengeModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockChallenge),
      } as any);

      await expect(
        AuthService.verify2FA(
          { challengeId: mockChallengeId.toString(), code: '000000' },
          () => 'token'
        )
      ).rejects.toThrow('Código de verificação incorreto. Tentativas restantes: 2');

      expect(mockChallenge.attempts).toBe(3);
      expect(mockChallenge.save).toHaveBeenCalled();
    });

    it('deve bloquear o desafio se atingir 5 tentativas incorretas', async () => {
      const mockChallenge = {
        _id: mockChallengeId,
        userId: mockUserId,
        type: 'LOGIN',
        otpHash: AuthService.hashOtp('654321'),
        attempts: 4,
        maxAttempts: 5,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 600_000),
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(TwoFactorChallengeModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockChallenge),
      } as any);

      await expect(
        AuthService.verify2FA(
          { challengeId: mockChallengeId.toString(), code: '000000' },
          () => 'token'
        )
      ).rejects.toThrow('Desafio bloqueado após 5 tentativas incorretas');

      expect(mockChallenge.attempts).toBe(5);
      expect(mockChallenge.status).toBe('LOCKED');
    });
  });
});
