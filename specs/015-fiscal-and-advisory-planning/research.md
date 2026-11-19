# Technical Research & Architectural Decisions: Fiscal Planning & Advanced Financial Advisory

**Feature**: `015-fiscal-and-advisory-planning`  
**Date**: 2026-11-18  
**Status**: Completed  

---

## 1. Extração Inteligente de Comprovantes e Notas Fiscais (OCR Multimodal)

### Decisão
Utilizar o modelo multimodal já homologado na plataforma (**Gemini 3.8 Flash** via `@google/genai`) com chave do usuário (**BYOK**) para processar uploads de imagens (JPG, PNG, WebP) e documentos PDF de recibos médicos, escolares e Notas Fiscais de Serviço (NFS-e), extraindo dados via **Structured Outputs** (JSON Schema estrito).

### Justificativa
- **Precisão semântica brasileira**: Modelos de visão do Gemini entendem perfeitamente o layout heterogêneo de recibos manuais de médicos, odontologistas e notas fiscais municipais de diferentes cidades brasileiras, extraindo CNPJs, nomes de prestadores, valores monetários e descrições de procedimentos de forma muito superior a OCRs tradicionais.
- **Custo Operacional Zero**: Cumpre estritamente o Princípio III da Constituição (BYOK) — a inferência utiliza a chave do usuário cadastrada e descriptografada apenas em memória efêmera durante a requisição.
- **Zero novas dependências pesadas**: Não requer binários C++ externos no Docker (como `tesseract-ocr` ou bibliotecas nativas de OCR), preservando a imagem de produção enxuta e estável.

### Alternativas Consideradas
- *Tesseract.js / Tesseract CLI*: Descartado por requerer pós-processamento regex complexo, ser frágil a variações de layout, ter alto consumo de CPU no container Node.js e baixa precisão em fotos com sombras ou recibos manuscritos.
- *Google Document AI / AWS Textract*: Descartado por exigir infraestrutura de nuvem externa com credenciais pagas pelo servidor, violando o princípio BYOK e gerando faturas operacionais.

---

## 2. Conformidade LGPD no Armazenamento de Identificadores Fiscais (CPF/CNPJ)

### Decisão
Armazenar identificadores de pessoas físicas (CPF) e jurídicas (CNPJ) de prestadores em campos tipados e estruturados no MongoDB (`fiscal.providerDocument`, `fiscal.providerName`), com máscaras e sanitização padrão (remoção de caracteres não-numéricos na persistência e formatação na exibição), vinculados ao isolamento multi-tenant por `userId`. **É terminantemente vedado retransmitir esses números cadastrais nos prompts de rotina de categorização bancária ou consultor de chat geral**.

### Justificativa
- **Princípio da Necessidade e Finalidade (Art. 6º da LGPD)**: O CPF/CNPJ só é necessário para a comprovação fiscal do próprio titular da conta perante a Receita Federal ou na emissão do Dossiê Fiscal. Para tarefas de inteligência artificial de categorização e diagnóstico, a natureza da despesa ("Hospital São Luiz", "Clínica Odontológica") é suficiente.
- **Isolamento de Segurança**: Os dados ficam sob o mesmo controle de tenant do usuário autenticado no JWT (`userId`), sem trânsito desnecessário por APIs de terceiros.

### Alternativas Consideradas
- *Não armazenar CPF/CNPJ de forma alguma*: Inviabilizaria a função contábil/fiscal, pois o programa gerador do IRPF e a conferência do livro-caixa exigem o número exato do documento do prestador.
- *Enviar CPF/CNPJ para todos os prompts da IA*: Violação direta do Princípio VII da Constituição e desperdício de tokens de contexto.

---

## 3. Modelo de Dados de Orçamentos Mensais (Budgets) e Monitoramento de Consumo

### Decisão
Criar uma coleção dedicada `budgets` no MongoDB com chave composta única `{ userId, month }` (formato `YYYY-MM`), contendo o teto global de despesas do mês e um array de limites específicos por categoria canônica (`categoryBudgets`). O cálculo de percentual consumido e status de alerta é realizado de forma determinística no backend cruzando os limites com os dados reais de `TransactionModel`.

### Faixas de Alerta Orçamentário
- **Regular**: Consumo `< 70%` do teto da categoria.
- **Atenção**: Consumo entre `70%` e `99.9%` do teto.
- **Excedido**: Consumo `>= 100%` do teto.

### Justificativa
- O cálculo em tempo real garante que qualquer inclusão, edição ou exclusão de transação reflita imediatamente no painel de orçamentos sem defasagem de cache.
- O resumo dos orçamentos em alerta (`Atenção` e `Excedido`) é automaticamente injetado como bloco contextual no prompt de sistema do Consultor de Chat (`/api/chat/stream`) e do Diagnóstico Mensal (`/api/analysis/:month`), capacitando a IA a dar recomendações ativas de contenção.

### Alternativas Consideradas
- *Armazenar limites dentro do User model*: Descartado porque orçamentos variam mensalmente (ex: meses de férias, IPTU ou despesas sazonais têm limites diferentes).
- *Teto único sem distinção por categoria*: Rejeitado por não permitir identificar o centro de custo específico responsável pelo desvio orçamentário.

---

## 4. Análise Multi-Mês e Médias Móveis

### Decisão
Implementar o serviço de agregação multi-mês em `AnalysisService.getMultiMonthSummary(userId, range)` suportando janelas de 3, 6 e 12 meses. O serviço calcula:
- Taxa média de poupança no período.
- Média móvel e variância de despesas por categoria.
- Detecção de aumento sustentado em custos fixos (identificação de aumentos superiores a 15% em despesas de moradia, saúde ou educação).
- Tendência linear de saldo líquido (crescimento, estagnação ou déficit contínuo).

### Justificativa
- Permite diagnosticar a "inflação de padrão de vida" (lifestyle creep), que passa despercebida quando o usuário analisa apenas um mês de cada vez.
- As métricas são computadas com pipelines de agregação do MongoDB de alta performance e indexadas por `{ userId: 1, date: -1 }`.

---

## 5. Estrutura da Carteira de Investimentos (Asset Allocation)

### Decisão
Criar a entidade `InvestmentHoldingModel` (`investment_holdings`) associada a contas do tipo `INVESTMENT`. A carteira é segmentada em 6 macroclasses canônicas:
1. `FIXED_INCOME`: Tesouro Direto, CDBs, LCIs/LCAs, Debêntures.
2. `EQUITIES`: Ações brasileiras e fundos de ações.
3. `REAL_ESTATE`: Fundos Imobiliários (FIIs) e imóveis físicos para renda.
4. `INTERNATIONAL`: BDRs, ETFs globais, ativos dolarizados.
5. `CRYPTO`: Criptoativos e cestas indexadas.
6. `CASH_LIQUIDITY`: Reserva de emergência imediata (Tesouro Selic, fundos DI taxa zero).

### Regra de Calibração com o Perfil de Risco
- **CONSERVATIVE**: Meta recomendada de >= 80% em `FIXED_INCOME` / `CASH_LIQUIDITY`; máximo de 20% em classes voláteis.
- **MODERATE**: Meta recomendada de 50-70% em Renda Fixa/Liquidez e 30-50% diversificado em Renda Variável, FIIs e Internacional.
- **AGGRESSIVE**: Meta permitida de até 70-80% em classes voláteis (Ações, FIIs, Internacional, Cripto), mantendo a reserva mínima de liquidez.

---

## 6. Painel Fiscal para Autônomos e PJ (MEI / Simples Nacional)

### Decisão
Implementar em `FiscalService` funções determinísticas de acompanhamento da Pessoa Jurídica e do Autônomo baseadas nas transações classificadas como `Receita` em contas PJ:
- Total de faturamento bruto acumulado no ano-calendário.
- Limite de enquadramento anual parametrizado (padrão MEI: R$ 81.000,00; Simples Nacional Faixa 1: R$ 180.000,00).
- Projeção linear de faturamento para o encerramento do exercício.
- Segregação de saídas classificadas pelo usuário como `Pró-labore` vs `Distribuição de Lucros`.
