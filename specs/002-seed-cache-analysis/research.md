# Research & Technical Decisions: Cache de Análises com TTL, Seed Pluggy e Expansão da Documentação

**Feature**: `002-seed-cache-analysis`  
**Date**: 2026-10-13  
**Status**: Concluído (Fase 0)

---

## 1. Estratégia de Cache e Minimização de Tokens

### Decisão
- **Armazenamento de Cache**: Coleção dedicada `financial_analyses` no MongoDB gerenciada via Mongoose.
- **TTL Nativo (Time-To-Live)**: Índice MongoDB `{ expiresAt: 1 }` com `{ expireAfterSeconds: 0 }` para limpeza automática de documentos obsoletos sem necessidade de instâncias extras de Redis ou workers em background.
- **Detecção de Invalidação por Hash de Estado**:
  - Hash SHA-256 computado a partir do estado determinístico das transações do mês:
    `hash = sha256("${count}_${totalIncome}_${totalExpenses}_${lastTransactionTimestamp}_${categoriesSummary}")`
  - Se `analysis.transactionStateHash === currentHash` e `analysis.expiresAt > now`:
    -> **Cache Hit**: Retorno imediato em memória/banco (< 15ms), sem consumo de tokens do Gemini.
  - Se o hash divergir (novas transações importadas, valores alterados) ou a data atual ultrapassar `expiresAt`:
    -> **Cache Miss / Invalidado**: Dispara inferência estruturada ao Gemini com a chave BYOK do usuário e atualiza o documento no MongoDB.

### Justificativa
Em conformidade estrita com o Princípio II da Constituição (sem bancos relacionais ou Redis extra), o MongoDB NoSQL atende perfeitamente ao armazenamento polimórfico de diagnósticos e oferece suporte nativo a índices TTL de expiração automática. A validação por hash de estado garante que alterações em transações invalidem o cache instantaneamente sem custos adicionais de rede.

---

## 2. Automação de Seed com Pluggy Sandbox e Chave .env

### Decisão
- Script executável TypeScript `scripts/seed.ts` via comando `npm run seed`.
- **Criação de Usuário de Teste**:
  - E-mail padrão: `teste.pluggy@exemplo.com`
  - Senha: `SenhaForte#123`
  - Chave BYOK: Obtida de `GOOGLE_GENERATIVE_AI_API_KEY` no `.env`, validada e criptografada com `AES-256-GCM` via `CryptoService.encrypt`.
- **Importação de Dados da Pluggy Sandbox**:
  - Busca transações de contas de teste da Pluggy (`87c6b485-6bbd-4e96-a81d-872f9b2d8801`).
  - Em caso de indisponibilidade de rede ou ausência de chave Pluggy ativa, utiliza fixture simulada idêntica ao payload real da sandbox Pluggy para garantir que o seed sempre finalize com sucesso.
- **Pre-warming de Análise**:
  - O seed já calcula as métricas e deixa a análise do mês atual pré-aquecida no banco, permitindo consulta instantânea no Swagger.

### Justificativa
Proporciona uma experiência de desenvolvedor (DX) perfeita: com um único comando, o banco de dados é povoado com dados consistentes, permitindo testar rotas autenticadas, categorização e chat sem qualquer etapa manual.

---

## 3. Expansão e Reestruturação do README.md

### Decisão
- Reformulação integral do `README.md` na raiz do projeto contendo:
  1. **Apresentação e Badges**: Node.js 20, TypeScript, Fastify, MongoDB, Docker, Licença.
  2. **Destaques Arquiteturais**: Modelo BYOK de custo zero, conformidade com a LGPD, pipeline local pré-LLM de minimização de tokens.
  3. **Diagramas Mermaid**:
     - Diagrama de Arquitetura em Camadas (Fastify -> Services -> Mongoose -> External APIs).
     - Diagrama de Fluxo de Ingestão e Sanitização LGPD.
     - Diagrama do Ciclo de Vida da Chave BYOK (AES-256-GCM).
     - Diagrama do Ciclo de Cache com TTL e Invalidação por Hash.
  4. **Guia de Instalação e Execução**: Passo a passo com Docker Compose (`docker compose up --build -d`) e modo de desenvolvimento local.
  5. **Comandos de Teste e Seed**: `npm run test`, `npm run test:flow` e `npm run seed`.
  6. **Catálogo de Endpoints e Documentação Swagger**: Tabela explicativa de rotas e link para `/docs`.
