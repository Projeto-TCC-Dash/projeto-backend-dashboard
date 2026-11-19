# Feature Specification: Audit Hardening & Bug Fixes (016)

**Feature Branch**: `016-audit-hardening-fixes`  
**Created**: 2026-11-19  
**Status**: Approved  
**Input**: Findings `#1–#5` and `#8` (backend) from `/ponytail-audit`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Auth, Logging & CORS Boundaries (Priority: P1)

As a platform user, I need my Google OAuth tokens, Gemini BYOK keys, and passwords to be validated and protected against audience spoofing, network-error bypass, log exposure, and wildcard CORS.

**Why this priority**: Directly closes security and privacy gaps under Constitution Principles III and VII.

**Independent Test**: Unit tests for `GoogleOAuthService` (access-token audience check), `GeminiService.validateApiKey` (`NETWORK_ERROR` rejection), `error-handler.plugin.ts` (no `request.body` in logs), and `app.ts`/`chat.routes.ts` (CORS origin allowlist).

**Acceptance Scenarios**:
1. **Given** `GOOGLE_CLIENT_ID` is configured, **When** `verifyIdToken` receives an `access_token` issued for a different OAuth client, **Then** it rejects with `InvalidGoogleTokenError`.
2. **Given** Gemini API validation fails with `NETWORK_ERROR`, **When** `validateApiKey` runs, **Then** it throws `GeminiApiError` instead of saving the key as `ACTIVE_PROVISIONAL_DEMAND`.
3. **Given** a request fails Zod validation (`ZodError`), **When** the global error handler logs the warning, **Then** `request.body` is omitted from log metadata.
4. **Given** `CORS_ORIGINS` is configured, **When** a request arrives from a disallowed origin (including SSE `/api/chat/stream`), **Then** CORS headers do not reflect the disallowed origin.

---

### User Story 2 - Accurate Multi-Month Trend & Analysis Cache Invalidation (Priority: P2)

As a user reviewing my dashboard, I need fixed-cost reductions to show `DECLINING` and monthly AI analyses to invalidate whenever transactions are edited, imported, or re-categorized.

**Why this priority**: Prevents silent wrong analytics (`DECLINING` unreachable) and 24h stale AI diagnoses.

**Independent Test**: Unit tests for `AnalysisService.getMultiMonthSummary` (`DECLINING` case) and `TransactionService` (`updateTransaction`, `importTransactions`, `reassociateCategories` calling `AnalysisService.invalidate`).

**Acceptance Scenarios**:
1. **Given** fixed costs (`Moradia`, `Saúde`, `Educação`) drop by 15% or more between the first and last month, **When** `getMultiMonthSummary` runs, **Then** `fixedCostTrend.status` is `'DECLINING'` with negative `percentageChange`.
2. **Given** a user updates, imports, or re-categorizes transactions, **When** the operation modifies data, **Then** `AnalysisService.invalidate(userId)` is invoked.

## Requirements *(mandatory)*

- **FR-001**: `GoogleOAuthService.verifyIdToken` MUST verify `aud`/`azp` against `env.GOOGLE_CLIENT_ID` via `tokeninfo?access_token=...` whenever `env.GOOGLE_CLIENT_ID` is set.
- **FR-002**: `GeminiService.validateApiKey` MUST only accept `UPSTREAM_UNAVAILABLE` (503) and `RATE_LIMIT_ERROR` (429) as `ACTIVE_PROVISIONAL_DEMAND`, never `NETWORK_ERROR`.
- **FR-003**: `setupErrorHandler` MUST NOT log `request.body` on `ZodError`.
- **FR-004**: `env.ts` MUST support optional `CORS_ORIGINS` (comma-separated); `app.ts` and `chat.routes.ts` MUST enforce it when set.
- **FR-005**: `AnalysisService.getMultiMonthSummary` MUST track the largest-magnitude percentage change across fixed categories so `DECLINING` (`<= -15%`) is reachable.
- **FR-006**: `TransactionService.updateTransaction`, `importTransactions` (when `imported > 0`), and `reassociateCategories` (when `totalUpdated > 0`) MUST call `AnalysisService.invalidate(userId)`.

## Out of Scope

- **Finding #9 (Vercel disk uploads)**: Deferred pending storage backend decision (local disk vs MongoDB vs Blob storage).
