# Research & Technical Decisions: Categorias Canônicas, Edição Manual e Configuração de Seed

**Feature**: `006-transaction-categories-editing`  
**Date**: 2026-10-13  
**Status**: Concluído (All decisions resolved)

## 1. Extensão da Taxonomia de Categorias Canônicas & Categoria Inicial

### Decisão
Expandir a constante `CANONICAL_CATEGORIES` em `src/config/constants.ts` para incluir `"Receita"` e `"Não Categorizado"`, totalizando 9 categorias canônicas:
1. `Alimentação`
2. `Transporte`
3. `Moradia`
4. `Saúde`
5. `Lazer`
6. `Educação`
7. `Receita`
8. `Outros`
9. `Não Categorizado`

Atualizar `SYSTEM_DEFAULTS.DEFAULT_CATEGORY` de `"Outros"` para `"Não Categorizado"`.

### Rationale
- **Clareza Semântica**: Anteriormente, transações importadas recebiam a categoria `"Outros"`, gerando confusão entre despesas que pertencem legitimamente a outros tópicos e transações pendentes de revisão/análise.
- **Identificação de Pendências**: A categoria `"Não Categorizado"` estabelece um estado inicial inequívoco para todas as transações importadas via extratos (.ofx e .csv).
- **Tratamento de Entradas Financeiras**: Transações de crédito/positivas (salários, depósitos, dividendos) necessitam da categoria `"Receita"` para cálculo correto do fluxo de caixa e relatórios financeiros sem misturar receitas com despesas operacionais.
- **Compatibilidade com Zod e Mongoose**: Definir ambas na lista canônica preserva a tipagem TypeScript estrita (`Category = z.infer<typeof CategoryEnum>`) e a validação do schema do Mongoose (`enum: CANONICAL_CATEGORIES`).

### Alternativas Consideradas
- *Criar um campo booleano separado `isCategorized` ou `status`*: Rejeitado para não alterar a complexidade do schema de transação, evitando migrações e quebra de contratos de listagem existentes no dashboard. Tratar `"Não Categorizado"` como membro do enum de categorias é mais simples, elegante e imediatamente consumível pelo frontend.
- *Manter "Receita" fora das categorias e inferir apenas pelo sinal do `amount`*: Rejeitado porque transações podem ser ajustadas ou identificadas pelo usuário (por exemplo, estornos ou reembolsos) e ter a categoria explícita "Receita" permite filtros diretos e categorização guiada pela IA.

---

## 2. Design da Rota de Edição Manual: `PATCH /api/transactions/:id`

### Decisão
Implementar a rota `PATCH /api/transactions/:id` no plugin `transactionRoutes` (`src/routes/transactions.routes.ts`) protegida por `requireAuth`:
- **Parâmetro de Rota (`params`)**: Validação do `id` com Zod regex para 24 caracteres hexadecimais de ObjectId do MongoDB.
- **Corpo da Requisição (`body`)**: `UpdateTransactionBodySchema` aceitando:
  - `category`: `CategoryEnum.optional()`
  - `cleanDescription`: `z.string().trim().min(1).max(255).optional()`
  - Validação de refinamento Zod garantindo que o body contenha pelo menos um dos campos (`refine(data => data.category !== undefined || data.cleanDescription !== undefined)`).
- **Isolamento Multi-tenant**: A busca e atualização no banco utilizam `{ _id: transactionObjectId, userId: userObjectId }`. Se o documento não for encontrado, responde com HTTP 404 (`Transação não encontrada ou acesso não autorizado`), impedindo que usuários descubram a existência de transações alheias.
- **Resposta**: Retorna a transação atualizada no formato `TransactionItemSchema` com código HTTP 200.

### Rationale
- **Conformidade RESTful**: `PATCH` é o verbo semântico correto para atualizações parciais de recursos.
- **Imutabilidade Contábil**: Campos sensíveis de auditoria bancária (`amount`, `date`, `rawDescription`, `externalId`, `source`) não são expostos no payload de atualização, prevenindo adulteração involuntária de extratos financeiros e inconsistências de conciliação.
- **Segurança e LGPD**: O isolamento pelo `userId` extraído diretamente do token JWT atende integralmente ao Princípio VII da Constituição.

### Alternativas Consideradas
- *Usar PUT para atualização completa da transação*: Rejeitado porque forçaria o cliente a reenviar todos os campos, aumentando o tráfego de rede e o risco de sobrescrever campos que não devem ser alterados pelo usuário.
- *Permitir edição de `amount` e `date`*: Rejeitado para preservar a fidelidade histórica do extrato bancário importado contra adulterações contábeis.

---

## 3. Seleção de Lançamentos para Categorização Inteligente por IA

### Decisão
Atualizar `TransactionService.getUniqueUncategorizedMerchants` para filtrar transações onde `category: SYSTEM_DEFAULTS.DEFAULT_CATEGORY` (que agora é `"Não Categorizado"`).
Atualizar o prompt do Gemini em `src/services/gemini.service.ts` para instruir a classificação nas categorias canônicas agora vigentes, orientando o modelo a classificar créditos ou termos como 'salário', 'proventos', 'ted recebida', 'pix recebido' como `"Receita"`.

### Rationale
- **Eficiência e Minimização de Tokens**: A IA só é consultada para os estabelecimentos comerciais de transações que ainda permanecem como `"Não Categorizado"`. Transações que o usuário já editou ou classificou como `"Outros"` ou `"Receita"` não são reenviadas para a IA, economizando tokens e respeitando a decisão manual do usuário.
- **Preservação de Escolhas Manuais**: O `$setOnInsert` na importação e o filtro estrito em `"Não Categorizado"` protegem o usuário de ter suas transações reclassificadas inadvertidamente.

### Alternativas Consideradas
- *Classificar também transações com categoria "Outros"*: Rejeitado, pois se o usuário conscientemente alterou uma transação para "Outros", a IA não deve sobrescrevê-la.

---

## 4. Documentação de `GOOGLE_GENERATIVE_AI_API_KEY` no `.env.example` para Seed

### Decisão
Adicionar no arquivo `.env.example` a variável `GOOGLE_GENERATIVE_AI_API_KEY` acompanhada de comentários explicativos detalhados, indicando:
1. Trata-se de uma variável opcional voltada ao ambiente de desenvolvimento local.
2. É consumida pelo script `npm run seed` para auto-vincular a chave criptografada ao usuário de testes e pré-aquecer a análise financeira do mês atual no cache.
3. Se omitida, o script de seed opera em modo 100% autônomo e offline, gerando todas as transações sintéticas com sucesso sem falhas.

### Rationale
- **Onboarding sem Fricção**: Desenvolvedores e avaliadores do projeto sabem imediatamente como habilitar o recurso de pré-aquecimento de IA para testes completos do dashboard.
- **Conformidade com a Constituição**: A plataforma permanece com custo zero no servidor (BYOK) e autônoma sem rede (Princípios III e V).
