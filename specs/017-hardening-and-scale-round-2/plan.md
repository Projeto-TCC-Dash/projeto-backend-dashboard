# Implementation Plan: Hardening & Scale Round 2 (017)

**Branch**: `017-hardening-and-scale-round-2` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

## Project Structure (Touched Files)

- `src/services/account.service.ts` — invalidate `AnalysisService` on cascade transaction deletion
- `src/services/csv-export.service.ts` — neutralize formula prefixes in `escapeCsvField`
- `src/services/gemini.service.ts` — chunk `categorizeMerchants` into batches of 50
- `tests/unit/account.service.test.ts`, `tests/unit/csv-export.service.test.ts`, `tests/unit/categorization.test.ts` — unit tests
