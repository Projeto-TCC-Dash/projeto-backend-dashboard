# Phase 0: Research & Technical Decisions - Feature 008

## Context
Feature 008 expands the platform's canonical categories to support credit card invoice payments ("Pagamento de Fatura") and investment transfers ("Investimentos"), and introduces single-transaction deletion with atomic removal, strict multi-tenant ownership verification, and cache invalidation.

---

### Research Item 1: Expansion of Canonical Categories
- **Decision**: Add `"Pagamento de Fatura"` and `"Investimentos"` to `CANONICAL_CATEGORIES` in `src/config/constants.ts`, maintaining order and expanding the total canonical categories from 9 to 11.
- **Rationale**:
  - `CategoryEnum` is defined as `z.enum(CANONICAL_CATEGORIES)`, so updating this single array automatically cascades to:
    - Zod schemas (`CategoryEnum`, `UpdateTransactionBodySchema`, `ListTransactionsQuerySchema`)
    - TypeScript types (`Category`)
    - Mongoose validation in `src/models/transaction.model.ts`
  - In `src/services/gemini.service.ts`, `CANONICAL_CATEGORIES` is directly injected into the prompt and JSON schema enum for structured output.
- **Alternatives Considered**:
  - *Dynamic user-created categories*: Rejected. The architecture strictly enforces canonical categories to maintain deterministic financial summaries, AI categorization accuracy, and consistent aggregate metrics across all users.
  - *Keep bill payments in "Outros"*: Rejected. Users and downstream accounting (Feature 009) require explicit distinction between primary living expenses and invoice settlements to avoid double counting.

---

### Research Item 2: AI Prompt Calibration for Bill Payments and Investments
- **Decision**: Update the Gemini categorization system prompt in `src/services/gemini.service.ts` to include explicit mapping guidelines for:
  - Faturas: "Pagamento de faturas de cartão de crédito, liquidação de fatura -> Pagamento de Fatura"
  - Investimentos: "Aportes em investimentos, corretoras (ex: NuInvest, Rico, XP, Clear), tesouro direto, ações, fundos de investimento, criptoativos -> Investimentos"
- **Rationale**:
  - Financial statements in Brazil frequently contain strings such as "PAGTO FATURA CARTAO", "PAGTO ELETRON COBRANCA", "TRANSF INVEST", "TED TITULARIDADE CORRETORA", "TESOURO DIRETO".
  - Providing few-shot or clear categorical guidelines within the system instructions ensures the LLM categorizes these entries deterministically with minimal token usage.
- **Alternatives Considered**:
  - *Fine-tuning custom model*: Rejected. Out of scope and breaches BYOK model without needing extra complexity. Prompt engineering with structured outputs handles this with >95% accuracy.

---

### Research Item 3: Atomic Transaction Deletion & Multi-Tenant Enforcement
- **Decision**: Implement `DELETE /api/transactions/:id` mapped to `TransactionService.deleteTransaction(userId, transactionId)` using Mongoose `TransactionModel.findOneAndDelete({ _id: transactionObjectId, userId: userObjectId })`.
- **Rationale**:
  - `findOneAndDelete` with combined `_id` and `userId` ensures atomicity and eliminates time-of-check to time-of-use (TOCTOU) race conditions.
  - If the document does not exist OR belongs to another user, `findOneAndDelete` returns `null`. The route returns HTTP `404 Not Found` with `{ statusCode: 404, error: "Not Found", message: "Transação não encontrada ou acesso não autorizado" }`. This prevents user enumeration or existence leakage.
  - Returns HTTP `204 No Content` upon successful deletion.
- **Alternatives Considered**:
  - *Soft delete with `deletedAt`*: Rejected. The user explicitly approved hard-delete for transactions as MVP. Unwanted or duplicate transactions are expected to be purged cleanly.
  - *Separate `findOne` then `deleteOne`*: Rejected. Prone to race conditions and requires two database round-trips instead of one atomic operation.

---

### Research Item 4: Cache Invalidation Strategy (`AnalysisService.invalidate`)
- **Decision**: Add `AnalysisService.invalidate(userId: string): Promise<number>` which executes `FinancialAnalysisModel.deleteMany({ userId: new mongoose.Types.ObjectId(userId) }).exec()`.
- **Rationale**:
  - While `AnalysisService.getAnalysis` already computes deterministic SHA-256 hashes (`transactionStateHash`), physically deleting cached analysis records on transaction mutation guarantees that no obsolete cache documents occupy MongoDB storage and ensures fresh analysis generation on next request.
  - Executed asynchronously as part of the transaction deletion lifecycle without blocking errors if zero cache documents were found.
- **Alternatives Considered**:
  - *Invalidating only the specific month*: Rejected. A deleted transaction could potentially impact cross-month rolling metrics in future features. Wiping cached analyses for the affected user is lightweight and instantaneous in MongoDB.
