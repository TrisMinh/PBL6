# `<CARD-ID>` — Tên outcome

## Metadata

| Trường | Giá trị |
|---|---|
| Epic/Sprint | `EP-xx / Sx` |
| Priority | `P0/P1/P2` |
| Owner / Reviewer | `<ROLE>` / `<ROLE>` |
| Estimate | `0.5/1/2/3 PD` |
| Status | `BACKLOG/READY/IN PROGRESS/REVIEW/BLOCKED/DONE` |
| Depends | `<CARD/DEP-ID>` hoặc `—` |
| Trace | `FR-*`, `AC-*`, `NFR-*`, contract/migration link |
| Started / Due | `YYYY-MM-DD / YYYY-MM-DD` |

## Outcome

Mô tả giá trị có thể quan sát sau khi card Done. Không chỉ ghi tên file hoặc “code API”.

## Scope

- In:
- Out:

## Acceptance checklist

- [ ] Happy path.
- [ ] Validation/error path.
- [ ] Permission/tenant negative path hoặc `N/A` có lý do.
- [ ] Concurrency/idempotency/retry path hoặc `N/A` có lý do.
- [ ] Contract/migration/client sync hoặc `N/A`.
- [ ] Unit/component/integration/E2E phù hợp pass.
- [ ] Log/metric/audit và PII/secret check.
- [ ] Docs/runbook/board cập nhật.

## Implementation checklist

- [ ] Thiết kế nhỏ/contract được review.
- [ ] Code.
- [ ] Test.
- [ ] Self-review diff.
- [ ] PR + reviewer.
- [ ] Fix review + CI pass.
- [ ] Merge + evidence + chuyển Done.

## Evidence

```text
PR:
Tests:
Contract/Migration:
Demo:
Trace:
```

## Blocker / decision log

| Ngày | ID | Mô tả | Owner/Next action | Due | Kết quả |
|---|---|---|---|---|---|
