# Quickstart: Validação do Seed Local e Desacoplamento da Pluggy

**Feature**: `004-local-seed-generator`  
**Date**: 2026-10-13

---

## 1. Como Executar o Seed Local

Certifique-se de que o MongoDB está em execução e execute:

```bash
npm run seed
```

### O que o script fará:
1. Conecta ao MongoDB.
2. Cria o usuário `teste.usuario@exemplo.com` (senha: `SenhaForte#123`).
3. Lê `GOOGLE_GENERATIVE_AI_API_KEY` do `.env` e associa ao usuário criptografada com AES-256-GCM.
4. Gera e insere instantaneamente mais de 35 transações bancárias sintéticas cobrindo o mês atual e o mês anterior, com todas as 7 categorias canônicas distribuídas.
5. Pré-aquece a análise financeira do mês atual no cache do MongoDB.
6. Finaliza em menos de 1 segundo sem nenhuma chamada externa de rede.

---

## 2. Como Validar a Ausência da Pluggy

1. Inicie a API (`npm run dev`) e acesse o Swagger UI: `http://localhost:3000/docs`.
2. Verifique que a documentação contém apenas:
   - `/health`
   - `/api/auth/*`
   - `/api/user/ai-key`
   - `/api/transactions/*` (Upload OFX/CSV, Listagem, Categorização)
   - `/api/chat/stream`
   - `/api/analysis/:month`
3. Tente fazer um `curl` para a rota antiga da Pluggy:
   ```bash
   curl -i -X POST http://localhost:3000/api/integrations/pluggy/sync
   ```
   **Retorno esperado**: `404 Not Found`.
