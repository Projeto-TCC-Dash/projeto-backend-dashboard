import crypto from 'node:crypto';
import { env } from '../config/env.js';

export interface EncryptedPayload {
  encryptedText: string;
  iv: string;
  authTag: string;
}

export class CryptoService {
  private static getKeyBuffer(): Buffer {
    const rawKey = env.ENCRYPTION_KEY;
    if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
      return Buffer.from(rawKey, 'hex');
    }
    return Buffer.from(rawKey, 'utf-8');
  }

  /**
   * Criptografa uma string utilizando AES-256-GCM.
   * Gera um IV aleatório de 12 bytes (96 bits) e tag de autenticação de 16 bytes (128 bits).
   */
  public static encrypt(plainText: string): EncryptedPayload {
    const key = this.getKeyBuffer();
    const iv = crypto.randomBytes(12); // 96 bits recomendados para GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plainText, 'utf-8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encryptedText: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Descriptografa uma string criptografada com AES-256-GCM.
   * Valida a tag de autenticação para assegurar integridade contra adulteração.
   */
  public static decrypt(encryptedText: string, ivHex: string, authTagHex: string): string {
    const key = this.getKeyBuffer();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
  }
}
