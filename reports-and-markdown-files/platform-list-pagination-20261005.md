# Platform list pagination — 2026-10-05

## Owner request and result

The owner requested pagination for long vertical lists, especially approved and rejected recharge requests. Lists now start with 10 records, with Previous/Next controls; the shared page control also offers 20 and 50 records, page totals and visible item ranges. Arabic labels/number formatting and RTL are supported.

The old recharge endpoints returned only 50 recent records. Page buttons over that truncated array would hide older history permanently. The updated screens request bounded server pages and count the complete authorized/filter-matching scope instead. Stable `createdAt DESC, id DESC` ordering distinguishes records with identical timestamps. Changing search, status, date or page size returns to page one; out-of-range pages clamp after records or filters change. Older asynchronous responses cannot replace newer recharge results.

## Coverage

| Area | Implementation |
| --- | --- |
| ADMIN pending/approved/rejected/all recharge requests | Server paging and totals, full-scope sender/reference search and transfer-date filter |
| STUDENT own recharge history | Server paging; only the authenticated student's safe request metadata |
| Course and package purchase histories | Independent server pages and totals for each receipt list |
| STUDENT assessment submission history | Server pages beyond the previous 30-record cap; student/assessment scope and metadata-only selection remain enforced |
| ADMIN practice allowance student search | Server pages and complete search scope |
| ADMIN student directory | Existing cursor pagination retained; screen requests 10 records, backend validates an optional 1–50 limit and preserves legacy default 20 |
| ADMIN course/package/assessment lists | Shared paging over existing loaded collections |
| ADMIN sections, section ordering, lessons and price plans | Shared paging; global ordering indices remain unchanged; hidden-page editors are not mounted |
| ADMIN/STUDENT lesson resources | Shared paging over existing loaded resources |
| Public course/package catalogs | Shared paging, filter reset; compact homepage collections remain compact |
| STUDENT active/expired course dashboard | Separate shared paged lists |
| Notification inbox | Shared display paging over loaded messages; existing authorized server cursor and older-message loading remain available |

Existing ADMIN submission review cursor pagination is preserved. Sequential lesson curriculum navigation and the questions/options inside a single assessment remain intact: paging these arbitrarily would change progression or grading semantics. Small fixed menus/settings/receiving methods are not long record collections.

`Pagination` supplies the bilingual controls; `PaginatedCollection` is explicitly for already-loaded collections. It limits mounted DOM/editors and checks the existing unsaved-changes guard before changing pages or sizes. It does **not** turn those existing catalog/dashboard/resource fetch contracts into bounded database requests. This delivery is not a 10,000-user capacity certification. Offset pages have deterministic ordering but do not promise a frozen snapshot while new records arrive.

## Backend compatibility and boundaries

The common list-query parser validates positive integer pages (maximum 10,000), sizes (maximum 50), bounded search and valid calendar dates. Responses with paging requested include `{ page, pageSize, total }`. Older clients without paging parameters retain their existing array shape/default limits. Protected paged histories are private/no-store. No authorization, purchase, approval, balance, progression, retention or grading policy changes were made.

No schema migration is added for pagination. The previously completed InstaPay QR migration and dashboard work remain preserved in this uncommitted working tree. The external DRM source/API contract, its database and real video are unchanged.

## Verification

All application, test and browser execution used Docker. Disposable project `fayq-ide-modes-test` is ownership/mount guarded, has no published ports and uses fresh synthetic PostgreSQL/Redis volumes. Synthetic display fixtures contain more than 100 records; they are not evidence of real financial approval or ledger operations.

- Pagination integration: **6/6 passed** — malformed parameters, older rejected records beyond 100, disjoint/repeatable tied-timestamp pages, full filtered search, page clamping, STUDENT privacy/ADMIN authorization, bounded receipts/directory and private submission history beyond 30.
- Financial/payment/QR regression: **56/56 passed** on real disposable PostgreSQL/Redis.
- Pagination Chromium flow through Nginx: **21/21 passed** — rejected/approved transitions, page-size selection, older requests, search, catalog filter reset, bounded editors/directories, own wallet and receipts, public catalog, mobile and Arabic RTL, zero page exceptions.
- Payment/QR browser regression: **32/32 passed**.
- ADMIN workspace/draft protection browser regression: **27/27 passed**.
- Backend/frontend production builds and backend test typecheck passed. Final diff whitespace check passed.

Total targeted verification: **62 backend integration tests and 80 browser checks**. Commands:

```powershell
node docker/ide/modes-verify.mjs --pagination-only
node docker/ide/modes-verify.mjs --pagination-only --browser-only
node docker/ide/modes-verify.mjs --wallet-browser-only
node docker/ide/modes-verify.mjs --admin-tabs-only
```

The browser-only option repeats browser verification without rerunning already-passing integration suites. Set `DOCKER_EXE` only when Docker is not on PATH; application/tests execute inside containers.

Failures encountered were corrected rather than treated as passes: initial synthetic recharge fixtures violated existing reference/hash/review-state constraints; the fixtures now respect those constraints, without weakening them. The student directory ignored the proposed limit because it had a fixed backend size; optional bounded limits were implemented. A wallet check inspected the initial loading state; it now waits for enabled page controls. The Arabic check was defeated by its own English-on-every-load initializer; it now changes language through the real UI control. Final runs are green. Every run, including failed runs, executed guarded cleanup and reported zero owned containers, networks and volumes.

## Local delivery

Verified images:

- `fayq-pagination-server:20261005`: `972637dc473b91d6e66e79022ba80b0526fd22894421ba506e8cd052e0a1828e`.
- `fayq-pagination-client:20261005`: `86edbb237685227f60f3b5eb68e0969c3e8c20234313359ff1010f5fd1a243f6`.

The retained localhost:8080 preview is refreshed through `docker/ide/preview.mjs upgrade`, with its ownership guard, protected ignored PostgreSQL backup and before/after data fingerprints. Previous server/client images remain under `before-pagination-20261005` aliases. Existing database volumes, real content and DRM containers are preserved. No production deployment, milestone acceptance, commit or push is inferred.

Completed refresh evidence: protected backup created; user/wallet/purchase/subscription/course/section/lesson/media fingerprints and reached-lesson preservation unchanged. All six retained services are healthy, root/liveness/readiness return 200, compiled ADMIN routes contain paging, and an anonymous paged ADMIN request returns 401. All four DRM container IDs and clean nested revision `dd66be3` are unchanged. Final disposable resource counts are zero.
