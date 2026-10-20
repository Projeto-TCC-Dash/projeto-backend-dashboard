# Feature Specification: Perfil Financeiro, Regime de Renda e Metas do Usuário

**Feature Branch**: `feature/010-user-financial-profile`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Feature 010: Perfil Financeiro, Regime de Renda e Metas do Usuário (specs/010-user-financial-profile) conforme o ROADMAP.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gerenciamento e Consulta do Perfil Financeiro Voluntário (Priority: P1) 🎯 MVP

Como usuário da plataforma de inteligência financeira, quero poder informar voluntariamente o meu regime de trabalho (ex: CLT, PJ/autônomo, servidor público), minha renda média mensal estimada, meus objetivos prioritários e meu perfil de risco, bem como consultar esses dados a qualquer momento, para que o sistema me conheça melhor e possa personalizar os conselhos que me fornece.

**Why this priority**: É a porta de entrada para a hiperpersonalização da inteligência artificial. Sem conhecer o regime de trabalho e as metas da pessoa, qualquer recomendação financeira gerada por IA é genérica e pode ser inadequada (por exemplo, recomendar reserva de 3 meses para um profissional autônomo com renda volátil).

**Independent Test**: Pode ser testado autenticando um usuário, enviando dados do perfil financeiro na rota de atualização do perfil (`PUT /api/user/profile`), consultando os dados salvos (`GET /api/user/profile`) e verificando a integridade dos campos retornados e o isolamento dos dados por usuário.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado, **When** ele envia seus dados de perfil financeiro com regime de trabalho (ex: "PJ_AUTONOMO"), renda declarada (ex: R$ 8.000,00), metas prioritárias (ex: "RESERVA_EMERGENCIA", "INVESTIR_LONGO_PRAZO") e perfil de risco (ex: "MODERATE"), **Then** o sistema valida e persiste as informações com sucesso, associando-as ao usuário.
2. **Given** um usuário autenticado com perfil cadastrado, **When** ele solicita a visualização do seu perfil (`GET /api/user/profile`), **Then** o sistema retorna os dados cadastrais básicos (e-mail, status da chave de IA) e o subdocumento completo do seu perfil financeiro.
3. **Given** um usuário recém-criado que ainda não preencheu o perfil financeiro, **When** ele consulta seu perfil, **Then** o sistema retorna os dados cadastrais normalmente e o perfil financeiro vazio/nulo, sem disparar erros.
4. **Given** um usuário autenticado, **When** ele tenta cadastrar um valor de renda mensal negativo ou um regime de trabalho inválido, **Then** o sistema rejeita a operação com erro de validação claro.
5. **Given** um usuário autenticado que deseja atualizar apenas parte de seus dados (ex: apenas alterar o perfil de risco), **When** ele envia a solicitação, **Then** o sistema atualiza os campos informados de forma consistente, mantendo a data de atualização registrada.

---

### User Story 2 - Calibragem Contextual de Diagnósticos e Reserva de Emergência pela IA (Priority: P2)

Como usuário que consome relatórios e diagnósticos financeiros mensais gerados por IA, quero que o diagnóstico leve em consideração meu regime de trabalho e minhas metas declaradas, para que o cálculo recomendado para minha reserva de emergência e as dicas de economia sejam condizentes com a minha estabilidade profissional e meus planos de vida.

**Why this priority**: A recomendação de reserva financeira depende criticamente do tipo de renda: profissionais com carteira assinada (CLT) ou estabilidade pública necessitam tipicamente de 3 a 6 meses de despesas em reserva, enquanto trabalhadores autônomos, PJs e empresários necessitam de 6 a 12 meses devido à volatilidade de receitas. Além disso, se a meta do usuário é quitar dívidas, a IA não deve pressioná-lo a investir em ativos voláteis.

**Independent Test**: Pode ser testado gerando uma análise mensal para um usuário com regime "PJ_AUTONOMO" e verificando que a IA contextualizada orienta a constituição de reserva de emergência estendida (6 a 12 meses) e prioriza as metas declaradas no diagnóstico e nas recomendações.

**Acceptance Scenarios**:

1. **Given** um usuário com regime de trabalho declarado como "PJ_AUTONOMO" ou "ENTREPRENEUR", **When** a IA gera o diagnóstico mensal de saúde financeira, **Then** ela calibra a sugestão de reserva de emergência para a faixa de 6 a 12 meses do custo de vida médio, alertando sobre a importância do colchão de liquidez para amortecer variações de receita.
2. **Given** um usuário com regime de trabalho declarado como "CLT" ou "PUBLIC_SERVANT", **When** a IA gera o diagnóstico mensal, **Then** ela calibra a sugestão de reserva de emergência para a faixa padrão de 3 a 6 meses de despesas.
3. **Given** um usuário que definiu como meta prioritária "QUITAR_DIVIDAS", **When** o relatório de recomendações é gerado, **Then** a IA prioriza ações de amortização e liquidação de juros caros antes de sugerir alocações em investimentos de longo prazo.
4. **Given** um usuário que não preencheu o perfil financeiro voluntário, **When** o diagnóstico mensal é gerado, **Then** a IA gera o relatório com parâmetros conservadores padrão (reserva de 6 meses) e sugere gentilmente o preenchimento do perfil para análises mais precisas.

---

### User Story 3 - Hiperpersonalização Conversacional no Chatbot Financeiro (Priority: P3)

Como usuário conversando com o assistente virtual inteligente, quero que o chatbot se lembre do meu momento profissional e dos meus objetivos declarados, para que suas respostas a perguntas livres (ex: "posso viajar no fim do ano?" ou "onde coloco meu dinheiro?") considerem minha realidade.

**Why this priority**: Torna o chat financeiro um parceiro estratégico e realista, aumentando o engajamento e a relevância de cada interação.

**Independent Test**: Pode ser testado verificando que a instrução de sistema gerada para a sessão de chat (`buildSystemInstruction`) contém as variáveis de regime de renda, valor declarado e metas do usuário, e que o assistente utiliza esse contexto para formular respostas personalizadas.

**Acceptance Scenarios**:

1. **Given** uma conversa com o assistente virtual, **When** as instruções de sistema da persona são compostas, **Then** o prompt incorpora o regime de renda, o valor de renda declarado e os objetivos financeiros do usuário.
2. **Given** um usuário autônomo com meta de "COMPRAR_IMOVEL", **When** ele pergunta ao chat sobre alocação de economias, **Then** o assistente orienta sobre previsibilidade de caixa e investimentos de renda fixa adequados ao prazo da compra do imóvel, referenciando o objetivo declarado.

---

### Edge Cases

- **Usuário com perfil financeiro não preenchido**: O sistema deve operar com perfeição sem qualquer campo obrigatório, adotando regras de segurança padrão (fallback neutro).
- **Renda declarada divergente das entradas registradas no extrato**: Se a renda declarada for R$ 8.000,00 e o total de entradas do mês for R$ 5.000,00, a IA não deve emitir erro nem travar o fluxo; deve considerar a renda declarada como expectativa/teto e notar a variação sazonal de forma construtiva.
- **Lista de metas vazia ou com múltiplas metas**: O sistema deve aceitar de 0 a 5 metas da lista canônica homologada.
- **Renda declarada igual a zero ou valor decimal**: Zero é aceito (ex: desempregado ou estudante sem renda no momento). Valores negativos são estritamente rejeitados.
- **Conformidade LGPD**: Todos os dados informados são facultativos, associados apenas ao identificador do usuário e protegidos sob o mesmo isolamento multi-tenant da plataforma.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE fornecer uma funcionalidade autenticada de consulta (`GET /api/user/profile`) que retorne os dados cadastrais básicos e o perfil financeiro opcional do usuário autenticado.
- **FR-002**: O sistema DEVE fornecer uma funcionalidade autenticada de atualização (`PUT /api/user/profile`) que permita salvar ou modificar o regime de renda, renda mensal declarada, metas prioritárias e perfil de risco do usuário.
- **FR-003**: O sistema DEVE validar rigorosamente os campos do perfil financeiro, aceitando para `incomeType` apenas os valores: `"CLT"`, `"PJ_AUTONOMO"`, `"PUBLIC_SERVANT"`, `"ENTREPRENEUR"`, `"STUDENT"`, `"RETIRED"` ou `"OTHER"`.
- **FR-004**: O sistema DEVE validar que o campo `declaredMonthlyIncome`, quando informado, seja um número maior ou igual a zero, rejeitando valores negativos.
- **FR-005**: O sistema DEVE validar que as metas informadas em `goals` pertençam exclusivamente à lista canônica: `"RESERVA_EMERGENCIA"`, `"QUITAR_DIVIDAS"`, `"COMPRAR_IMOVEL"`, `"INVESTIR_LONGO_PRAZO"` e `"CONTROLE_GASTOS"`.
- **FR-006**: O sistema DEVE validar que o perfil de risco (`riskProfile`), quando informado, pertença aos valores: `"CONSERVATIVE"`, `"MODERATE"` ou `"AGGRESSIVE"`.
- **FR-007**: O sistema DEVE persistir a data e hora da última atualização do perfil financeiro (`updatedAt`).
- **FR-008**: O motor de geração de diagnósticos mensais por IA (`AnalysisService.getAnalysis` / `GeminiService.generateFinancialDiagnosis`) DEVE receber o perfil financeiro do usuário e utilizá-lo para calibrar a métrica recomendada de reserva de emergência (3 a 6 meses para CLT/servidor público vs. 6 a 12 meses para autônomo/PJ/empresário) e priorizar as metas declaradas.
- **FR-009**: O construtor de contexto do chatbot financeiro (`ChatService.buildSystemInstruction`) DEVE injetar as informações do perfil financeiro do usuário nas diretrizes da persona, permitindo respostas adaptadas ao regime de trabalho e objetivos declarados.
- **FR-010**: A atualização do perfil financeiro DEVE invalidar imediatamente o cache de diagnósticos mensais do usuário (`AnalysisService.invalidate(userId)`), assegurando que o próximo relatório reflita imediatamente as novas diretrizes do perfil.

### Key Entities *(include if feature involves data)*

- **Perfil Financeiro (`IFinancialProfile`)**: Subdocumento do usuário composto por:
  - `incomeType`: Regime profissional de renda (CLT, PJ_AUTONOMO, PUBLIC_SERVANT, ENTREPRENEUR, STUDENT, RETIRED, OTHER).
  - `declaredMonthlyIncome`: Valor monetário estimado da renda mensal do usuário (opcional, >= 0).
  - `goals`: Lista de objetivos prioritários (RESERVA_EMERGENCIA, QUITAR_DIVIDAS, COMPRAR_IMOVEL, INVESTIR_LONGO_PRAZO, CONTROLE_GASTOS).
  - `riskProfile`: Perfil de tolerância a risco (CONSERVATIVE, MODERATE, AGGRESSIVE).
  - `updatedAt`: Carimbo de data/hora da última alteração.
- **Usuário (`User`)**: Entidade principal que hospeda o subdocumento `financialProfile`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuários conseguem cadastrar e atualizar seu perfil financeiro em menos de 300 milissegundos via API.
- **SC-002**: 100% dos diagnósticos de inteligência artificial gerados para usuários com perfil preenchido ajustam o cálculo recomendado de reserva de emergência conforme a estabilidade do regime de trabalho declarado.
- **SC-003**: 100% das recomendações priorizam a meta principal do usuário quando especificada (ex: foco em desendividamento quando a meta for `QUITAR_DIVIDAS`).
- **SC-004**: 0% de impacto negativo ou indisponibilidade para usuários que optarem por não preencher o perfil financeiro (garantia de fallback suave).
- **SC-005**: 100% de conformidade com os princípios de privacidade e minimização da LGPD, sendo todos os campos puramente voluntários e de uso exclusivo na plataforma.

## Assumptions

- O preenchimento do perfil financeiro é 100% voluntário pelo usuário, nunca bloqueando o acesso às demais funcionalidades da plataforma.
- Os dados de perfil têm finalidade estrita de consultoria financeira pessoal (PFM), sendo proibido seu compartilhamento externo ou uso para avaliação de crédito punitiva.
- A atualização do perfil financeiro invalida o cache de análises mensais para forçar uma nova geração calibrada pelo Gemini no próximo acesso.
