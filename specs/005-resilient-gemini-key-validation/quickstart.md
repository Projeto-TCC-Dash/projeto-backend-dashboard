# Quickstart & Scenarios: Validação Resiliente e Semântica de Erros da Chave Gemini (BYOK)

**Feature**: `005-resilient-gemini-key-validation`  
**Date**: 2026-10-13  
**Status**: Completed

Este documento descreve como testar e verificar os cenários de resiliência e tratamento semântico de erros da integração com o Gemini.

---

## 1. Cenário de Teste: Cadastro de Chave sob Alta Demanda (503 UNAVAILABLE)

### Objetivo
Confirmar que quando o Google AI Studio responder com 503 ("This model is currently experiencing high demand"), o endpoint `PUT /api/user/ai-key` salva a chave e responde com `200 OK`, em vez de rejeitar com `400 Bad Request`.

### Passo a Passo
1. Autentique-se para obter um token JWT:
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"teste.usuario@exemplo.com","password":"SenhaForte#123"}' \
     | jq -r .token)
   ```

2. Envie uma chave de API que simule ou enfrente erro 503:
   ```bash
   curl -i -X PUT http://localhost:3000/api/user/ai-key \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"apiKey":"AIzaSyExemploChaveValidaComErro503NoGoogle123"}'
   ```

3. **Resultado Esperado**:
   - Status HTTP: `200 OK`
   - Resposta:
     ```json
     {
       "message": "Chave de IA vinculada com sucesso! O Google AI Studio está com alta demanda temporária no momento, mas sua chave foi reconhecida e salva.",
       "status": "ACTIVE_PROVISIONAL_DEMAND"
     }
     ```
   - No MongoDB: A chave do usuário está devidamente criptografada com AES-256-GCM.

---

## 2. Cenário de Teste: Cadastro de Chave Inexistente / Falsa (400 / 403)

### Objetivo
Confirmar que chaves comprovadamente inválidas continuam sendo rejeitadas com `400 Bad Request`.

### Passo a Passo
1. Envie uma chave com formato inexistente:
   ```bash
   curl -i -X PUT http://localhost:3000/api/user/ai-key \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"apiKey":"AIzaSyChaveFalsaTotalmenteInvalida9999"}'
   ```

2. **Resultado Esperado**:
   - Status HTTP: `400 Bad Request`
   - Resposta:
     ```json
     {
       "statusCode": 400,
       "error": "Bad Request",
       "message": "A chave de API fornecida é inválida ou foi revogada no Google AI Studio."
     }
     ```

---

## 3. Cenário de Teste: Categorização / Chat sob Indisponibilidade Upstream

### Objetivo
Confirmar que chamadas às rotas de IA retornam status `503 Service Unavailable` em vez de `500` genérico ou `400`.

### Passo a Passo
1. Dispare a rota de categorização quando o Gemini estiver indisponível:
   ```bash
   curl -i -X POST http://localhost:3000/api/transactions/categorize \
     -H "Authorization: Bearer $TOKEN"
   ```

2. **Resultado Esperado**:
   - Status HTTP: `503 Service Unavailable`
   - Resposta com mensagem clara orientando tentar em instantes devido à alta demanda no Google.
