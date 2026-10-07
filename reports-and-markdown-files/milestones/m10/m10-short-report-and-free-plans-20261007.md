# Short reports and free course plans — 2026-10-07

Owner requested only important information in one WhatsApp message and a free option in course pricing. These clarifications authorize bounded platform changes and the local preview update. No acceptance, commit/push, production deployment or nested DRM edit.

ADMIN defaults to SHORT: one heading, student, period and per-course video/quiz/assignment summaries, with weekly activity composing into two/four weeks. Parent counts describe distinct lessons; replay counts remain for ADMIN. Unknown coverage never becomes zero. Detailed format remains selectable; duplicate first headings removed. API adds optional `format: SHORT | DETAILED`; omitted format preserves detailed compatibility. SHORT always returns one part. The browser 12,000-character encoded-URL guard is an engineering bound, not a WhatsApp guarantee. Oversized text retains the whole message through existing copy fallback, without splitting/truncation. Transient generation and fresh registered-contact/security checks remain; no external message sent during testing.

Course editor has a free checkbox and accepts zero current price. Pricing/receipts show Free/مجاني and confirmation Enroll for free/اشترك مجانًا. Zero wallet balance works: one zero-price receipt/subscription, no ledger debit or deduction. Existing duration/end/idempotency/concurrency checks remain. Packages/recharges remain positive. Migration `20261007130000_free_course_plans` widens only plan current-price and purchase snapshot constraints; ledger positivity unchanged. Retained preview applied 26/26 migrations after private backup; existing/demo data preserved.

Verification:

- Docker backend 53/53: parent reports 24, wallet purchase 16, catalog validation 9, report text 4; source/test typechecks passed. Includes SHORT ar/en, invalid format, zero-balance enrollment, exact retry, concurrent keys, paid regressions.
- Docker frontend 70/70: parent reports 64, academic model 6; typecheck passed. Final client/server builds passed after editable zero-price input correction; existing chunk warning non-blocking.
- Actual rebuilt retained server: six demo reports, active/quiet students × WEEK/TWO_WEEKS/FOUR_WEEKS; each one part/heading, no footer, 412–862 characters, encoded lengths 1,967–4,110. Probe printed lengths only.
- Updated retained migrate/server/client, restarted existing nginx; homepage/API readiness HTTP 200 at localhost:8080. Database/cache/grading/external DRM preserved.
- Owned `m10-short-report-test` cleaned after exact labels/mounts/exclusive-volume-user checks: two containers, network, named PostgreSQL and anonymous Redis volumes removed; zero owned resources remain. Reusable images/private evidence/preview preserved.

Docker runtime/migrate/client builds, Docker-contained Vitest/typechecks with current sources, real migrations via agent-2 compose and guarded dev/local/M10 preview compose were used. No host dependency installation/development server. Private ignored backup/probe: `docker/browser/evidence/m10-preview-20261007/platform-before-free.dump` and `verify-short.cjs`.

Recovery: preserve backup/new free enrollment data and exact retained-volume overrides; use compatible application images. Do not delete applied migrations or tighten checks over zero-price rows. Widened checks can remain during recovery; older paid-only UI requires compatibility with free receipts.
