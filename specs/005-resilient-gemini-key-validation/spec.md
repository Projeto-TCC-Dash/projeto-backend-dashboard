# Feature Specification: Validação Resiliente e Semântica de Erros da Chave Gemini (BYOK)

**Feature Branch**: `feature/005-resilient-gemini-key-validation`

**Created**: 2026-10-13

**Status**: Implemented

**Input**: User description: "Implementar validação resiliente e semântica de erros na integração com o Gemini (BYOK). No endpoint de cadastro de chave (PUT /api/user/ai-key), se o Google retornar 503 UNAVAILABLE (alta demanda) ou 429 temporário, reconhecer a chave como autenticada pelo gateway do Google, salvá-la criptografada no banco e responder com sucesso (200 OK) e mensagem informativa, rejeitando com 400 Bad Request apenas quando houver erro explícito de autenticação (chave inválida ou revogada). Além disso, padronizar o tratamento de erros do Gemini em toda a API (categorização, chat e análise) para refletir códigos HTTP e mensagens coerentes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Validação Resiliente e Aceite de Chaves sob Alta Demanda Upstream (Priority: P1) 🎯 MVP

Como usuário autenticado cadastrando minha chave de API do Gemini (BYOK) para utilizar recursos de inteligência artificial, desejo que o sistema reconheça e salve minha chave mesmo se os servidores do Google AI Studio estiverem com pico temporário de demanda (503 UNAVAILABLE ou 429 do plano gratuito), pois o fato de a requisição atingir a camada de modelo do Google comprova que a chave foi autenticada com sucesso pelo gateway de segurança do Google, evitando que eu seja bloqueado injustamente com mensagem de chave inválida.

**Why this priority**: É o ponto de entrada da IA na plataforma. O erro 503 é frequente em modelos sob alta demanda no plano gratuito (Free Tier) e dura poucos segundos. Rejeitar a chave com 400 Bad Request gera falsos positivos graves, frustra o usuário e impede o onboarding.

**Independent Test**: Pode ser testado enviando uma requisição `PUT /api/user/ai-key`:
- Quando o Google responder 200 OK, a chave é salva e a API responde 200 OK com confirmação de ativação imediata.
- Quando o Google responder 503 UNAVAILABLE ou 429, a API reconhece a chave como autenticada, salva a chave criptografada com AES-256-GCM no MongoDB e responde 200 OK com mensagem esclarecendo que a chave foi vinculada e o cluster do Google está em alta demanda temporária.
- Quando o Google responder 400/401/403 com erro explícito de credencial inexistente ou revogada, a API rejeita com 400 Bad Request indicando que a chave é inválida.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado fornecendo uma chave Gemini válida, **When** o ping de validação ao Google for bem-sucedido (200 OK), **Then** a chave é criptografada e salva no banco, e o sistema retorna 200 OK com confirmação de ativação.
2. **Given** um usuário autenticado fornecendo uma chave Gemini válida, **When** o Google responder com 503 UNAVAILABLE ("This model is currently experiencing high demand") ou 429 (estouro de cota transitório), **Then** o sistema reconhece a autenticação da chave pelo gateway do Google, persiste a chave criptografada no banco e retorna 200 OK com mensagem informando que a chave foi salva e que o cluster de IA está em alta demanda temporária.
3. **Given** um usuário fornecendo uma chave comprovadamente incorreta, malformada ou revogada, **When** o Google responder com erro de autenticação (400 `API key not valid` ou 403 `PERMISSION_DENIED`), **Then** a chave não é salva e o sistema retorna 400 Bad Request informando que a chave fornecida é inválida.

---

### User Story 2 - Tratamento Semântico e Coerente de Erros Upstream nas Operações de IA (Priority: P2)

Como usuário e desenvolvedor consumindo os endpoints de categorização orçamentária (`/api/transactions/categorize`), consultoria em chat (`/api/chat/stream`) e diagnóstico mensal (`/api/analysis/:month`), desejo que erros de infraestrutura ou esgotamento de taxa do Google Gemini retornem códigos HTTP semânticos (503 Service Unavailable ou 429 Too Many Requests) com diagnósticos precisos, em vez de erros genéricos de 400 ou 500 acusando falsamente o usuário ou a chave.

**Why this priority**: Garante coerência técnica em toda a API pública, permitindo que clientes e frontends reajam adequadamente (ex: mostrando mensagem para tentar novamente em instantes) sem orientar o usuário a recadastrar a chave à toa.

**Independent Test**: Simular resposta 503 do Google durante o fluxo de categorização ou chat; a API deve retornar status HTTP 503 e mensagem indicando indisponibilidade temporária dos servidores do Gemini, preservando a chave do usuário no banco.

**Acceptance Scenarios**:

1. **Given** um usuário com chave de IA vinculada solicitando categorização ou diagnóstico, **When** o Google Gemini responder com 503 UNAVAILABLE, **Then** a API retorna status HTTP 503 com mensagem clara de alta demanda temporária nos servidores de IA.
2. **Given** um usuário com chave de IA vinculada solicitando chat ou diagnóstico, **When** o Google Gemini responder com 429 RESOURCE_EXHAUSTED, **Then** a API retorna status HTTP 429 com mensagem orientando que a cota da chave do usuário no Google AI Studio foi atingida temporariamente.

---

### User Story 3 - Resiliência com Retentativa Rápida para Flutuações Transitórias (Priority: P3)

Como usuário final executando qualquer operação que dependa de IA, desejo que o sistema execute retentativas rápidas e transparentes (retry com intervalo curto) para flutuações de rede ou picos instantâneos de 503 do Google antes de reportar erro, aumentando a taxa de sucesso das minhas requisições na primeira tentativa.

**Why this priority**: Picos de demanda ("spikes") do Google no Free Tier costumam durar frações de segundo; uma retentativa de 500ms frequentemente resolve o problema sem necessidade de intervenção do usuário.

**Independent Test**: Configurar uma chamada ao Gemini que falhe uma vez com 503 e responda com 200 na segunda tentativa; a operação deve concluir com sucesso transparente para o usuário.

**Acceptance Scenarios**:

1. **Given** uma requisição de IA que enfrente um erro transitório 503, **When** a camada de integração executar uma retentativa com backoff rápido, **Then** a operação conclui com sucesso caso o Google responda na tentativa seguinte, sem que o cliente perceba a oscilação.

---

### Edge Cases

- **Chave de API com Formato Sintático Claramente Inválido**: Chaves com menos de 20 caracteres ou contendo espaços/caracteres ilegais devem ser rejeitadas localmente com 400 Bad Request antes mesmo de disparar qualquer chamada de rede ao Google.
- **Falha Completa de Rede ou DNS (ETIMEDOUT / ENOTFOUND)**: O sistema não deve acusar a chave de inválida, e sim retornar 502/504 indicando indisponibilidade de comunicação com os servidores do Google.
- **Stream SSE Interrompido no Meio da Geração**: Se o Google falhar no meio do fluxo Server-Sent Events, o sistema deve emitir um evento de erro SSE estruturado com código `503_UNAVAILABLE` antes de fechar a conexão.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE classificar os erros originados da API do Google AI Studio em três domínios semânticos distintos:
  - `AUTH_ERROR`: Erros de chave inexistente, malformada ou revogada (400 `API key not valid`, 403 `PERMISSION_DENIED`).
  - `RATE_LIMIT_ERROR`: Erros de cota de requisições ou tokens por minuto (429 `RESOURCE_EXHAUSTED`).
  - `UPSTREAM_UNAVAILABLE`: Erros de indisponibilidade ou alta demanda de infraestrutura (503 `UNAVAILABLE`, timeouts, 500 do provedor).
- **FR-002**: No endpoint `PUT /api/user/ai-key`, se o teste de validação retornar sucesso (200 OK), a chave DEVE ser criptografada com AES-256-GCM, persistida no banco e a resposta DEVE ser 200 OK com mensagem de ativação imediata.
- **FR-003**: No endpoint `PUT /api/user/ai-key`, se o teste de validação retornar erro classificado como `UPSTREAM_UNAVAILABLE` (503) ou `RATE_LIMIT_ERROR` (429), o sistema DEVE reconhecer que a chave foi autenticada pelo gateway do Google, salvar a chave criptografada no banco e retornar 200 OK com mensagem informativa esclarecendo que a chave foi vinculada e os servidores do Google estão em alta demanda momentânea.
- **FR-004**: No endpoint `PUT /api/user/ai-key`, o sistema DEVE rejeitar a operação com status 400 Bad Request APENAS se o erro for classificado como `AUTH_ERROR` ou falha de sintaxe local.
- **FR-005**: Nos endpoints de categorização (`/api/transactions/categorize`), chat (`/api/chat/stream`) e análise mensal (`/api/analysis/:month`), o sistema DEVE propagar erros com status HTTP correspondente ao domínio do erro (503 para indisponibilidade, 429 para limite de cota, 400/401 para credencial revogada).
- **FR-006**: A camada de integração com o Gemini DEVE implementar política de até 2 retentativas rápidas com pequeno intervalo para erros transitórios de alta demanda (503) antes de propagar a falha.

### Key Entities *(include if feature involves data)*

- **GeminiErrorClassification**: Estrutura que normaliza os erros retornados pelo SDK do Google em código semântico (`AUTH_ERROR`, `RATE_LIMIT_ERROR`, `UPSTREAM_UNAVAILABLE`), status HTTP correspondente e mensagem explicativa humanizada.
- **UserAiKeyStatus**: Estado da chave associada ao usuário (`ACTIVE_VERIFIED`, `ACTIVE_PROVISIONAL_DEMAND`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 rejeições indevidas com status 400 Bad Request em chaves válidas quando o Google responder com 503 UNAVAILABLE.
- **SC-002**: 100% dos erros retornados pelas rotas de IA refletem o código HTTP correto do problema (400 apenas para requisições do cliente/credenciais comprovadamente falsas, 503 para indisponibilidade do Google, 429 para limite de taxa).
- **SC-003**: O endpoint `PUT /api/user/ai-key` responde em menos de 3 segundos mesmo quando aciona retentativa sob oscilação do Google.
- **SC-004**: 100% dos testes da suíte (`npm test`) passam com sucesso, incluindo testes de unidade e integração simulando 200, 503, 429 e 400 do Google.

## Assumptions

- O erro 503 do Google AI Studio ocorre exclusivamente após a requisição ultrapassar com sucesso a camada de autenticação da chave do Cloud Endpoints do Google.
- A criptografia das chaves salvas continuará utilizando o padrão estrito AES-256-GCM exigido pela Constituição v2.0.0.
