# Feature Specification: Hardening & Scale Round 2 (017)

**Feature Branch**: `017-hardening-and-scale-round-2`  
**Created**: 2026-11-19  
**Status**: Approved  
**Input**: Round 2 improvements from `/ponytail-review` and post-audit inspection

## Requirements

- **FR-001**: `AccountService.deleteAccount` MUST call `AnalysisService.invalidate(userId)` when `cascade === true` deletes one or more transactions.
- **FR-002**: `CsvExportService.generate` MUST neutralize spreadsheet formula injection by prefixing cell values starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with `'`.
- **FR-003**: `GeminiService.categorizeMerchants` MUST process `merchants` in chunks of at most 50 items to prevent output token truncation and timeouts on large statements.
