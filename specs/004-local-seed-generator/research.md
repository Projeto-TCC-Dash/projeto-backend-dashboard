# Research & Technical Decisions: Gerador Local de Seed e Desacoplamento da Pluggy

**Feature**: `004-local-seed-generator`  
**Date**: 2026-10-13  
**Status**: Concluído (Fase 0)

---

## 1. Desacoplamento Completo da Dependência da Pluggy

### Decisão
- Remover definitivamente:
  - `src/services/pluggy.service.ts`
  - `src/routes/pluggy.routes.ts`
  - `src/schemas/pluggy.schemas.ts`
  - `tests/integration/pluggy.routes.test.ts`
- Remover as variáveis `PLUGGY_API_KEY`, `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` de `src/config/env.ts` e de qualquer arquivo de exemplo `.env.example`.
- Atualizar a constante canônica de origens de transação `TRANSACTION_SOURCES` de `['OFX', 'CSV', 'PLUGGY']` para `['OFX', 'CSV', 'SEED']` em `src/config/constants.ts` e no modelo `src/models/transaction.model.ts`.

### Justificativa
Alinhado à Constituição v2.0.0 (Princípio V), o escopo de produção é estritamente a ingestão de extratos (OFX/CSV). A remoção da Pluggy elimina dependência de terceiros, chaves externas de API, latência de rede e falhas de conexão.

---

## 2. Gerador Local de Dados Sintéticos (Seed Autônomo e Determinístico)

### Decisão
- Implementar em `scripts/seed.ts` um gerador de dados bancários sintéticos 100% determinístico e offline.
- **Usuário de Teste Padrão**:
  - E-mail: `teste.usuario@exemplo.com`
  - Senha: `SenhaForte#123`
- **Massa de Dados**:
  - Geração de mais de 35 transações com identificadores únicos estáveis (`seed-current-01`, `seed-prev-01`, etc.).
  - Distribuição dinâmica de datas cobrindo o mês atual (`Date.now()`) e o mês anterior, calculando dias realistas (ex: salário no dia 5, contas nos dias 10-15, compras ao longo do mês).
  - Cobertura completa das 7 categorias canônicas:
    - **Receitas (Outros)**: Salário CLT (R$ 6.500,00), Rendimentos de Investimentos (R$ 320,00).
    - **Moradia**: Aluguel/Condomínio (-R$ 1.850,00), Energia Elétrica (-R$ 195,00), Internet Fibra (-R$ 149,90), Água (-R$ 82,50).
    - **Alimentação**: Pão de Açúcar (-R$ 540,00), Assaí Atacadista (-R$ 410,00), Outback (-R$ 190,00), iFood (-R$ 75,00).
    - **Transporte**: Posto Shell Combustível (-R$ 240,00), Uber Viagens (-R$ 52,00), Metrô SP (-R$ 35,00).
    - **Saúde**: Droga Raia Medicamentos (-R$ 135,00), Consulta Unimed (-R$ 180,00).
    - **Lazer**: Netflix (-R$ 55,90), Spotify (-R$ 21,90), Cinemark (-R$ 62,00).
    - **Educação**: Alura/Udemy Cursos Online (-R$ 120,00).
- **Pré-aquecimento do Cache**:
  - O script aciona `AnalysisService.getAnalysis(userId, currentMonth)` para deixar o diagnóstico mensal pronto no cache do MongoDB com TTL de 24 horas.

### Justificativa
Execução instantânea (< 1 segundo), 100% confiável em qualquer ambiente sem internet ou sem saldo de API de terceiros, garantindo uma demonstração visual completa para qualquer pessoa que testar o backend.

---

## 3. Atualização Documental no README.md

### Decisão
- Reescrever o `README.md` expurgando qualquer referência à Pluggy ou ao conector de Open Finance.
- Apresentar a ingestão de produção como: **Upload de Extratos Bancários (OFX SGML e CSV)** com sanitização LGPD.
- Apresentar a experiência de teste como: **Seed Autônomo e Instantâneo (`npm run seed`)**.
