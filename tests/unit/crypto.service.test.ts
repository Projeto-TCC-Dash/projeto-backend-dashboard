import { describe, expect, it } from 'vitest';
import { CryptoService } from '../../src/services/crypto.service.js';

describe('CryptoService (AES-256-GCM)', () => {
  it('deve criptografar e descriptografar uma string com sucesso', () => {
    const secretText = 'AIzaSyTestApiKeyForGemini12345';
    const encrypted = CryptoService.encrypt(secretText);

    expect(encrypted.encryptedText).toBeDefined();
    expect(encrypted.iv).toHaveLength(24); // 12 bytes em hex = 24 caracteres
    expect(encrypted.authTag).toHaveLength(32); // 16 bytes em hex = 32 caracteres

    const decrypted = CryptoService.decrypt(
      encrypted.encryptedText,
      encrypted.iv,
      encrypted.authTag
    );

    expect(decrypted).toBe(secretText);
  });

  it('deve gerar IVs diferentes para chamadas subsequentes com o mesmo texto', () => {
    const secretText = 'AIzaSyDuplicateTest';
    const enc1 = CryptoService.encrypt(secretText);
    const enc2 = CryptoService.encrypt(secretText);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.encryptedText).not.toBe(enc2.encryptedText);
  });

  it('deve falhar e lançar erro se a tag de autenticação for adulterada', () => {
    const secretText = 'MensagemAutenticada';
    const encrypted = CryptoService.encrypt(secretText);

    // Altera o último caractere da tag
    const tamperedTag =
      encrypted.authTag.slice(0, -1) + (encrypted.authTag.endsWith('0') ? '1' : '0');

    expect(() => {
      CryptoService.decrypt(encrypted.encryptedText, encrypted.iv, tamperedTag);
    }).toThrow();
  });
});
