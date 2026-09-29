# M4 implementation report — wallet, manual recharge, purchase, and UI/UX improvement

Date: 2026-09-29. Scope: Milestone 4 (WP4 + D22 theme) only. M1 accepted at
`fce352f`, M2 at `b8080a8`, M3 + DRM prerequisites accepted 2026-09-29 per
decisions.md. No commit, push, deployment, production-readiness, or capacity
claim. No live R2 evidence. All changes left uncommitted for independent
manager review.

## 1. Starting revisions and repository status

| Repository | Starting revision | Ending revision | Working tree |
| --- | --- | --- | --- |
| Platform (`education-platform`, branch `main`) | `d04f3ee` (docs: approve M4 wallet and UI policies; ahead of `origin/main` `bad064f` by local checkpoints, never pushed) | `d04f3ee`, unchanged | M4 work only, uncommitted (see §2) |
| Nested DRM (`education-drm-service/`, branch `main`) | `5293917` (ahead of `origin/main` `6e1e01c` by local commit, never pushed) | `5293917`, unchanged | Clean — **not edited in this assignment** |
| Platform gitlink | `5293917` | `5293917` | Matches nested HEAD |

- Docker Engine `29.6.2`, Compose `v5.3.1`.
- Dev stack (`docker-*`) and test stack (`education-platform-test-*`) healthy
  before, during (except deliberate restarts), and after the work.
- `.env` ignored and never overwritten. No paid services provisioned.

## 2. Every changed path

Server (new `server/src/modules/wallet/`, all ≤155 lines):

- `types.ts` (39) — channel/status/view/input types, `TxClient`.
- `errors.ts` (19) — frontend-safe codes + amount/proof/retention bounds.
- `money.ts` (32) — integer-piastres, string, idempotency-key, reference validation.
- `proof.ts` (72) — extension/MIME pairing, magic bytes + structure, 5 MiB
  double-gate, SHA-256.
- `ledger.ts` (52) — lock-ordered wallet access, entry posting, reconciliation.
- `recharge/service.ts` (155) — submit (idempotency gate first) + atomic review.
- `recharge/queries.ts` (72) — student/admin reads, proof bytes.
- `purchase/service.ts` (131) — idempotent transactional purchase + renewal math.
- `cleanup/service.ts` (39) — replica-safe 180-day proof-byte cleanup.
- `routes/student.ts` (117), `routes/admin.ts` (76), `routes/auth.ts` (7), `index.ts` (17).

Server modified: `prisma/schema.prisma` (M4 models), `src/app.ts` (module
mount), `src/config.ts` (+68: `PAYMENT_CHANNELS` parsing), `src/middleware/
errorHandler.ts` (+22: body-parser 413/400 mapping), `src/../package.json`
(0.4.0), unit fixtures `health/logging.test.ts` (+1 each: `paymentChannels`).

Migration (additive only): `prisma/migrations/20260930120000_m4_wallet/`.

Client (new `features/wallet/`, `features/purchase/`, ≤193 lines):

- `theme.tsx` (43), `utils.ts` (18, idempotency keys with insecure-context fallback).
- wallet `types/models.ts` (40, incl. integer `formatEgp`), `api/client.ts` (61),
  `hooks/useWallet.ts` (44), `components/Money.tsx` (7),
  `components/RequestStatus.tsx` (20), `pages/WalletPage.tsx` (74),
  `pages/RechargePage.tsx` (193), `pages/AdminRechargePage.tsx` (155).
- purchase `types/models.ts` (19), `api/client.ts` (20),
  `pages/PurchasePage.tsx` (163), `pages/PurchaseHistoryPage.tsx` (49).

Client modified: `index.html` (pre-paint theme script), `styles.css` (D22
token roles), `tailwind.config.js` (CSS-var tokens), `App.tsx` (routes +
`ThemeProvider`), `routes.ts` (5 routes), `components/layout/Header.tsx`
(wallet/admin-recharge nav + theme toggle), `components/ui/Dialog.tsx` (+
reusable `Dialog` shell), `features/catalog/pages/OfferPage.tsx` (subscribe
link), `locales/{ar,en}.ts` (~70 strings each), `package.json` +
`package-lock.json` (0.4.0).

Docker/harness: `compose.dev.yml` (`0.4.0-m4` tags + `PAYMENT_CHANNELS`
server wiring), `compose.test.yml` (`0.4.0-m4` tags), `docker/browser/
run.mjs` (M4 §19, storage assertions now allow the namespaced theme key),
`docker/browser/fixtures/receipt.jpg` (13-byte valid JPEG proof fixture),
`.env.example` (`SERVICE_VERSION 0.4.0-m4` + `PAYMENT_CHANNELS` docs).

Tests: unit `wallet-{money,proof,config}.test.ts` (15); integration
`wallet-{helpers,recharge,review,purchase,proof-cleanup}.test.ts` (30).

Evidence: `m3-evidence/m4-{wallet-dark,wallet-light,receipt}-ar.png` (the
mounted evidence dir regenerated M3 PNGs during runs; they were restored via
`git checkout` so only the 3 new M4 files remain).

## 3. Approved policy used (D04, D05, D14, D21, D22)

- Channels InstaPay/bank/mobile-wallet; receiving identifiers + localized
  instructions are `PAYMENT_CHANNELS` runtime config, absent = 503
  `PAYMENT_UNCONFIGURED`, malformed = fail-closed startup.
- Integer-minor-unit EGP; reference globally unique per channel
  (case/space/dash-insensitive normalization).
- Only ADMIN opens/downloads proof; student sees filename/status/deletion
  date; bytes cleared 180 days after review, metadata + audits retained.
- Rejection requires reason, immutable; resubmission = new request.
- No refunds/reversals/correction credits (absent by construction; verified).
- Integer-day durations; price/duration/plan/course snapshotted per purchase;
  active renewal extends expiry, expired starts immediately.

## 4. Schema design

`Wallet(userId unique, balancePiastres Int cache)` + append-only
`WalletLedgerEntry` with `@@unique([refType, refId])` exactly-once guard;
`RechargeRequest` with `@@unique([channel, referenceNorm])` and
`@@unique([studentId, idempotencyKey])`; `RechargeProof(requestId PK,
bytes Bytes? …)` separated from metadata; `Purchase` with
`@@unique([studentId, idempotencyKey])` and FK-free snapshot columns;
`Subscription` with `purchaseId unique` (one row per purchase; effective
access is the union). `User` gained back-references only. Int piastres
(max ~21.47M EGP per value; recharge capped at 1M EGP) avoid bigint/JSON
friction, consistent with plan prices.

## 5. Transaction, lock, and idempotency design

- Deterministic lock order everywhere: wallet row → ledger → purchase →
  subscription. `lockWallet` returns the **post-lock** row (a pre-lock read
  caused a reproduced overspend: 4/4 parallel purchases succeeded; fixed and
  re-proven deterministic 1+3).
- Recharge submit checks `(studentId, idempotencyKey)` **before** insert
  (identical replay returns the row; reused key with different params is a
  409); `(channel, referenceNorm)` P2002 is then genuinely a duplicate.
- Review uses atomic `updateMany(status=PENDING)` compare-and-set; losers get
  409 `ALREADY_REVIEWED`. Credit posts under the wallet lock with the unique
  ledger ref as second guard; the credited amount is the **stored** amount.
- Purchase: replay gate → trusted plan snapshot (PUBLISHED course required)
  → wallet lock → balance check → debit → purchase → subscription in one tx.
  Failed txs leave nothing (proven: 0 purchases/subscriptions on 402).
- No database transaction spans external I/O (M4 has no external calls;
  proof validation is CPU-only on the already-received body).
- Cleanup is compare-and-set per row (`bytes NOT NULL` guard) + audit; safe
  under concurrency and reruns.

## 6. Route/auth/CSRF matrix

| Method & path | Guards | Notes |
|---|---|---|
| GET `/wallet/` | auth | Balance (server-computed) |
| GET `/wallet/reconcile` | auth | cached vs ledger sum + match flag |
| GET `/wallet/instructions` | auth | 503 when unconfigured |
| POST `/wallet/recharge-requests` | origin, auth, session CSRF, rate-limit; 8 MB route body cap | 201; idempotent |
| GET `/wallet/recharge-requests[/:id]` | auth | owner-only 404; no bytes |
| POST `/wallet/purchases` | origin, auth, session CSRF, rate-limit | 201; 402 funds; 409 conflict |
| GET `/wallet/purchases`, `/wallet/subscriptions` | auth | owner-only |
| GET `/admin/recharge-requests[?status]` | auth, ADMIN | no bytes |
| POST `/admin/recharge-requests/:id/review` | origin, auth, ADMIN, session CSRF, rate-limit | 409 when settled |
| GET `/admin/recharge-requests/:id/proof` | auth, ADMIN | bytes + safe headers; 404 after cleanup |
| POST `/admin/maintenance/proof-cleanup` | origin, auth, ADMIN, session CSRF, rate-limit | returns examined/cleared |

Reads omit origin (browsers may not send it on GET — same rule as catalog).
Writes require origin + session CSRF. Proof never leaves the admin router.

## 7. Recharge and purchase state matrices

Recharge: `PENDING → APPROVED` (credit once, never auto-purchase) |
`PENDING → REJECTED(reason, immutable)` | any settled + review → 409 |
same key + same params → same row | same key + different params → 409.
Purchase: `402` before any write on short funds | success = 1 debit + 1
purchase + 1 subscription, all-or-nothing | same key + same plan → same
receipt | same key + different plan → 409 | renewal base = max(latest
expiry, now).

## 8. Proof-storage and retention design

Base64-in-JSON (bounded 8 MB route cap; global 256 kb intact elsewhere) →
wire-length gate → decode → byte-length gate → extension/MIME pairing →
magic bytes + minimal structure (JPEG SOI/EOI, PNG sig+IHDR+IEND, PDF
`%PDF-`+`%%EOF`) → SHA-256 → `BYTEA` in `RechargeProof`, metadata on the
request. Served only to ADMIN with `Content-Type` + `nosniff` +
`private, no-store`. Cleanup clears `bytes` (compare-and-set) 180 days after
review; filename/hash/size/audits retained. No container-local files, no new
storage service.

## 9. UI route, state, and component inventory

Routes `#/wallet` (summary/instructions/history), `#/wallet/recharge`
(validated form + file input), `#/purchases` (history), `#/purchase/:planId`
(review → confirm → receipt / insufficient → recharge), `#/admin/recharge`
(filterable queue + review dialog + proof preview). Every route: one `<main>`
+ one `<h1>`; loading/empty/filtered-empty/validation/forbidden/conflict/
retry/success states; 44px targets; logical-direction utilities; dialogs
with initial focus + Escape; duplicate-submit guards; Arabic RTL primary,
English LTR complete.

## 10. Dark/light theme evidence

Dark default (navy `#0B1626`/`#111F33`/`#182941`, never black), light
alternative, keyboard-accessible header toggle (`aria-pressed`), persisted
`edu-platform-theme` only, pre-paint inline script (no flash), CSS-variable
semantic tokens (`canvas/surface/elevated/text/muted/border/primary/accent/
focus/success/pending/error`) consumed by Tailwind. Browser-measured body
contrast: dark **15.43**, light **13.14** (AA ≥ 4.5). Screenshots
`m4-wallet-dark-ar.png`, `m4-wallet-light-ar.png`, `m4-receipt-ar.png`.
Storage audit allows exactly `edu-platform-lang` + `edu-platform-theme`.

## 11. Measured production-file line counts

Largest new files: `RechargePage.tsx` 193, `recharge/service.ts` 155,
`AdminRechargePage.tsx` 155, `purchase/service.ts` 131,
`routes/student.ts` 117. All new production files ≤193 lines; two files
were split during the work to respect the 200-line target
(`recharge/queries.ts`, `PurchaseHistoryPage.tsx`). No god files; no `any`
in new server code (narrow test-helper casts only, matching repo convention).

## 12. Exact Docker evidence and regression counts

Images (`:0.4.0-m4`): server-test `c566f5a0d`, migrate-test `5f5bcfbdb`,
client `d013f1e72`, browser `39b7c146a`, server `e7cae80f392` (M3 build;
dev server rebuilt to `0.4.0-m4` for the upgrade check), nginx `a30cc5c308d`,
drm-fixture `6fd1a39af`.

| Suite | Result |
|---|---|
| Unit (16 files: M3 76 + wallet 15) | **91/91 PASS** |
| Integration (24 files: M3 110 + wallet 30) | **140/140 PASS** (one transient 139/140, green on 3 consecutive reruns; recorded, unidentified) |
| Browser through Nginx (M3 58 + M4 23) | **81/81 PASS** |
| Typecheck (`tsc --noEmit` app + tests) | exit 0 |
| Fresh M1→M4 migration (disposable) | 5 applied, PASS (in-suite) |
| Dev M3→M4 upgrade (normal restart, no `-v`) | 5 rows, data preserved, `/health/ready` 200 |
| Migration failure (bad URL) | exit 1 |
| `git diff --check` | clean (CRLF notices only) |
| Server audit | 4 high (`deepmerge-ts→prisma`, no fix) — unchanged from M3 |
| Client audit | 1 high (`postcss`, pinned; build-time only) — unchanged from M3 |
| Bundle secret scan | 0 hits |
| Runtime server image | uid 999, no tests/src, no secret env, redaction present |

Browser M4 row (23 new): dark default + AA 15.43, toggle, light + AA 13.14,
reload persistence, sign-in, balance, proof input, submit, zero-credit,
proof 403, queue shows request, dialog focus/approve/Escape, exact 60000
credit, plan available, trusted price, receipt, exact debit, 2× mobile
overflow, storage prefs, bundle secrets.

Two environment incidents (not code defects, zero code changes to resolve):
stale-container `ALLOWED_ORIGINS` 403 and missing `PAYMENT_CHANNELS` wiring
(the latter required adding the `${PAYMENT_CHANNELS:-}` mapping to
`compose.dev.yml` server env — counted as an M4 infra fix).

## 13. Security, secret, dependency, and migration evidence

Auth/ownership/role/CSRF/origin boundaries covered by integration + browser
(student review attempts 401/403, cross-user 404, proof 403, anon mutation
401). No auth/session tokens in storage or bundles (browser asserts keys +
values). Audits sanitized (no base64/bytes; verified by assertion).
`PAYMENT_CHANNELS` malformed/duplicate/unknown entries fail startup closed;
absent = explicit 503. Migrations additive only; dev volumes never `down -v`.

## 14. Runtime-image evidence

Server runtime uid 999, no `tests/`/`src/`, no secret env; client Nginx serves
only built assets; redaction (`[Redacted]`) present in logging paths.

## 15. Responsive and accessibility evidence

390px `overflow=0` on register/catalog/wallet/recharge (browser-measured);
keyboard-operable dialogs with focus + Escape; visible focus ring via
`--color-focus`; status never color-only (icon + text); reduced-motion
preserved; EGP/ج.م + `ar-EG`/`en-US` dates localized.

## 16. Remaining blockers

`BLOCKED — live Cloudflare R2 and real external DRM upload/deletion
verification could not be performed because the required DRM endpoint,
application credentials, and R2-backed external configuration were not
supplied.`

M4 adds no live dependency: payment destinations are deployment config
(tested with labeled fixture values), and no M4 path calls an external
service. No refunds/reversals exist by design (D21). No capacity claim.

## 17. Honest rollback instructions

1. Stop: `docker compose --env-file .env -f docker/compose.dev.yml down`
   (without `-v`).
2. Redeploy `:0.3.0-m3` images or set `SERVICE_VERSION=0.3.0-m3`; `up -d`.
3. Database: the M4 migration is additive; M3 code ignores the new tables.
   Do not `migrate reset` or `down -v` dev. Full schema revert needs a
   pre-M4 backup (owner recovery objectives; none taken here).
4. Verify `/health/ready` and M3 suites (76/110/58).
5. Nothing was committed or pushed; discard the worktree to abandon M4.

## 18. Handoff

M4 implementation uncommitted at platform HEAD `d04f3ee` (nested `5293917`
untouched), no push/deploy/PR, no dev-volume removal, disposable projects
removed. Two evidence-backed defects were found and fixed during the work
(stale pre-lock wallet read → proven overspend; insecure-context
`crypto.getRandomValues` crash); both are covered by deterministic
regressions. M4 is **not** declared accepted — the manager reviews the diff
and reproduces the financial, browser, migration, retention, theme, and
security tests before acceptance.
