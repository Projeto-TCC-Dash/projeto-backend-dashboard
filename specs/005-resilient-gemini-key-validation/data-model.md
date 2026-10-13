# Data Model: Validação Resiliente e Semântica de Erros da Chave Gemini (BYOK)

**Feature**: `005-resilient-gemini-key-validation`  
**Date**: 2026-10-13  
**Status**: Completed

Este documento especifica as estruturas de dados e tipagens associadas à classificação de erros do Gemini e ao ciclo de vida da chave de IA do usuário.

---

## 1. Tipos e Contratos de Erro do Gemini

### `GeminiErrorType`
Enumeração dos domínios semânticos de erro:
```typescript
export type GeminiErrorType =
  | 'AUTH_ERROR'            // Chave inválida, ausente ou revogada (Google 400/401/403)
  | 'RATE_LIMIT_ERROR'       // Limite de taxa ou cota esgotada (Google 429)
  | 'UPSTREAM_UNAVAILABLE'   // Indisponibilidade temporária ou alta demanda (Google 503 / timeouts)
  | 'NETWORK_ERROR'          // Falha de conectividade (DNS, timeout local)
  | 'UNKNOWN_ERROR';         // Qualquer outro erro não mapeado
```

### `ParsedGeminiError`
Representação normalizada de um erro gerado pela API do Google AI Studio:
```typescript
export interface ParsedGeminiError {
  type: GeminiErrorType;
  statusCode: number;       // Código HTTP a ser emitido na API (400, 429, 503, 500)
  userMessage: string;      // Mensagem clara em português para exibição ao usuário
  isTransient: boolean;     // Se o erro pode ser mitigado com retry
  originalMessage: string;  // Mensagem original para logs internos
}
```

### `ValidationResult`
Resultado da operação de validação da API Key:
```typescript
export type KeyValidationStatus = 'ACTIVE_VERIFIED' | 'ACTIVE_PROVISIONAL_DEMAND';

export interface KeyValidationResult {
  status: KeyValidationStatus;
  message: string;
}
```

---

## 2. Contratos de API (Request / Response)

### `PUT /api/user/ai-key`

#### Request Body
```json
{
  "apiKey": "AIzaSy..."
}
```
*Regras de Validação*:
- `apiKey`: string, obrigatória, mínimo 20 caracteres, sem espaços em branco.

#### Response Body (200 OK - Sucesso Imediato)
```json
{
  "message": "Chave de IA configurada e ativada com sucesso!",
  "status": "ACTIVE_VERIFIED"
}
```

#### Response Body (200 OK - Sucesso sob Alta Demanda Upstream)
```json
{
  "message": "Chave de IA vinculada com sucesso! O Google AI Studio está com alta demanda temporária no momento, mas sua chave foi reconhecida e salva.",
  "status": "ACTIVE_PROVISIONAL_DEMAND"
}
```

#### Response Body (400 Bad Request - Erro de Autenticação Real)
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "A chave de API fornecida é inválida ou foi revogada no Google AI Studio."
}
```

---

## 3. Entidades no Banco de Dados (Mongoose)

O modelo `UserModel` existente armazena:
- `encryptedApiKey`: Chave criptografada com AES-256-GCM (string).
- `iv`: Vetor de inicialização de 12 bytes (string).
- `authTag`: Tag de autenticação de 16 bytes (string).

Não é necessária nenhuma alteração no esquema do MongoDB, preservando 100% da compatibilidade regressiva.
