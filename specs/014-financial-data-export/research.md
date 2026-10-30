# Research: Central de Exportação de Dados Financeiros (CSV, XLSX e PDF)

**Feature**: `014-financial-data-export`
**Date**: 2026-10-30

## 1. Biblioteca para Geração de Planilhas Eletrônicas (XLSX)

### Contexto
O requisito FR-006 exige a exportação estruturada em planilha Excel (`.xlsx`) com colunas tipadas nativamente (numérica/moeda e data), larguras dinâmicas e cabeçalhos estilizados, operando em memória sem dependências externas pesadas.

### Decisão
Utilizar a biblioteca **`exceljs`** (versão `^4.4.0` com `@types/exceljs`).

### Rationale
- `exceljs` é a biblioteca padrão na comunidade Node.js/TypeScript para manipulação completa de arquivos OOXML (.xlsx).
- Suporta geração em buffer na memória (`workbook.xlsx.writeBuffer()`), ideal para resposta imediata de streaming HTTP no Fastify.
- Permite configurar larguras de coluna dinâmicas baseadas no comprimento do texto (`column.width = Math.max(...)`).
- Oferece formatação nativa de células (`numFmt: 'R$ #,##0.00'`, `numFmt: 'dd/mm/yyyy'`), permitindo que softwares de planilha calculem fórmulas automaticamente.
- 100% pura em JavaScript/TypeScript sem dependência de binários nativos ou navegadores.

### Alternativas Consideradas
- `xlsx` (SheetJS): Muito popular, mas a versão Community Edition possui suporte limitado e complexo para estilização avançada de células e cores de cabeçalho sem plugins proprietários.
- Gerador manual XML: Extremamente propenso a falhas de especificação OpenXML e complexidade desnecessária de manutenção.

---

## 2. Biblioteca para Geração de Relatórios Imprimíveis (PDF)

### Contexto
O requisito FR-007 exige a emissão de relatórios em formato PDF com cabeçalho institucional, sumário de KPIs consolidados (Receitas, Despesas e Saldo Líquido), tabela de transações e paginação automática com rodapé (`Página X de Y`). Deve ser leve e compatível com containers Docker sem exigir Chromium/Puppeteer.

### Decisão
Utilizar a biblioteca **`pdfkit`** (com `@types/pdfkit`).

### Rationale
- `pdfkit` é um motor maduro e declarativo de geração de PDF baseado em streaming puro de vetores e texto em Node.js.
- Extremamente leve (~alguns megabytes), não necessita de navegadores headless (como Puppeteer, Playwright ou wkhtmltopdf), respeitando os limites de memória e performance de containers Docker.
- Suporta escrita direta em stream ou acumulação em buffer via `pdfkit` chunks (`doc.on('data', chunk)` / `doc.on('end')`).
- Controle preciso de paginação (`doc.bufferedPageRange()`), facilitando a numeração posterior de páginas no rodapé e quebra automática de tabelas.

### Alternativas Consideradas
- `puppeteer` / `playwright`: Exigem instalação de binários do Chromium (>300MB), alto consumo de CPU e RAM, além de riscos de segurança ao renderizar HTML arbitrário no servidor.
- `jspdf`: Focado historicamente em frontend; tipagem e recursos de streaming em backend Node.js são inferiores ao `pdfkit`.

---

## 3. Padrão de Formatação e Compatibilidade do Arquivo CSV

### Contexto
O requisito FR-005 e o cenário SC-002 exigem que o arquivo `.csv` abra diretamente no Microsoft Excel e LibreOffice em computadores no Brasil sem desconfiguração de caracteres acentuados ou colunas colapsadas em uma única célula.

### Decisão
- **BOM (Byte Order Mark)**: Prefixar o conteúdo do arquivo com o caractere UTF-8 BOM `\uFEFF`.
- **Delimitador de Colunas**: Ponto e vírgula (`;`), que é o separador padrão esperado pelo Excel em sistemas operacionais configurados com locale PT-BR (onde a vírgula é reservada para casas decimais).
- **Formatação Numérica**: Vírgula como separador decimal (ex: `1250,50`) e sinal negativo explícito para despesas.
- **Formatação de Data**: Padrão `DD/MM/YYYY`.
- **Escape de Caracteres**: Envolver campos de texto (Descrição, Categoria, Conta) entre aspas duplas (`"..."`) e duplicar aspas internas (`""`) caso ocorram no texto original.
- **Implementação**: Gerador dedicado e determinístico em memória em `CsvExportService`, sem overhead de bibliotecas pesadas de parsing externo.

### Alternativas Consideradas
- Delimitador vírgula (`,`): Padrão americano, que faz o Excel brasileiro agrupar toda a linha na coluna A, frustrando o usuário.
- CSV sem BOM: Causa problemas crônicos de encoding no Excel ("AÃ§Ã£o" em vez de "Ação").

---

## 4. Estratégia de Consulta, Filtros e Isolamento Multi-Tenant

### Contexto
O endpoint `GET /api/transactions/export` recebe parâmetros opcionais de consulta (`month`, `startDate`, `endDate`, `accountId`, `category`) e o formato obrigatório (`format`).

### Decisão
- A consulta ao MongoDB é executada via `TransactionModel.find(query).sort({ date: -1, _id: -1 }).lean()`.
- O filtro de `userId` extraído do JWT (`request.user.id`) é injetado **incondicionalmente** no filtro raiz do Mongo: `{ userId: new Types.ObjectId(userId) }`.
- Se o parâmetro `accountId` for informado, o backend valida antecipadamente se a conta pertence ao `userId` chamando `AccountModel.findOne({ _id: accountId, userId })`. Se não pertencer, retorna `404 Not Found` (ou `403 Forbidden`).
- Tratamento de filtros de data:
  - Se `month` (`YYYY-MM`) for fornecido: calcula início do mês (`YYYY-MM-01T00:00:00.000Z`) e final do mês (`YYYY-MM-lastDayT23:59:59.999Z`).
  - Se `startDate` e `endDate` forem fornecidos: valida que `startDate <= endDate` via schema Zod e filtra `{ $gte: start, $lte: end }`.
- Para enriquecer o extrato com o nome da conta bancária de cada lançamento, carrega em memória um mapa das contas do usuário (`Map<string, string>`) via `AccountModel.find({ userId }).select('_id name')`, evitando lookups pesados no banco.

---

## 5. Headers HTTP e Download no Navegador

### Contexto
Garantir que a resposta da rota force o download do arquivo com nome e extensão semânticos.

### Decisão
Configurar os cabeçalhos Fastify:
- `Content-Disposition`: `attachment; filename="extrato-financeiro-<periodo>.<ext>"`
- `Content-Type`:
  - CSV: `text/csv; charset=utf-8`
  - XLSX: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - PDF: `application/pdf`
- Retornar o buffer binário resultante diretamente com status HTTP 200.
