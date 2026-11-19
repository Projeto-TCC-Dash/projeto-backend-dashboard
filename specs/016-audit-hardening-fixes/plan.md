# Implementation Plan: Audit Hardening & Bug Fixes (016)

**Branch**: `016-audit-hardening-fixes` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

## Summary

Apply targeted security, correctness, and cache-invalidation fixes identified in `/ponytail-audit` (`#1–#5`, `#8`) with minimal diff and full adherence to the Backend Constitution (strict TypeScript, zero `any`, Zod env/route contracts, Vitest coverage).

## Constitution Check

- **Principle I (Strict TS, zero `any`)**: Compliant.
- **Principle II (Fastify + Zod + Mongoose)**: Compliant; `CORS_ORIGINS` added to Zod `envSchema`.
- **Principle III (BYOK)**: Strengthened by rejecting `NETWORK_ERROR` in `validateApiKey`.
- **Principle VII (LGPD & Privacy-by-Design)**: Strengthened by removing `request.body` from `ZodError` logs.

## Project Structure (Touched Files)

- `src/config/env.ts` — add optional `CORS_ORIGINS`
- `src/app.ts` — configure `@fastify/cors` origin check from `CORS_ORIGINS`
- `src/routes/chat.routes.ts` — reuse CORS allowlist for manual SSE headers
- `src/plugins/error-handler.plugin.ts` — remove `body: request.body` from `ZodError` log
- `src/services/google-auth.service.ts` — verify `access_token` audience via `tokeninfo` when `GOOGLE_CLIENT_ID` is set
- `src/services/gemini.service.ts` — remove `NETWORK_ERROR` from provisional key acceptance
- `src/services/analysis.service.ts` — track max absolute change in `fixedCostTrend`
- `src/services/transaction.service.ts` — invalidate `AnalysisService` on update, import, and re-association
- `tests/unit/google-auth.service.test.ts`, `tests/unit/gemini-errors.test.ts`, `tests/unit/analysis-multimonth.test.ts`, `tests/unit/transaction-service.test.ts` — regression tests
