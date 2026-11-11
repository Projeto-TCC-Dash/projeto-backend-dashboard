import { describe, expect, it, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { SessionModel } from '../../src/models/session.model.js';
import { SessionService } from '../../src/services/session.service.js';

describe('SessionService - Unit Tests', () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockSessionId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSession', () => {
    it('deve gerar UUID e persistir nova sessão com status isRevoked=false', async () => {
      vi.spyOn(SessionModel, 'create').mockResolvedValueOnce({
        _id: mockSessionId,
        userId: mockUserId,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 604800_000),
      } as any);

      const session = await SessionService.createSession(mockUserId, {
        userAgent: 'Mozilla/5.0 Vitest',
        ip: '127.0.0.1',
      });

      expect(session).toBeDefined();
      expect(session.isRevoked).toBe(false);
      expect(SessionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: expect.any(String),
          userId: mockUserId,
          isRevoked: false,
          userAgent: 'Mozilla/5.0 Vitest',
          ip: '127.0.0.1',
          expiresAt: expect.any(Date),
        })
      );
    });
  });

  describe('isSessionActive', () => {
    it('deve retornar false se sessionId for nulo ou vazio', async () => {
      expect(await SessionService.isSessionActive('')).toBe(false);
    });

    it('deve retornar false se a sessão não for encontrada no banco', async () => {
      vi.spyOn(SessionModel, 'findById').mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          exec: vi.fn().mockResolvedValueOnce(null),
        }),
      } as any);

      expect(await SessionService.isSessionActive(mockSessionId)).toBe(false);
    });

    it('deve retornar false se a sessão estiver marcada como isRevoked: true', async () => {
      vi.spyOn(SessionModel, 'findById').mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          exec: vi.fn().mockResolvedValueOnce({
            _id: mockSessionId,
            isRevoked: true,
            expiresAt: new Date(Date.now() + 60000),
          }),
        }),
      } as any);

      expect(await SessionService.isSessionActive(mockSessionId)).toBe(false);
    });

    it('deve retornar false se a sessão estiver expirada por tempo', async () => {
      vi.spyOn(SessionModel, 'findById').mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          exec: vi.fn().mockResolvedValueOnce({
            _id: mockSessionId,
            isRevoked: false,
            expiresAt: new Date(Date.now() - 1000), // Expirou há 1s
          }),
        }),
      } as any);

      expect(await SessionService.isSessionActive(mockSessionId)).toBe(false);
    });

    it('deve retornar true quando a sessão for válida e não revogada', async () => {
      vi.spyOn(SessionModel, 'findById').mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          exec: vi.fn().mockResolvedValueOnce({
            _id: mockSessionId,
            isRevoked: false,
            expiresAt: new Date(Date.now() + 600000),
          }),
        }),
      } as any);

      expect(await SessionService.isSessionActive(mockSessionId)).toBe(true);
    });
  });

  describe('revokeSession & revokeAllUserSessions', () => {
    it('revokeSession deve atualizar isRevoked para true e registrar data', async () => {
      vi.spyOn(SessionModel, 'findByIdAndUpdate').mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce({
          _id: mockSessionId,
          isRevoked: true,
          revokedAt: new Date(),
        }),
      } as any);

      const result = await SessionService.revokeSession(mockSessionId);
      expect(result).toBe(true);
      expect(SessionModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockSessionId,
        expect.objectContaining({ isRevoked: true, revokedAt: expect.any(Date) }),
        { new: true }
      );
    });

    it('revokeAllUserSessions deve revogar todas as sessões do usuário via updateMany', async () => {
      vi.spyOn(SessionModel, 'updateMany').mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce({
          modifiedCount: 4,
        }),
      } as any);

      const count = await SessionService.revokeAllUserSessions(mockUserId.toString());
      expect(count).toBe(4);
      expect(SessionModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ userId: mockUserId, isRevoked: false }),
        expect.objectContaining({ isRevoked: true, revokedAt: expect.any(Date) })
      );
    });
  });
});
