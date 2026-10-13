# Quickstart: Validação do Seed Dinâmico com Pluggy Sandbox

**Feature**: `003-pluggy-sandbox-seed`  
**Date**: 2026-10-13

---

## 1. Como Executar o Seed Dinâmico

Certifique-se de que o MongoDB está em execução (via Docker Compose ou local) e execute:

```bash
npm run seed
```

### O que o script fará:
1. Conecta ao MongoDB.
2. Cria o usuário `teste.pluggy@exemplo.com` (se ainda não existir).
3. Lê `GOOGLE_GENERATIVE_AI_API_KEY` do `.env` e associa ao usuário criptografada com AES-256-GCM.
4. Conecta à API da Pluggy (`POST /items`), cria dinamicamente o item de Sandbox com o conector 2 (`user-ok`/`password-ok`), aguarda o status `UPDATED`, baixa todas as contas e transações e as salva no MongoDB.
5. Pré-aquece a análise financeira de Outubro/2026.

---

## 2. Como Validar a Ausência da Rota Pública da Pluggy

Inicie a API:
```bash
npm run dev
# ou
docker compose up -d
```

1. Acesse o Swagger UI: `http://localhost:3000/docs`
2. Verifique que **não existe** nenhuma tag ou rota `/api/integrations/pluggy/sync`.
3. Tente fazer um `curl`:
   ```bash
   curl -X POST http://localhost:3000/api/integrations/pluggy/sync
   ```
   **Retorno esperado**: `404 Not Found`.
