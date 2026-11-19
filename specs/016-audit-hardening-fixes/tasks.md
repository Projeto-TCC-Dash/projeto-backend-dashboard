# Tasks: Audit Hardening & Bug Fixes (016)

- [x] T001 SpecKit artifacts created (`spec.md`, `plan.md`, `tasks.md`)
- [x] T002 [P] Add `CORS_ORIGINS` to `src/config/env.ts` and enforce in `src/app.ts` and `src/routes/chat.routes.ts`
- [x] T003 [P] Remove `body: request.body` from `ZodError` log in `src/plugins/error-handler.plugin.ts`
- [x] T004 [P] Enforce `GOOGLE_CLIENT_ID` audience check on `access_token` fallback in `src/services/google-auth.service.ts`
- [x] T005 [P] Reject `NETWORK_ERROR` in `GeminiService.validateApiKey` in `src/services/gemini.service.ts`
- [x] T006 [P] Fix `fixedCostTrend` negative change tracking in `src/services/analysis.service.ts`
- [x] T007 [P] Call `AnalysisService.invalidate(userId)` in `TransactionService.updateTransaction`, `importTransactions`, and `reassociateCategories`
- [x] T008 Add/update unit tests in `tests/unit/` and verify `npm test -- --run` and `npm run typecheck`
