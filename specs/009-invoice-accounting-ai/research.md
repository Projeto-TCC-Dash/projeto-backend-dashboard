# Phase 0: Research & Technical Decisions - Feature 009

## Context
Feature 009 introduces intelligent accounting for credit card bill payments ("Pagamento de Fatura") to prevent double-counting of expenses in metric calculations, AI financial diagnoses, and chat assistant summaries.

---

### Research Item 1: Accounting Segregation Formula in `calculateMetrics`
- **Decision**: In `AnalysisService.calculateMetrics`, separate negative transactions with `category === 'Pagamento de Fatura'` into `invoiceSettlements` without incrementing `totalExpenses` or populating `topCategories`.
- **Rationale**:
  - Credit card purchases are already recorded and categorized individually (e.g. R$ 300 in "Alimentação", R$ 150 in "Transporte").
  - The payment of the credit card invoice from the bank account is an inter-account transfer / balance settlement (liquidação de passivo), not a new primary consumption expense.
  - Adding the bill payment to `totalExpenses` results in counting the same consumption twice (R$ 450 items + R$ 450 invoice = R$ 900 fake expenses).
  - Segregating this into `invoiceSettlements` preserves the real consumption total (`totalExpenses = 450`) and exposes the cash outflow allocated to credit settlement (`invoiceSettlements = 450`).
- **Alternatives Considered**:
  - *Keep bill payments in `totalExpenses`*: Rejected. Breaches accounting principles and invalidates AI budget advice.
  - *Silently discard invoice payments from metrics*: Rejected. Financial visibility requires reporting how much was transferred to settle credit card bills.

---

### Research Item 2: Impact on `savingsRate` and `netBalance`
- **Decision**: Calculate `netBalance = round(totalIncome - totalExpenses)` and `savingsRate = max(0, round(((totalIncome - totalExpenses) / totalIncome) * 100))`.
- **Rationale**:
  - In accrual/budgetary management (regime de competência do orçamento doméstico), consumption capacity and savings rate are determined by the real operational expenses incurred against income.
  - If we deducted both individual card charges and the invoice payment from the savings rate formula, a disciplined user who pays their invoice in full would appear to have an artificially degraded or negative savings rate.
- **Alternatives Considered**:
  - *Deducting invoiceSettlements from netBalance*: Evaluated and rejected as default because card transactions in the month already represent the expenditure.

---

### Research Item 3: LLM System Prompt Calibration (Diagnosis & Chat)
- **Decision**: Update `GeminiService.generateFinancialDiagnosis` and `ChatService.buildSystemInstruction` with explicit accounting context:
  - Explain that `totalExpenses` represents real operational consumption.
  - Explain that `Pagamento de Fatura` / `invoiceSettlements` represents balance settlement of credit cards, not duplicate shopping.
- **Rationale**:
  - LLMs without clear accounting context frequently misinterpret high invoice payments as excessive discretionary spending, giving confusing recommendations such as "reduce your invoice payments" instead of focusing on actual consumption drivers (e.g. eating out, delivery).
- **Alternatives Considered**:
  - *Omitting invoice payments entirely from the prompt*: Rejected. The LLM benefits from knowing that the user is actively paying their bills in full, which is a strong indicator of credit health.
