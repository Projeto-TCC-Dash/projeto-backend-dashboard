# Feature Specification: Central de Exportação de Dados Financeiros (CSV, XLSX e PDF)

**Feature Branch**: `feature/014-financial-data-export`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Implemente então essa feature 014 que está pendente: Central de Exportação de Dados Financeiros (CSV, XLSX e PDF) com filtros de período, conta e categoria, formatação regional brasileira e estrita conformidade multi-tenant."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Exportação de Transações em Formato Tabular Aberto (CSV) (Priority: P1)

Como usuário e planejador financeiro da plataforma, desejo exportar minhas transações financeiras em formato CSV com formatação brasileira compatível com Microsoft Excel, para que eu possa carregar meus dados em ferramentas analíticas externas, planilhas avulsas ou modelos próprios de controle orçamentário.

**Why this priority**: É o formato de intercâmbio de dados mais universal e leve, oferecendo soberania imediata sobre os dados (portabilidade financeira) e servindo como MVP do pipeline de exportação.

**Independent Test**: Pode ser testado solicitando a exportação das transações no formato CSV via requisição autenticada, verificando se o arquivo retornado possui os cabeçalhos corretos, separador de ponto e vírgula (`;`), encoding UTF-8 com BOM (Byte Order Mark), valores monetários no formato decimal brasileiro (`1234,56`) e datas no padrão `DD/MM/YYYY`.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado com transações cadastradas, **When** ele solicita a exportação das transações com o parâmetro de formato CSV, **Then** o sistema gera e envia para download um arquivo com extensão `.csv`, cabeçalho `Content-Type: text/csv; charset=utf-8`, delimitador `;` e cabeçalhos em português (`Data;Descrição;Categoria;Conta;Tipo;Valor`).
2. **Given** um arquivo CSV gerado pelo sistema aberto em softwares de planilha no Brasil (como Microsoft Excel ou LibreOffice Calc), **When** o documento é carregado, **Then** os caracteres acentuados são exibidos sem distorção (graças ao BOM `\uFEFF`) e os números são reconhecidos nativamente como valores monetários/decimais.
3. **Given** um usuário que não possui nenhuma transação cadastrada no período ou filtros selecionados, **When** ele solicita a exportação em CSV, **Then** o sistema retorna um arquivo contendo apenas os cabeçalhos ou uma indicação clara de extrato sem lançamentos, mantendo a integridade do formato.

---

### User Story 2 - Exportação Estruturada em Planilha Eletrônica Formatada (XLSX) (Priority: P2)

Como usuário corporativo ou individual avançado, desejo exportar minhas transações em uma planilha Excel moderna (`.xlsx`) com tipagem de células adequada, cabeçalhos estilizados, larguras de coluna ajustadas e formatação monetária nativa (`R$ #,##0.00`), para que o relatório esteja pronto para apresentação e análise sem necessidade de ajustes visuais manuais.

**Why this priority**: Proporciona uma experiência executiva de alta qualidade, garantindo que usuários que utilizam o Excel diretamente recebam um documento profissional e pré-formatado.

**Independent Test**: Pode ser testado solicitando a exportação no formato XLSX, verificando se o arquivo binário gerado possui a extensão correta, cabeçalho `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, tipos numéricos em vez de texto bruto e estilos de célula aplicados.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado solicitando exportação em XLSX, **When** o arquivo é gerado, **Then** as colunas de valor possuem formatação numérica nativa de moeda brasileira (`R$ #,##0.00`), as datas possuem formatação `dd/mm/yyyy` e a linha de cabeçalho possui destaque visual.
2. **Given** o relatório em formato XLSX gerado, **When** o usuário calcula fórmulas (como soma da coluna de valor), **Then** a planilha calcula os totais automaticamente sem necessidade de converter textos para números.

---

### User Story 3 - Relatório Executivo Diagramado em Documento Imprimível (PDF) (Priority: P3)

Como usuário da plataforma, desejo gerar um relatório financeiro fechado em formato PDF com cabeçalho institucional, sumário de indicadores (total de receitas, total de despesas, saldo líquido) e extrato detalhado de lançamentos, para que eu possa imprimir, arquivar ou comprovar receitas e despesas formalmente.

**Why this priority**: É essencial para arquivamento estático, auditoria pessoal e prestação de contas físicas ou digitais imutáveis.

**Independent Test**: Pode ser testado solicitando a exportação em PDF para um mês específico, verificando se o documento gerado possui cabeçalho institucional, sumário de KPIs financeiros consolidados e paginação automática com rodapé de auditoria.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado solicitando exportação de um determinado mês em PDF, **When** o documento é gerado, **Then** o PDF apresenta cabeçalho institucional com data de emissão, sumário consolidado de KPIs (Receitas, Despesas e Saldo Líquido) e a tabela paginada com as transações ordenadas cronologicamente.
2. **Given** um extrato com dezenas de transações que excedem uma única página, **When** o PDF é construído, **Then** o sistema quebra páginas de forma harmoniosa, repetindo cabeçalhos de tabela ou mantendo a legibilidade com numeração de páginas (`Página X de Y`).

---

### User Story 4 - Filtragem Contextual e Escopo Customizado de Exportação (Priority: P4)

Como usuário com múltiplos bancos, cartões ou metas, desejo aplicar filtros por mês (`month`), intervalo de datas (`startDate` a `endDate`), conta bancária (`accountId`) ou categoria canônica (`category`) ao exportar meus dados, para que eu possa extrair apenas os lançamentos pertinentes ao meu objetivo de análise.

**Why this priority**: Permite exportações cirúrgicas (ex: apenas gastos com alimentação no último trimestre ou apenas extrato do Cartão de Crédito de um mês).

**Independent Test**: Pode ser testado solicitando a exportação combinando filtros (ex: `accountId=X` e `month=2026-10`), validando que apenas transações pertencentes à conta X e dentro do mês informado constam no arquivo resultante.

**Acceptance Scenarios**:

1. **Given** um usuário que solicita a exportação especificando um `accountId`, **When** o arquivo é gerado em qualquer um dos formatos suportados, **Then** apenas as transações vinculadas a essa conta bancária específica são incluídas.
2. **Given** um usuário que solicita a exportação especificando uma `category` e um intervalo de datas (`startDate` e `endDate`), **When** o relatório é emitido, **Then** apenas lançamentos daquela categoria dentro do intervalo estrito constam no relatório.
3. **Given** uma solicitação informando um `accountId` inexistente ou pertencente a outro usuário (violação multi-tenant), **When** a solicitação é processada, **Then** o sistema rejeita a operação com erro de autorização ou recurso não encontrado, garantindo isolamento total de dados.

---

### Edge Cases

- **O que acontece quando o usuário solicita exportação de um período sem nenhuma transação?**
  O sistema gera o documento com cabeçalhos estruturados e uma mensagem informativa clara de que não foram localizados lançamentos no período filtrado, retornando o arquivo com status 200 para não quebrar fluxos automatizados de download do frontend.
- **O que acontece se o usuário informar filtros de datas inválidos (ex: `startDate` posterior a `endDate` ou formato malformado)?**
  O sistema rejeita a requisição imediatamente na camada de validação com HTTP 400 Bad Request e mensagem amigável de erro de validação.
- **Como o sistema se comporta ao exportar transações com descrições contendo caracteres especiais, quebras de linha ou o separador ponto e vírgula no CSV?**
  O gerador CSV envolve automaticamente as strings entre aspas duplas e escapa aspas internas, prevenindo quebra de colunas no leitor de planilhas.
- **Como são tratadas transações contábeis especiais como faturas de cartão no sumário do PDF?**
  Transações da categoria "Pagamento de Fatura" são exibidas no extrato, mas o sumário de KPIs segue as diretrizes da governança do sistema, segregando ou sinalizando a liquidação para evitar distorção no saldo do período.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE disponibilizar um endpoint protegido por autenticação para exportação de dados financeiros.
- **FR-002**: O endpoint DEVE aceitar a seleção obrigatória do formato de saída através dos tipos suportados: CSV (`csv`), planilha Excel (`xlsx`) e documento PDF (`pdf`).
- **FR-003**: O endpoint DEVE suportar parâmetros opcionais de consulta para filtragem por mês específico (`YYYY-MM`), intervalo flexível de datas (`startDate` e `endDate`), conta bancária associada (`accountId`) e categoria canônica (`category`).
- **FR-004**: O sistema DEVE garantir isolamento multi-tenant rigoroso, impedindo que dados de outros usuários sejam expostos ou filtrados, validando a posse de qualquer ID de conta fornecido.
- **FR-005**: Na exportação CSV, o sistema DEVE gerar arquivo codificado em UTF-8 com Byte Order Mark (`\uFEFF`), delimitador ponto e vírgula (`;`), datas no padrão brasileiro (`DD/MM/YYYY`) e valores monetários com vírgula decimal.
- **FR-006**: Na exportação XLSX, o sistema DEVE gerar planilha estruturada com células formatadas nativamente em data e moeda brasileira (`R$ #,##0.00`), colunas com largura ajustada automaticamente ao conteúdo e linha de títulos destacada.
- **FR-007**: Na exportação PDF, o sistema DEVE produzir documento diagramado contendo cabeçalho institucional, data de geração, sumário consolidado de indicadores financeiros do filtro aplicado (Total de Receitas, Total de Despesas e Saldo Líquido), tabela detalhada de lançamentos e paginação no rodapé.
- **FR-008**: O sistema DEVE configurar cabeçalhos HTTP adequados para download no navegador (`Content-Disposition: attachment; filename="..."` com nome de arquivo contextual que inclua o formato e a data/mês de referência).
- **FR-009**: O sistema DEVE sanitizar e tratar adequadamente nomes de estabelecimentos e descrições para conformidade com privacidade e regras de escape de arquivos.

---

### Key Entities *(include if feature involves data)*

- **FinancialExportRequest**: Objeto de parâmetros que define o formato desejado (`format`), filtros temporais (`month`, `startDate`, `endDate`), filtro por conta bancária (`accountId`) e filtro por categoria (`category`).
- **ExportTransactionRecord**: DTO intermediário sanitizado contendo os dados padronizados para renderização em qualquer um dos três formatos: data formatada, descrição amigável, categoria canônica, nome da conta bancária de origem, tipo de transação (Crédito/Débito) e valor monetário formatado.
- **ExportSummaryMetrics**: Sumário analítico consolidado para exibição nos relatórios (especialmente PDF), englobando quantidade de lançamentos, totalização de entradas, totalização de saídas e balanço líquido do extrato exportado.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuários conseguem baixar extratos com até 1.000 lançamentos em menos de 2 segundos para qualquer um dos três formatos disponíveis.
- **SC-002**: 100% dos arquivos CSV gerados abrem diretamente no Microsoft Excel e LibreOffice em computadores configurados no Brasil sem apresentar problemas de codificação de caracteres ou desalinhamento de colunas.
- **SC-003**: 100% das tentativas de exportar transações utilizando filtros de contas pertencentes a outros usuários resultam em bloqueio de segurança com erro apropriado, sem vazamento de dados.
- **SC-004**: Os relatórios em PDF gerados mantêm integridade visual, paginação limpa e ausência de corte de texto mesmo para descrições longas de estabelecimentos.

---

## Assumptions

- O usuário já está autenticado no sistema via token JWT para solicitar qualquer exportação.
- As transações armazenadas no banco seguem o esquema canônico da plataforma, com valores numéricos padronizados e categorias canônicas vigentes.
- A biblioteca de geração de PDF e XLSX deve operar inteiramente em memória no backend sem exigir a instalação de navegadores sem cabeça (headless browsers) como Puppeteer ou Chromium, mantendo a aplicação leve e segura em container Docker.
