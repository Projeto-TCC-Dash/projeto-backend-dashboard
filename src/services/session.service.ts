import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { SESSION_CONFIG } from '../config/constants.js';
import { ISession, SessionModel } from '../models/session.model.js';

export class SessionService {
  /**
   * Cria uma nova sessão persistida no MongoDB associada ao usuário.
   */
  public static async createSession(
    userId: string | mongoose.Types.ObjectId,
    metadata?: { userAgent?: string; ip?: string }
  ): Promise<ISession> {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_CONFIG.SESSION_TTL_MS);

    const session = await SessionModel.create({
      _id: sessionId,
      userId: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId,
      isRevoked: false,
      userAgent: metadata?.userAgent || null,
      ip: metadata?.ip || null,
      expiresAt,
    });

    return session;
  }

  /**
   * Verifica se uma sessão está ativa e não foi revogada.
   */
  public static async isSessionActive(sessionId: string): Promise<boolean> {
    if (!sessionId) {
      return false;
    }

    const session = await SessionModel.findById(sessionId).select('isRevoked expiresAt').exec();
    if (!session) {
      // Se não encontrou no banco, a sessão é considerada inválida/inexistente
      return false;
    }

    if (session.isRevoked) {
      return false;
    }

    if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
      return false;
    }

    return true;
  }

  /**
   * Revoga uma sessão pontual (logout no dispositivo atual).
   */
  public static async revokeSession(sessionId: string): Promise<boolean> {
    const updated = await SessionModel.findByIdAndUpdate(
      sessionId,
      {
        isRevoked: true,
        revokedAt: new Date(),
      },
      { new: true }
    ).exec();

    return !!updated;
  }

  /**
   * Revoga todas as sessões ativas do usuário (logout global / todos os dispositivos).
   */
  public static async revokeAllUserSessions(
    userId: string | mongoose.Types.ObjectId
  ): Promise<number> {
    const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    const result = await SessionModel.updateMany(
      {
        userId: userObjectId,
        isRevoked: false,
      },
      {
        isRevoked: true,
        revokedAt: new Date(),
      }
    ).exec();

    return result.modifiedCount;
  }
}
