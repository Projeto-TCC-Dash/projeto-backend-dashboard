# Phase 0: Research & Technical Decisions - Feature 010

## Context
Feature 010 introduces a voluntary financial profile subdocument to the user account (`incomeType`, `declaredMonthlyIncome`, `goals`, `riskProfile`), exposes profile management endpoints (`GET /api/user/profile` and `PUT /api/user/profile`), and injects this financial context into Gemini AI prompts to calibrate emergency reserve targets and prioritize user goals.

---

### Research Item 1: Schema Structure (Embedded Subdocument vs. Separate Collection)
- **Decision**: Embed `financialProfile` as a subdocument directly inside the existing `User` model (`UserModel`).
- **Rationale**:
  - The financial profile has a strict 1:1 relationship with the user account.
  - Profile data is small (less than 200 bytes) and is read simultaneously with user authentication or AI analysis generation.
  - Embedding avoids extra joins / queries in MongoDB and guarantees atomic updates via Mongoose `$set`.
- **Alternatives Considered**:
  - *Separate `FinancialProfile` collection*: Rejected. Overkill for a 1:1 relationship, increases latency and complexity without benefit.

---

### Research Item 2: Emergency Reserve Calibration Heuristics for IA
- **Decision**: Calibrate the Gemini system prompt instructions based on standard financial planning heuristics in Brazil:
  - CLT & Servidor Público (`PUBLIC_SERVANT`): Recomendar reserva de 3 a 6 meses do custo de vida mensal (devido a FGTS, seguro-desemprego ou estabilidade).
  - PJ / Autônomo (`PJ_AUTONOMO`) & Empresário (`ENTREPRENEUR`): Recomendar reserva de 6 a 12 meses do custo de vida (para amortecer sazonalidade, ausência de rescisão contratual e atrasos em recebíveis).
  - Estudante (`STUDENT`) / Aposentado (`RETIRED`) / Outros (`OTHER`): Recomendar reserva conservadora de 6 meses.
  - Metas prioritárias:
    - `QUITAR_DIVIDAS`: Foco absoluto em eliminação de rotativo/juros altos antes de qualquer aplicação financeira de risco.
    - `RESERVA_EMERGENCIA`: Foco em liquidez imediata (ex: Tesouro Selic, CDB 100% CDI com liquidez diária).
    - `COMPRAR_IMOVEL`: Foco em segurança do principal e horizonte definido de resgate.
    - `INVESTIR_LONGO_PRAZO`: Foco em juros compostos e previdência/ações.
    - `CONTROLE_GASTOS`: Foco em contenção de vazamentos orçamentários.
- **Rationale**:
  - Empowers the AI to give advice comparable to a human CFP (Certified Financial Planner) while respecting the BYOK model.

---

### Research Item 3: Cache Invalidation Strategy on Profile Update
- **Decision**: Whenever `PUT /api/user/profile` updates the user's financial profile, invoke `AnalysisService.invalidate(userId)`.
- **Rationale**:
  - A user who changes their employment regime (e.g. from CLT to PJ) or their primary goal (from `CONTROLE_GASTOS` to `COMPRAR_IMOVEL`) expects the subsequent analysis on `GET /api/analysis/:month` to reflect their updated circumstances immediately, rather than waiting for the 24-hour cache TTL to expire.

---

### Research Item 4: LGPD and Privacy-by-Design Compliance
- **Decision**:
  - All profile fields are strictly optional.
  - Data is never shared externally or used for negative scoring.
  - Transported strictly via authenticated TLS and stored with logical multi-tenant isolation.
  - Never logs declared income in plain text application logs.
