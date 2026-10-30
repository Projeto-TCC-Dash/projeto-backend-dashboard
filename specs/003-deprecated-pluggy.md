# Registro de Decisão Arquitetural (ADR): Descontinuação da Integração Externa Pluggy

**Identificador**: `specs/003-deprecated-pluggy.md`  
**Status**: Deprecated / Superseded by Feature 004 (`specs/004-local-seed-generator`)  
**Data**: 2026-10-13  
**Constituição Vinculada**: Princípio V — *Ingestão de Extratos Bancários (OFX/CSV) e Provedor Local de Dados Sintéticos (Seed)*

---

## 1. Contexto Original (Feature 003)
Inicialmente, a Feature 003 foi concebida para integrar transações de teste através do sandbox da Pluggy (Open Finance API) via rota `/api/integrations/pluggy/sync`.

## 2. Decisão Arquitetural e Princípio Constitucional
Durante a ratificação da **Constituição Técnica da Plataforma** (Princípio V), foi estabelecido que:
1. O backend deve ser **100% autônomo e offline** para demonstrações, desenvolvimento e testes locais.
2. A plataforma não deve depender de serviços ou credenciais de terceiros (como agregadores de Open Finance que impõem limites de requisições, custos ou riscos de vazamento de credenciais financeiras).
3. A ingestão universal soberana é baseada no upload manual de arquivos padronizados de extrato bancário (**OFX SGML** e **CSV**), complementada por um gerador local determinístico de dados sintéticos para testes (`npm run seed`).

## 3. Consequências
- A Feature 003 e a rota `/api/integrations/pluggy/sync` foram **removidas e descontinuadas**.
- Foi implementada a **Feature 004** (`specs/004-local-seed-generator`), que fornece geração de dados sintéticos determinísticos em `< 1s` via `npm run seed`.
- Os testes de documentação OpenAPI/Swagger ([swagger.test.ts](file:///home/debhg/Projetos/projeto-backend-dashboard/tests/integration/swagger.test.ts)) validam formalmente que `/api/integrations/pluggy/sync` não faz parte dos endpoints ativos da API.
