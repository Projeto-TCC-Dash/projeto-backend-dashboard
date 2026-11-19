# Feature Specification: Fiscal Planning & Advanced Financial Advisory

**Feature Branch**: `015-fiscal-and-advisory-planning`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Faça as especificacoes dessas novas ideias de modulo fiscal, e modulo de recomendacao de gastos/investimentos conforme perfil financeiro (O que ainda falta / pode ser implementado nesse módulo)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Triagem e Classificação Fiscal de Despesas Dedutíveis (Priority: P1)

Como um usuário com despesas anuais sujeitas a abatimento tributário (como saúde, educação ou previdência) ou trabalhador autônomo gerindo despesas operacionais dedutíveis em livro-caixa,
Eu quero que o sistema identifique e me permita sinalizar lançamentos com potencial de dedução fiscal, associando metadados fiscais auditáveis (número de documento do prestador, tipo de dedução e comprovação),
Para que eu consiga auditar minhas despesas com potencial de abatimento no IRPF ou Livro-Caixa e emitir um relatório fiscal organizado sem retrabalho no período de declaração de tributos.

**Why this priority**: É o alicerce fundamental do módulo fiscal. Transforma o extrato financeiro comum em documentação contábil primária pronta para abatimento fiscal, entregando valor imediato de economia financeira aos usuários que declaram imposto de renda ou mantêm livro-caixa.

**Independent Test**: Pode ser testado independentemente inserindo transações de saúde e educação, associando o identificador cadastral (CPF/CNPJ) do prestador e a categoria dedutível, gerando um sumário fiscal consolidado de despesas dedutíveis com seus respectivos comprovantes.

**Acceptance Scenarios**:

1. **Given** um conjunto de transações classificadas nas categorias de Saúde ou Educação, **When** o usuário acessa a triagem fiscal, **Then** o sistema destaca esses lançamentos como potencialmente dedutíveis e sugere a categoria fiscal apropriada.
2. **Given** uma transação sinalizada como dedutível, **When** o usuário registra o documento cadastral do prestador (CPF ou CNPJ) e marca o lançamento como comprovado, **Then** a transação é vinculada aos metadados fiscais protegidos sem que esses identificadores pessoais sejam enviados aos canais abertos de consulta da inteligência artificial.
3. **Given** despesas dedutíveis acumuladas no ano-calendário, **When** o usuário solicita a consolidação fiscal, **Then** o sistema calcula o montante total dedutível por subclasse (saúde sem limite legal, educação com teto anual vigente e previdência complementar) exibindo o impacto estimado na base de cálculo tributária.

---

### User Story 2 - Orçamentos Mensais com Metas Quantificadas por Categoria (Priority: P1)

Como um usuário que busca controle rigoroso dos seus hábitos financeiros e cumprimento de metas de vida,
Eu quero definir tetos mensais máximos de gastos por categoria canônica (orçamentos) e acompanhar o consumo percentual em tempo real com alertas preventivos de aproximação de teto,
Para que o consultor inteligente emita recomendações direcionadas e personalizadas aos desvios reais do meu orçamento planejado versus executado.

**Why this priority**: É a espinha dorsal de qualquer planejamento financeiro pessoal robusto. As metas qualitativas vigentes precisam de quantificação monetária para que as recomendações do consultor deixem de ser genéricas e passem a sinalizar exatamente onde e quanto cortar.

**Independent Test**: Pode ser testado independentemente configurando um teto de R$ 1.500,00 para a categoria Lazer, inserindo lançamentos que atinjam 85% dessa cota e verificando se o sistema reporta o status de alerta e sugere a contenção orçamentária no diagnóstico da inteligência financeira.

**Acceptance Scenarios**:

1. **Given** o perfil financeiro do usuário, **When** o usuário define limites monetários mensais para categorias essenciais e supérfluas, **Then** o sistema armazena a matriz orçamentária ativa para o período.
2. **Given** transações executadas no mês corrente, **When** o volume de despesas de uma categoria atinge ou supera 80% do teto estipulado, **Then** o status orçamentário da categoria muda para "Alerta" e recomendações automáticas de contenção preventiva são incorporadas à análise.
3. **Given** um encerramento de mês com gastos abaixo do teto global, **When** o usuário consulta o diagnóstico financeiro, **Then** o excedente poupado é direcionado para a meta prioritária estabelecida no perfil (ex: reserva de emergência ou quitação de dívidas).

---

### User Story 3 - Diagnóstico Multi-Mês e Identificação de Tendências Históricas (Priority: P2)

Como um usuário que utiliza a plataforma de forma contínua há vários meses,
Eu quero visualizar a evolução comparativa da minha taxa de poupança, despesas médias e sazonalidade de consumo ao longo de janelas temporais de 3, 6 e 12 meses,
Para que o consultor financeiro inteligente me alerte sobre desvios estruturais de padrão de vida, aumentos silenciosos de custo fixo e oportunidades de rebalanceamento financeiro.

**Why this priority**: O sistema atualmente opera sob análises isoladas de um único mês. A inteligência histórica desbloqueia percepções profundas sobre sustentabilidade financeira a médio e longo prazo.

**Independent Test**: Pode ser testado registrando transações em três meses consecutivos com despesas crescentes em Moradia e verificando se o relatório multi-mês detecta a tendência de alta e a contração da taxa média de poupança.

**Acceptance Scenarios**:

1. **Given** histórico financeiro de pelo menos 3 meses, **When** o usuário solicita o diagnóstico consolidado multi-mês, **Then** o sistema gera métricas agregadas de taxa de poupança média, média móvel de despesas e variação percentual mês a mês.
2. **Given** uma categoria com aumento consistente de gastos em períodos consecutivos, **When** o motor de análise processa os dados consolidados, **Then** o diagnóstico destaca a anomalia estrutural e orienta sobre o impacto na meta de longo prazo.

---

### User Story 4 - Planejamento de Ativos e Alocação da Carteira de Investimentos (Priority: P2)

Como um investidor que cadastra transações de aportes e retiradas,
Eu quero registrar e visualizar a distribuição do meu patrimônio investido por macroclasses de ativos (Renda Fixa, Renda Variável, Ativos Imobiliários e Reserva de Liquidez Imediata) confrontada com meu perfil de risco cadastrado,
Para que a inteligência financeira recomende rebalanceamentos patrimoniais alinhados à minha tolerância a risco e objetivos temporais.

**Why this priority**: Complementa a categoria de "Investimentos" já existente no sistema, transformando-a de um mero registro de despesa em uma ferramenta estratégica de acumulação patrimonial orientada ao perfil de risco.

**Independent Test**: Pode ser testado cadastrando um perfil de risco "Conservador", inserindo posições concentradas em Renda Variável e verificando se a consultoria recomenda realocação para ativos pós-fixados de alta liquidez.

**Acceptance Scenarios**:

1. **Given** uma conta do tipo Investimento, **When** o usuário registra lançamentos de aportes em macroclasses de ativos, **Then** o sistema atualiza a proporção patrimonial da carteira.
2. **Given** um usuário com perfil de risco "Conservador" que apresente mais de 20% em classes voláteis, **When** o diagnóstico de investimentos é gerado, **Then** o consultor sugere ajustes direcionando os novos aportes mensais para o fortalecimento da reserva de segurança.
3. **Given** um usuário com a meta prioritária "Quitar Dívidas", **When** houver recursos ociosos disponíveis para novos aportes, **Then** o sistema alerta que a taxa de retorno de amortização de passivos supera investimentos tradicionais de renda fixa.

---

### User Story 5 - Conciliação e Extração Inteligente de Comprovantes Fiscais (Priority: P3)

Como um usuário que recebe notas fiscais de serviço (NFS-e) e recibos de prestadores de serviços essenciais em formato digital (PDF ou imagem),
Eu quero fazer upload do documento comprobatório para que o sistema extraia de forma automatizada a razão social, identificador fiscal, valor e data, vinculando-o diretamente ao lançamento bancário correspondente,
Para que a comprovação fiscal fique arquivada de forma idônea e auditável para fins de fiscalização e guarda documental contábil.

**Why this priority**: Reduz o trabalho manual de digitação de dados de recibos e notas, elevando o nível da aplicação a um verdadeiro assistente contábil pessoal e profissional.

**Independent Test**: Pode ser testado enviando um arquivo de recibo médico em formato digital, confirmando a extração estruturada dos dados do prestador e a conciliação com uma transação bancária de mesmo valor e data próxima.

**Acceptance Scenarios**:

1. **Given** o upload de um comprovante fiscal digital de despesa pelo usuário, **When** o motor de interpretação de documentos processa o arquivo, **Then** os dados fundamentais (documento do emitente, nome, data e valor monetário) são extraídos com precisão e apresentados para conferência.
2. **Given** os dados extraídos de um documento fiscal, **When** existe uma transação bancária de débito com valor idêntico dentro de uma janela de 5 dias, **Then** o sistema sugere a conciliação automática com 1 clique.
3. **Given** uma transação conciliada com comprovante, **When** o usuário exporta o dossiê fiscal anual, **Then** o comprovante arquivado é indexado ao item do relatório fiscal correspondente.

---

### User Story 6 - Painel de Controle Fiscal para Autônomos e PJ (Priority: P3)

Como um prestador de serviços autônomo, profissional liberal ou microempreendedor cadastrado com regime de renda não-assalariado,
Eu quero acompanhar meu faturamento bruto acumulado no ano-calendário, limites de enquadramento tributário (como teto do MEI ou faixas do Simples Nacional) e a separação clara entre retiradas de pró-labore, distribuição de lucros e despesas da atividade,
Para que eu mantenha minha saúde financeira e regularidade fiscal sem incorrer em desenquadramentos ou penalidades tributárias.

**Why this priority**: Atende diretamente aos regimes de trabalho já previstos no perfil (`PJ_AUTONOMO`, `ENTREPRENEUR`), oferecendo um diferencial contábil de grande valor para o público não-CLT.

**Independent Test**: Pode ser testado configurando o regime de renda como Autônomo/PJ, registrando receitas mensais de prestação de serviços e verificando a apuração do faturamento bruto anual frente ao teto vigente.

**Acceptance Scenarios**:

1. **Given** um usuário com perfil de renda PJ ou Autônomo, **When** novas receitas de prestação de serviço são registradas, **Then** o sistema acumula o faturamento no painel fiscal e projeta o ritmo de faturamento anual.
2. **Given** o faturamento acumulado aproximando-se do limite de enquadramento anual configurado, **When** atinge 80% do valor limite, **Then** o sistema emite um alerta consultivo sobre a necessidade de planejamento tributário.
3. **Given** saídas registradas na conta jurídica, **When** o usuário classifica o lançamento como "Pró-labore" ou "Distribuição de Lucros", **Then** o sistema segrega as naturezas fiscais para correta apuração contábil no encerramento do exercício.

---

### Edge Cases

- **Comprovante com valor divergente da transação bancária**: Quando o valor da nota fiscal divergir do débito bancário (ex: desconto à vista no Pix, retenção na fonte de tributos ou pagamento parcelado no cartão), o sistema deve permitir conciliação parcial ou manual com justificativa registrada pelo usuário.
- **Transação com múltiplos itens de dedutibilidade mista**: Caso um pagamento em farmácia ou clínica englobe itens dedutíveis (ex: consulta médica) e não-dedutíveis (ex: cosméticos), o usuário deve poder desmembrar o lançamento em duas partes para correta apropriação fiscal.
- **Despesas dedutíveis sem comprovação idônea**: Lançamentos marcados como dedutíveis que não possuam comprovante digital anexado ou identificador do prestador devem constar no relatório fiscal com status de "Pendente de Comprovação", alertando o usuário sobre o risco de malha fina.
- **Mudança de perfil de risco ou regime de renda no meio do exercício**: Se o usuário alterar seu regime de trabalho de CLT para PJ ou seu perfil de risco de Conservador para Moderado, as análises de meses anteriores devem permanecer congeladas no histórico, e as novas metas passam a valer a partir da data de alteração.
- **Inexistência de dados em janelas multi-mês**: Caso o usuário tenha menos de 3 meses cadastrados, a análise multi-mês deve indicar de forma transparente o número de períodos faltantes para ativação da média móvel, operando com diagnósticos proporcionais.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir ao usuário classificar transações financeiras com atributos fiscais especializados (`isTaxDeductible`, `taxCategory`, `providerDocument`, `statusComprovacao`), assegurando que esses metadados permaneçam vinculados ao registro primário.
- **FR-002**: O sistema DEVE disponibilizar categorias fiscais padronizadas em consonância com a legislação tributária brasileira, contemplando no mínimo: Despesas Médicas/Saúde, Instrução/Educação, Previdência Complementar (PGBL), Pensão Alimentícia Judicial e Despesas de Livro-Caixa da Atividade Profissional.
- **FR-003**: O sistema DEVE proteger dados identificadores sensíveis (como números de CPF e CNPJ de prestadores) garantindo que sejam gravados em campos estruturados dedicados e que NUNCA sejam transmitidos para motores externos de IA durante diálogos de consultoria ou categorizações corriqueiras.
- **FR-004**: O sistema DEVE permitir o upload e arquivamento seguro de arquivos de comprovantes fiscais (PDF, PNG, JPG) de até 10MB, associando cada arquivo à transação financeira correspondente.
- **FR-005**: O sistema DEVE permitir a extração estruturada de dados fiscais essenciais a partir de comprovantes digitais (emitente, identificador fiscal, data e montante) sob acionamento explícito do usuário, sugerindo a conciliação automática com transações financeiras compatíveis.
- **FR-006**: O sistema DEVE disponibilizar a exportação de um Dossiê Fiscal Consolidado (anual ou mensal) em formatos imprimíveis e tabulares (PDF e planilhas), contendo a listagem completa de itens dedutíveis, somatórios por categoria fiscal, identificadores dos prestadores e status de comprovação documental.
- **FR-007**: O sistema DEVE permitir a criação, consulta, atualização e exclusão de Orçamentos Mensais (Budgets), estipulando limites monetários máximos para cada categoria canônica e para o conjunto de gastos do mês.
- **FR-008**: O sistema DEVE computar continuamente o percentual consumido de cada orçamento mensal frente às despesas efetivamente realizadas, classificando o status em faixas: Regular (<70%), Alerta (70% a 99%) e Excedido (>=100%).
- **FR-009**: O sistema DEVE incorporar os orçamentos ativos e seus status de consumo no contexto do consultor inteligente, gerando alertas preditivos de estouro orçamentário e planos de contenção de despesas antes do encerramento do ciclo mensal.
- **FR-010**: O sistema DEVE disponibilizar análises consolidadas multi-mês cobrindo janelas históricas de 3, 6 e 12 meses, calculando taxas de poupança médias, evolução de patrimônio líquido, variância de gastos e detecção de padrões sazonais.
- **FR-011**: O sistema DEVE permitir o acompanhamento da Carteira de Investimentos por macroclasses (Renda Fixa, Renda Variável, Ativos Imobiliários, Fundos e Liquidez Imediata), calculando a distribuição percentual do patrimônio alocado.
- **FR-012**: O sistema DEVE calibrar automaticamente as recomendações de novos aportes de investimentos confrontando a alocação atual da carteira com o perfil de risco do usuário (`CONSERVATIVE`, `MODERATE`, `AGGRESSIVE`) e sua meta primordial declarada.
- **FR-013**: Para usuários cadastrados com regimes de renda não-assalariados (`PJ_AUTONOMO`, `ENTREPRENEUR`), o sistema DEVE consolidar o faturamento anual bruto da pessoa jurídica, projetando a proximidade de limites de enquadramento tributário (como MEI e faixas do Simples Nacional).
- **FR-014**: O sistema DEVE emitir advertências claras e ostensivas em todos os relatórios e diálogos fiscais esclarecendo que a plataforma atua como ferramenta de organização e planejamento financeiro-tributário, não substituindo o parecer formal de um profissional de contabilidade legalmente habilitado.
- **FR-015**: O sistema DEVE permitir o desmembramento de uma transação financeira única em múltiplos lançamentos fiscais distintos para tratar despesas com múltiplos itens de dedutibilidade diferente.

---

### Key Entities *(include if feature involves data)*

- **TransactionFiscalMetadata**: Representa as propriedades tributárias vinculadas a uma transação bancária. Atributos essenciais: identificador fiscal do prestador (CPF/CNPJ sanitizado e validado), razão social/nome do prestador, categoria de dedutibilidade fiscal, status de conferência (`PENDENTE`, `CONFERIDO`, `ISENTO`), valor dedutível aprovado e identificador do comprovante anexado.
- **FiscalProofDocument**: Representa o arquivo digital do documento fiscal anexado. Atributos essenciais: nome original do arquivo, tipo de mídia (MIME type), tamanho em bytes, caminho de armazenamento isolado, identificador da transação associada, data de envio e dados extraídos da leitura automática.
- **BudgetPlan**: Representa o planejamento orçamentário periódico do usuário. Atributos essenciais: identificador do usuário, período de referência (ano/mês ou anual), limites monetários definidos por categoria canônica, teto global de despesas do período e data de atualização.
- **InvestmentAssetHolding**: Representa o saldo consolidado de recursos alocados em determinada classe patrimonial. Atributos essenciais: conta de investimento associada, macroclasse de ativos (Renda Fixa, Ações, FIIs, Tesouro, Internacional, Cripto), valor financeiro acumulado, percentual representativo sobre o portfólio total e data da última atualização.
- **MultiMonthSummary**: Representa o consolidado temporal das métricas financeiras agregadas. Atributos essenciais: período de apuração (data inicial e final), lista de meses agregados, taxa média de poupança, despesa média mensal, desvio padrão por categoria e identificação de tendências estruturais de alta/baixa.
- **FiscalAnnualDossier**: Representa a compilação oficial para a declaração de rendimentos do usuário. Atributos essenciais: ano-calendário base, total de despesas dedutíveis homologadas por tipo, soma de faturamento anual (quando PJ/Autônomo), relação de lançamentos pendentes de documento e data de emissão.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O tempo necessário para um usuário organizar, conferir e exportar seu relatório anual de despesas dedutíveis para a declaração fiscal é reduzido em pelo menos 80% em comparação à conferência manual em extratos bancários brutos.
- **SC-002**: 100% dos relatórios fiscais gerados contêm dados de prestadores (CPF/CNPJ e valores) de forma consistente e auditável, sem que nenhum dado cadastral identificável seja exposto em prompts abertos ou logs não protegidos.
- **SC-003**: Usuários que configuram orçamentos mensais (Budgets) conseguem identificar estouros orçamentários com pelo menos 5 dias de antecedência ao encerramento do ciclo mensal em 90% dos casos de desvio.
- **SC-004**: O diagnóstico multi-mês identifica e destaca com sucesso 100% dos aumentos de despesas fixas recorrentes que superem em mais de 15% a média histórica dos 3 meses anteriores.
- **SC-005**: A extração automática de dados de comprovantes fiscais padronizados atinge índice de conformidade superior a 90% para valores e identificadores cadastrais antes da homologação final do usuário.
- **SC-006**: A geração completa do dossiê fiscal anual ou do relatório orçamentário multi-mês é disponibilizada ao usuário para download em menos de 3 segundos.

---

## Assumptions

- **Abrangência da Legislação**: As regras de dedutibilidade fiscal, tetos legais e categorias adotam como base inicial as diretrizes tributárias vigentes da Receita Federal do Brasil (IRPF para Pessoa Física e Simples Nacional/Carnê-Leão para Autônomos e Microempresas).
- **Armazenamento de Comprovantes**: O upload de documentos comprobatórios respeita os limites de segurança estabelecidos no sistema (arquivos de até 10MB nos formatos PDF, JPG, PNG e WebP), com segregação lógica multi-tenant estrita por usuário.
- **Soberania do Usuário**: A extração inteligente de dados a partir de recibos e notas atua como ferramenta assistiva; a validação final da conciliação e da idoneidade do documento é sempre confirmada pelo usuário.
- **Privacidade e LGPD**: O envio de imagens ou textos de documentos fiscais para leitura inteligente utiliza a chave de inteligência artificial de titularidade do próprio usuário (BYOK), com consentimento informado e descarte de dados voláteis após a extração estruturada.
- **Independência Operacional**: O cálculo de impostos e geração de relatórios fiscais é executado deterministicamente por regras de negócio do sistema, reservando à inteligência artificial o papel consultivo, explicativo e de interpretação de tendências.
- **Isenção de Responsabilidade Profissional**: O sistema não atua como substituto de responsabilidade técnica de um contador credenciado pelo Conselho Regional de Contabilidade (CRC), focando em apoio operacional e organização de documentação contábil primária.
