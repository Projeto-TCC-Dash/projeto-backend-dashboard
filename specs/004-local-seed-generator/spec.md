# Feature Specification: Desacoplamento da Pluggy e Gerador Local de Dados Sintéticos (Seed)

**Feature Branch**: `004-local-seed-generator`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Desacoplar e remover completamente o serviço e configurações da Pluggy, transformando o script de seed em um gerador 100% local e autônomo de dados bancários sintéticos realistas (múltiplos meses, salários, PIX, mercado e despesas variadas para demonstrar o dashboard)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gerador Local e Autônomo de Dados Sintéticos para Testes (Priority: P1) 🎯 MVP

Como desenvolvedor ou avaliador que precisa demonstrar e testar o dashboard financeiro em qualquer máquina ou ambiente sem internet, desejo executar o comando `npm run seed` para popular o banco de dados instantaneamente com dezenas de transações bancárias brasileiras autênticas (salários, transferências, supermercado, moradia, transporte, saúde, lazer em múltiplos meses), associando a chave do Gemini do `.env` e pré-aquecendo o cache de análise com TTL, sem qualquer dependência de APIs externas de Open Finance.

**Why this priority**: É a essência da experiência do desenvolvedor (DX): provisionar uma base rica para demonstrar o dashboard em menos de 2 segundos de forma 100% determinística e offline.

**Independent Test**: Pode ser testado executando `npm run seed` no terminal; o script cria o usuário de teste, vincula a chave do Gemini do `.env` com AES-256-GCM, insere as transações sintéticas com categorias completas e pré-aquece a análise do mês atual no cache do MongoDB.

**Acceptance Scenarios**:

1. **Given** um banco de dados MongoDB limpo ou em execução, **When** o comando `npm run seed` é disparado, **Then** o sistema cria o usuário `teste.usuario@exemplo.com` (senha: `SenhaForte#123`), criptografa a chave do Gemini do `.env`, gera e grava mais de 30 transações sintéticas realistas cobrindo o mês atual e meses anteriores, e pré-aquece o diagnóstico do mês no cache com indicador `cached: true`.
2. **Given** que o comando `npm run seed` já foi executado, **When** ele for executado novamente, **Then** o processo opera com idempotência estrita, ignorando transações duplicadas (0 duplicatas inseridas).
3. **Given** a ausência de conexão com a internet ou ausência de chaves de Open Finance externas, **When** o seed é executado, **Then** ele conclui com 100% de sucesso em menos de 2 segundos.

---

### User Story 2 - Remoção Integral do Código e Configurações da Pluggy (Priority: P2)

Como engenheiro mantendo a base de código, desejo que todas as rotas, serviços, esquemas Zod e variáveis de ambiente associadas à Pluggy sejam completamente removidas do projeto, deixando a API pública enxuta e focada exclusivamente na ingestão de extratos bancários manuais (OFX e CSV).

**Why this priority**: Elimina complexidade acidental, reduz a superfície de ataque da API, elimina variáveis de ambiente mortas no `.env` e alinha o código à Constituição v2.0.0.

**Independent Test**: Pode ser testado buscando referências a "pluggy" no código-fonte e inspecionando o Swagger UI (`/docs`), confirmando que 0 rotas ou dependências da Pluggy permanecem ativas.

**Acceptance Scenarios**:

1. **Given** o servidor Fastify inicializado, **When** a rota `/docs` é consultada, **Then** não existe nenhuma menção ou endpoint de sincronização da Pluggy.
2. **Given** o arquivo de variáveis de ambiente (`src/config/env.ts` e `.env.example`), **When** inspecionado, **Then** nenhuma variável `PLUGGY_*` é requerida para a inicialização da aplicação.
3. **Given** os arquivos do projeto, **When** inspecionados, **Then** o serviço `src/services/pluggy.service.ts` e rotas associadas foram excluídos.

---

### User Story 3 - Documentação e Comunicação Limpa no README (Priority: P3)

Como desenvolvedor ou arquiteto avaliando o repositório, desejo que o `README.md` apresente a arquitetura limpa sem menções à Pluggy, destacando a ingestão por arquivos de extrato (OFX e CSV) e o gerador de seed sintético local.

**Why this priority**: Garante consistência documental e transparência sobre as capacidades reais da aplicação.

**Independent Test**: Revisão visual do `README.md` confirmando diagramas e instruções operacionais alinhadas com a arquitetura final.

**Acceptance Scenarios**:

1. **Given** o `README.md`, **When** lido por um visitante do repositório, **Then** ele encontra instruções claras de ingestão por extratos OFX/CSV, o fluxo de segurança BYOK e as credenciais do comando de seed local.

---

### Edge Cases

- **Mês com virada de ano**: O gerador sintético de transações deve calcular datas dinamicamente com base na data atual (ex: mês corrente e mês anterior) para garantir que o dashboard sempre tenha dados frescos independentemente do mês em que o avaliador rodar o projeto.
- **Variável de chave de IA do Gemini ausente no `.env`**: O seed deve alertar sobre a ausência da chave, mas não falhar a inserção de usuários ou transações, permitindo testes parciais mesmo sem cota de IA.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE remover integralmente o arquivo de serviço `src/services/pluggy.service.ts`, as rotas `src/routes/pluggy.routes.ts` e os schemas `src/schemas/pluggy.schemas.ts`.
- **FR-002**: O sistema DEVE remover o registro de qualquer rota da Pluggy em `src/app.ts`.
- **FR-003**: O sistema DEVE remover as variáveis `PLUGGY_API_KEY`, `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` do validador Zod de variáveis de ambiente em `src/config/env.ts`.
- **FR-004**: O enum de origens de transação `TRANSACTION_SOURCES` em `src/config/constants.ts` DEVE ser atualizado para `['OFX', 'CSV', 'SEED']`.
- **FR-005**: O script `scripts/seed.ts` DEVE conter um gerador de dados sintéticos determinístico e rico com mais de 30 transações brasileiras realistas, cobrindo:
  - Salário e rendimentos (Receitas)
  - Supermercado, restaurantes e padarias (Alimentação)
  - Transporte público, combustível e aplicativos de mobilidade (Transporte)
  - Aluguel, condomínio, luz, água e internet (Moradia)
  - Farmácias e consultas (Saúde)
  - Streaming, cinema e passeios (Lazer)
  - Cursos e livros (Educação)
- **FR-006**: O gerador de dados sintéticos DEVE distribuir transações entre o mês corrente (`Date.now()`) e o mês imediatamente anterior, garantindo volume suficiente para comparações mensais no dashboard.
- **FR-007**: O script de seed DEVE continuar associando e criptografando a chave `GOOGLE_GENERATIVE_AI_API_KEY` do `.env` com AES-256-GCM para o usuário de teste.
- **FR-008**: O script de seed DEVE pré-aquecer no MongoDB o diagnóstico financeiro do mês corrente com cache e TTL de 24 horas via `AnalysisService.getAnalysis`.
- **FR-009**: O script de seed DEVE ser estritamente idempotente, não duplicando usuários nem transações caso seja executado repetidamente.
- **FR-010**: O arquivo `README.md` DEVE ser atualizado removendo todas as menções à Pluggy e destacando a arquitetura focada em extratos OFX/CSV e seed autônomo local.

### Key Entities *(include if feature involves data)*

- **SyntheticTransaction**: Representa um lançamento bancário sintético realista gerado pelo seed com identificador externo único, descrição, valor, categoria pré-atribuída, data dinâmica e origem `'SEED'`.
- **FinancialAnalysis**: Análise persistida em cache com TTL no MongoDB para o mês corrente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 dependências, chamadas de rede ou variáveis de ambiente associadas à Pluggy no código da aplicação.
- **SC-002**: O comando `npm run seed` executa em menos de 2 segundos com 100% de disponibilidade offline.
- **SC-003**: O banco de dados é populado com pelo menos 30 transações distribuídas em 2 meses e cobrindo todas as 7 categorias canônicas.
- **SC-004**: 100% dos testes da suíte (`npm test`) passam com sucesso.
- **SC-005**: 100% de conformidade com a Constituição v2.0.0.

## Assumptions

- O usuário de teste padrão será `teste.usuario@exemplo.com` (senha: `SenhaForte#123`).
- A geração local é superior para demonstração de dashboards por ser imune a oscilações de terceiros ou expiração de planos de API externa.
