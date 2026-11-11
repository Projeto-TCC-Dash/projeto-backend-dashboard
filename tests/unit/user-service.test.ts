import { describe, expect, it, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import fs from 'node:fs';
import { UserModel } from '../../src/models/user.model.js';
import { AnalysisService } from '../../src/services/analysis.service.js';
import {
  UserService,
  UserNotFoundError,
  InvalidAvatarFileError,
} from '../../src/services/user.service.js';

describe('UserService - Unit Tests', () => {
  const mockUserId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getProfile', () => {
    it('deve retornar o perfil do usuário incluindo financialProfile, name, avatarUrl, security e hasAiKey', async () => {
      const mockCreatedAt = new Date('2026-01-10T10:00:00Z');
      const mockUser = {
        _id: new mongoose.Types.ObjectId(mockUserId),
        email: 'investidor@teste.com',
        name: 'Débora Goulart',
        avatarUrl: '/uploads/avatars/user-123.webp',
        passwordHash: 'hashed_password',
        encryptedApiKey: 'encrypted_key',
        createdAt: mockCreatedAt,
        hasAiKey: () => true,
        financialProfile: {
          incomeType: 'PJ_AUTONOMO',
          declaredMonthlyIncome: 12000,
          goals: ['RESERVA_EMERGENCIA', 'INVESTIR_LONGO_PRAZO'],
          riskProfile: 'MODERATE',
          updatedAt: new Date('2026-10-19T20:00:00Z'),
        },
      };

      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockUser as any);

      const profile = await UserService.getProfile(mockUserId);

      expect(profile).toEqual({
        id: mockUserId,
        email: 'investidor@teste.com',
        name: 'Débora Goulart',
        avatarUrl: '/uploads/avatars/user-123.webp',
        hasAiKey: true,
        security: {
          hasLocalPassword: true,
          googleLinked: false,
        },
        financialProfile: {
          incomeType: 'PJ_AUTONOMO',
          declaredMonthlyIncome: 12000,
          goals: ['RESERVA_EMERGENCIA', 'INVESTIR_LONGO_PRAZO'],
          riskProfile: 'MODERATE',
          updatedAt: new Date('2026-10-19T20:00:00Z'),
        },
        createdAt: mockCreatedAt,
      });
      expect(UserModel.findById).toHaveBeenCalledWith(mockUserId);
    });

    it('deve lançar UserNotFoundError se o usuário não for encontrado', async () => {
      vi.spyOn(UserModel, 'findById').mockResolvedValueOnce(null);

      await expect(UserService.getProfile(mockUserId)).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('updateFinancialProfile', () => {
    it('deve atualizar o financialProfile, definir updatedAt e invalidar cache de análises', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(mockUserId),
        email: 'investidor@teste.com',
        hasAiKey: () => false,
        financialProfile: {
          incomeType: 'CLT',
          declaredMonthlyIncome: 5000,
          goals: ['RESERVA_EMERGENCIA'],
          riskProfile: 'CONSERVATIVE',
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
        save: vi.fn().mockImplementation(async function () {
          return mockUser;
        }),
      };

      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockUser as any);
      const invalidateSpy = vi.spyOn(AnalysisService, 'invalidate').mockResolvedValueOnce(2);

      const updatePayload = {
        incomeType: 'PJ_AUTONOMO' as const,
        declaredMonthlyIncome: 10000,
        goals: ['RESERVA_EMERGENCIA' as const, 'QUITAR_DIVIDAS' as const],
        riskProfile: 'MODERATE' as const,
      };

      const result = await UserService.updateFinancialProfile(mockUserId, updatePayload);

      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.financialProfile.incomeType).toBe('PJ_AUTONOMO');
      expect(mockUser.financialProfile.declaredMonthlyIncome).toBe(10000);
      expect(mockUser.financialProfile.goals).toEqual(['RESERVA_EMERGENCIA', 'QUITAR_DIVIDAS']);
      expect(mockUser.financialProfile.riskProfile).toBe('MODERATE');
      expect(mockUser.financialProfile.updatedAt).toBeInstanceOf(Date);
      expect(invalidateSpy).toHaveBeenCalledWith(mockUserId);
      expect(result.id).toBe(mockUserId);
    });

    it('deve lançar UserNotFoundError se o usuário a ser atualizado não existir', async () => {
      vi.spyOn(UserModel, 'findById').mockResolvedValueOnce(null);

      await expect(
        UserService.updateFinancialProfile(mockUserId, { incomeType: 'CLT' })
      ).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('updateProfileName', () => {
    it('deve atualizar o nome de exibição do usuário e retornar o perfil completo', async () => {
      const mockCreatedAt = new Date('2026-01-10T10:00:00Z');
      const mockUser = {
        _id: new mongoose.Types.ObjectId(mockUserId),
        email: 'investidor@teste.com',
        name: 'Nome Antigo',
        avatarUrl: null,
        passwordHash: 'hashed_password',
        createdAt: mockCreatedAt,
        hasAiKey: () => false,
        financialProfile: undefined,
        save: vi.fn().mockImplementation(async function () {
          return mockUser;
        }),
      };

      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockUser as any);

      const result = await UserService.updateProfileName(mockUserId, 'Débora Goulart');

      expect(mockUser.name).toBe('Débora Goulart');
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.name).toBe('Débora Goulart');
      expect(result.id).toBe(mockUserId);
    });

    it('deve lançar UserNotFoundError se o usuário não for encontrado', async () => {
      vi.spyOn(UserModel, 'findById').mockResolvedValueOnce(null);

      await expect(UserService.updateProfileName(mockUserId, 'Nome')).rejects.toThrow(
        UserNotFoundError
      );
    });
  });

  describe('uploadAvatar', () => {
    it('deve fazer upload de avatar válido (PNG) e salvar no disco e no usuário', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(mockUserId),
        email: 'investidor@teste.com',
        avatarUrl: null,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockUser as any);
      vi.spyOn(fs.promises, 'writeFile').mockResolvedValue();
      vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined as any);

      const buffer = Buffer.from('fake-png-content');
      const result = await UserService.uploadAvatar(mockUserId, {
        buffer,
        mimetype: 'image/png',
        filename: 'foto.png',
      });

      expect(result.success).toBe(true);
      expect(result.avatarUrl).toMatch(/^\/uploads\/avatars\/.*\.png$/);
      expect(mockUser.avatarUrl).toBe(result.avatarUrl);
      expect(mockUser.save).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('deve rejeitar arquivo com mimetype inválido', async () => {
      const buffer = Buffer.from('fake-pdf');
      await expect(
        UserService.uploadAvatar(mockUserId, {
          buffer,
          mimetype: 'application/pdf',
          filename: 'doc.pdf',
        })
      ).rejects.toThrow(InvalidAvatarFileError);
    });

    it('deve rejeitar arquivo que exceda 5MB', async () => {
      const bigBuffer = Buffer.alloc(6 * 1024 * 1024);
      await expect(
        UserService.uploadAvatar(mockUserId, {
          buffer: bigBuffer,
          mimetype: 'image/jpeg',
          filename: 'grande.jpg',
        })
      ).rejects.toThrow(InvalidAvatarFileError);
    });

    it('deve remover avatar antigo do disco ao substituir por um novo', async () => {
      const oldAvatar = `/uploads/avatars/${mockUserId}-antigo.jpg`;
      const mockUser = {
        _id: new mongoose.Types.ObjectId(mockUserId),
        email: 'investidor@teste.com',
        avatarUrl: oldAvatar,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockUser as any);
      vi.spyOn(fs.promises, 'writeFile').mockResolvedValue();
      const unlinkSpy = vi.spyOn(fs.promises, 'unlink').mockResolvedValue();
      vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined as any);

      const buffer = Buffer.from('fake-webp');
      const result = await UserService.uploadAvatar(mockUserId, {
        buffer,
        mimetype: 'image/webp',
        filename: 'novo.webp',
      });

      expect(unlinkSpy).toHaveBeenCalled();
      expect(result.avatarUrl).toMatch(/\.webp$/);
    });

    it('deve lançar UserNotFoundError se o usuário não for encontrado', async () => {
      vi.spyOn(UserModel, 'findById').mockResolvedValueOnce(null);

      await expect(
        UserService.uploadAvatar(mockUserId, {
          buffer: Buffer.from('test'),
          mimetype: 'image/jpeg',
          filename: 'test.jpg',
        })
      ).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('deleteAvatar', () => {
    it('deve remover avatar existente do disco e atualizar avatarUrl para null', async () => {
      const oldAvatar = `/uploads/avatars/${mockUserId}-foto.png`;
      const mockUser = {
        _id: new mongoose.Types.ObjectId(mockUserId),
        email: 'investidor@teste.com',
        avatarUrl: oldAvatar,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockUser as any);
      const unlinkSpy = vi.spyOn(fs.promises, 'unlink').mockResolvedValue();

      const result = await UserService.deleteAvatar(mockUserId);

      expect(unlinkSpy).toHaveBeenCalled();
      expect(mockUser.avatarUrl).toBeNull();
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Avatar removido com sucesso',
        avatarUrl: null,
      });
    });

    it('deve ser idempotente quando o usuário não tiver avatar cadastrado', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(mockUserId),
        email: 'investidor@teste.com',
        avatarUrl: null,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockUser as any);
      const unlinkSpy = vi.spyOn(fs.promises, 'unlink').mockResolvedValue();

      const result = await UserService.deleteAvatar(mockUserId);

      expect(unlinkSpy).not.toHaveBeenCalled();
      expect(result.avatarUrl).toBeNull();
    });

    it('deve lançar UserNotFoundError se o usuário não for encontrado ao deletar avatar', async () => {
      vi.spyOn(UserModel, 'findById').mockResolvedValueOnce(null);

      await expect(UserService.deleteAvatar(mockUserId)).rejects.toThrow(UserNotFoundError);
    });
  });
});
