# Quickstart & Validation Guide: Cache de Análise & Seed Pluggy

**Feature**: `002-seed-cache-analysis`  
**Date**: 2026-10-13  
**Status**: Concluído (Fase 1)

---

## 1. Executando o Seed Automatizado de Teste

Com o banco de dados rodando (via `docker compose up -d mongodb` ou container completo), execute:

```bash
npm run seed
```

**Resultado Esperado**:
- Criação/atualização do usuário `teste.pluggy@exemplo.com` com senha `SenhaForte#123`.
- Criptografia automática da chave do Google AI Studio a partir do `.env`.
- Sincronização e ingestão das transações simuladas da sandbox Pluggy.
- Pré-aquecimento da análise financeira do mês atual.

---

## 2. Roteiro de Validação do Cache com TTL

### Passo 1: Login com o Usuário de Seed

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "teste.pluggy@exemplo.com", "password": "SenhaForte#123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)
```

### Passo 2: Primeira Consulta da Análise Mensal (Cache Miss ou Pre-Warmed)

```bash
curl -X GET http://localhost:3000/api/analysis/2026-10 \
  -H "Authorization: Bearer $TOKEN"
```

**Resultado**:
Retorna o diagnóstico estruturado com métricas e campo `cached: true` ou `cached: false`.

### Passo 3: Segunda Consulta Imediata (Cache Hit - 0 Tokens Consumidos)

```bash
curl -X GET http://localhost:3000/api/analysis/2026-10 \
  -H "Authorization: Bearer $TOKEN"
```

**Resultado**:
Retorno instantâneo (< 50ms) com `cached: true`. Nenhuma chamada externa é enviada ao Gemini.

### Passo 4: Invalidação por Nova Transação

Faça upload de um novo extrato contendo transação em Outubro:
```bash
curl -X POST http://localhost:3000/api/transactions/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@caminho/para/novo_extrato.ofx"
```

Consulte a análise novamente:
```bash
curl -X GET http://localhost:3000/api/analysis/2026-10 \
  -H "Authorization: Bearer $TOKEN"
```

**Resultado**:
O hash de estado das transações detectou a nova movimentação. O cache foi invalidado e uma nova análise foi gerada com `cached: false`.
