# Research & Architectural Decisions: Validação Resiliente e Semântica de Erros da Chave Gemini (BYOK)

**Feature**: `005-resilient-gemini-key-validation`  
**Date**: 2026-10-13  
**Status**: Completed

Este documento consolida as decisões arquiteturais e técnicas para a classificação semântica de erros upstream do Google Gemini e a resiliência no cadastro e uso de chaves BYOK.

---

## 1. Mapeamento de Erros Upstream do Google AI Studio

### Contexto & Problema
Quando um usuário fornece uma chave de API para o Google AI Studio, a requisição passa por múltiplas camadas na infraestrutura do Google:
1. **API Gateway / Cloud Endpoints**: Valida a chave e o projeto associado. Se a chave for inexistente, malformada ou revogada, a requisição é barrada imediatamente com `400 Bad Request` (`API key not valid`) ou `403 Forbidden` (`PERMISSION_DENIED`).
2. **Quota & Rate Limiting**: Valida os limites do plano (Free Tier vs Pay-as-you-go).
3. **Cluster de Servidores do Modelo**: Executa a inferência. No Free Tier, quando há sobrecarga momentânea de requisições globais, o cluster devolve `503 UNAVAILABLE` (`This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.`).

### Decisão
Criar o módulo `GeminiErrorParser` em `src/utils/gemini-errors.ts` que inspeciona o objeto ou mensagem de erro do SDK `@google/genai` e classifica em três domínios estritos:
- **`AUTH_ERROR`**: Erros de chave (400 `API key not valid`, 403 `PERMISSION_DENIED`). Mapeado para HTTP 400.
- **`RATE_LIMIT_ERROR`**: Erros de cota (429 `RESOURCE_EXHAUSTED`). Mapeado para HTTP 429.
- **`UPSTREAM_UNAVAILABLE`**: Erros de alta demanda ou rede (503 `UNAVAILABLE`, timeouts, `ECONNRESET`). Mapeado para HTTP 503.

### Alternativas Consideradas
- *Tratar qualquer erro como 400*: Abordagem anterior descartada por gerar falsos positivos graves e impedir onboarding de usuários sob picos de 503 do Google.
- *Tratar erros desconhecidos como 500 genérico*: Descartada porque mascara a real causa de indisponibilidade de terceiros e dificulta a ação do usuário.

---

## 2. Aceite Provisório de Chaves sob Alta Demanda Upstream (503/429)

### Contexto
O erro 503 (`UNAVAILABLE`) só ocorre **após** a chave ter sido validada e autorizada pelo gateway do Google. Tratar 503 como falha de cadastro da chave impede o usuário de salvar sua chave válida.

### Decisão
No endpoint `PUT /api/user/ai-key`:
1. **Validação Sintática**: Verificar formato mínimo da chave localmente (mínimo de 20 caracteres alfanuméricos com prefixo típico, rejeitando espaços ou strings vazias imediatamente com 400).
2. **Ping de Validação**:
   - Se responder `200 OK`: A chave é salva e a API retorna `200 OK` com status `ACTIVE_VERIFIED`.
   - Se responder `503 UNAVAILABLE` ou `429 RESOURCE_EXHAUSTED`: Como a chave comprovadamente superou o gateway de autenticação do Google, ela é salva criptografada (AES-256-GCM) no banco e a API responde `200 OK` informando que a chave foi vinculada com sucesso e que o provedor está em alta demanda temporária.
   - Se responder `AUTH_ERROR` (400/401/403): A chave é rejeitada com `400 Bad Request` indicando credencial inválida.

### Alternativas Consideradas
- *Retornar 202 Accepted em vez de 200 OK*: Embora 202 seja semanticamente válido, 200 OK simplifica o contrato para clientes front-end existentes sem quebrar validações de schemas Zod. A mensagem descritiva no payload diferencia a ativação imediata da notificação de alta demanda.

---

## 3. Política de Retentativa com Backoff (Retry Transitório)

### Contexto
Spikes de demanda no Gemini duram frequentemente entre 200ms e 1000ms. Uma retentativa rápida evita propagar o erro ao usuário.

### Decisão
Implementar um utilitário `withGeminiRetry` com:
- Máximo de 2 retentativas para erros com `isTransient: true` (`503` e `429`).
- Intervalo de backoff curto (500ms na 1ª retentativa).
- Erros de autenticação (`AUTH_ERROR`) falham imediatamente sem retry.

---

## 4. Conformidade com a Constituição v2.0.0

| Princípio | Avaliação |
|---|---|
| **I. Escopo Estrito de Backend** | Implementação com TypeScript estrito, tipos explícitos para o parser de erros, sem `any`. |
| **II. Stack Tecnológica** | Fastify, Zod e Mongoose mantidos como núcleo. |
| **III. BYOK & Custo Zero** | Chave do usuário continua criptografada com AES-256-GCM no MongoDB. |
| **IV. Minimização de Tokens** | Pings de validação permanecem mínimos e otimizados. |
| **VII. Stateless & LGPD** | Nenhuma PII ou chave em texto claro é logada. |
