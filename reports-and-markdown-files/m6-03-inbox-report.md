# M6 package 03 — bilingual notification inbox

Date: 2026-10-01, Africa/Cairo. Authority: D25/R17 and the owner's direct implementation assignment, followed by "continue". Implemented and verified directly in this chat. This is same-agent source review and Docker evidence; no independent reviewer or worker was dispatched. Platform HEAD remains `4b949cc394636c2df928d0b7642122da61e5301c`; the independent DRM checkout and platform gitlink remain `bad0c1df9f5d5844fe365c402fcccfee33ab6906`, with a clean DRM working tree.

## Bounded result

Package 03 supplies the private bilingual inbox on top of the package-02 API. Both authenticated roles have their own header entry and `#/notifications` route. Notices support All/Unread, explicit read/unread, sequence-fenced mark-all-read, pagination, refresh, unavailable destinations, and loading/empty/error/offline states. It follows the existing FAYQ semantic components, typography, themes and responsive shell.

Actual recharge/publication/expiry producers, physical retention cleanup, Socket.IO/Redis transport and replica/restart verification remain packages 04–05. There is no realtime connection yet. The current UI refreshes on explicit Refresh, route opening, visible-tab focus and recovery online; those mechanisms do not satisfy D25 realtime acceptance. Ordinary business actions still generate no notices. All browser notices below were synthetic verification fixtures and have been removed. M6 and M5 owner acceptance are not inferred; no commit, push or deployment occurred.

## Changes and traceability

| Files | Result | Requirements / contract |
| --- | --- | --- |
| `client/src/features/notifications/types.ts`, `api.ts` | Typed safe envelopes and cookie-based list/count/read/read-all calls through the existing API helper; mutation CSRF and one coordinated refresh retry | R13/D25; N01/N06 |
| `inbox.ts`, `context.tsx` | One transient store per authenticated owner; decimal-string revision comparison; late-request guards; bounded stale-response retry; pagination deduplication; preserve the loaded window on refresh | R13; N06/N11 |
| `components/NotificationEntry.tsx` | Authenticated bell entry, localized capped 99+ badge with the full accessible count; count failure is distinguished from zero | R08/D25; N11 |
| `pages/NotificationsPage.tsx` | Arabic/English notice copy, directionally isolated dates, text read-state indicators, visible selected-filter check, explicit controls, safe wallet/public-course targets, error Retry and focus preservation | R01/R08/R13; N11 |
| `App.tsx`, `routes.ts`, `pageTitles.ts`, `components/layout/Header.tsx`, `auth.tsx` | Mount provider/route and own header entry; final protected-request authentication failure clears the React session and private inbox | R02/R13; N01/N08 UI portion |
| `locales/ar.ts`, `locales/en.ts` | Matching notification interface translations | R01/R08 |
| `inbox.test.ts`, `docker/browser/m6-inbox.mjs`, `docker/verification/m6-inbox-ui-fixtures.cjs` | Meaningful race/failure tests and a normal-cookie Chromium journey with run-owned synthetic fixtures and cleanup | Docker rules; N06/N11 |

No platform server source, schema, API, dependency lockfile, theme tokens or external DRM files changed in this package. Previous package-02 edits remain in the working tree.

## Privacy and mutation behavior reviewed

Store replacement on account identity changes exposes a new empty state immediately; disposal invalidates pending list/count/write callbacks. React StrictMode's cleanup/remount is supported. A final 401 is handled only after the existing API helper exhausts its refresh path. Late disposed-store failures cannot log out the subsequent account.

Read changes are applied after a successful server response, never optimistically. Confirmed server read state remains visible if the following refetch fails; failed writes show an error and attempt a fresh authoritative read. Mark-all-read uses the first-page throughSequence observed by the user; newer count responses and later pages do not broaden that fence. Links do not implicitly mark notices read. Safe destinations are a static wallet route or a validated public course slug; unavailable courses have explanatory text and no link.

Notice content, cursor, counts and revisions stay in memory. No notice details or credentials enter localStorage, sessionStorage or IndexedDB. Existing language/theme preferences remain the only persistent browser UI settings. No notification create/composer/dismissal endpoint or control is introduced.

## Docker execution and image identities

All application builds, typechecking, tests and Chromium ran inside Docker. Host PowerShell inspected/edited files and orchestrated containers. The guarded `rs256-project.mjs` built and started the actual checkout; project `education-platform-rs256`, origin `http://localhost:8082`, volumes `education-platform-rs256_pgdata` and `education-platform-rs256_redisdata` were checked before fixture mutation and cleanup. The running client image matched its final build identity.

| Image | Final observed Docker identity |
| --- | --- |
| `edu-platform-client:0.5.0-m5-rs256verify` (guarded preview tag) | `sha256:6652a48540cb766ba39b622b30c9909ffa5f7d495366194df5a47e89002cd787` |
| `edu-platform-client-test:0.6.0-m6-inbox` | `sha256:437d57bd4758c244433a8a8972213192d2f3c10afeca5c84afe774ccbf7fcbcc` |
| `edu-platform-browser:0.6.0-m6-inbox` | `sha256:288ee8af0c68ff75231558c901e982c40979925cddcdf1e4975bd56a380656f6` |
| Unchanged running server | `sha256:fe344845e06fa5f50283bec671e528927650fcfccaa06ebb5480ee3b50fedca7` |

The browser image uses the existing Dockerfile and locked Puppeteer dependencies, with the new runner mounted read-only. Its build reported three inherited high dependency advisories; this package does not remediate the existing dependency debt or make a production-readiness claim.

Commands actually run (Docker directory was added to this orchestration shell's PATH):

```text
node docker/verification/rs256-project.mjs check
node docker/verification/rs256-project.mjs build
node docker/verification/rs256-project.mjs up
docker build --target test --tag edu-platform-client-test:0.6.0-m6-inbox --file client/Dockerfile .
docker run --rm edu-platform-client-test:0.6.0-m6-inbox sh -c 'npm run typecheck --silent && npm test -- --reporter=dot'
docker build --tag edu-platform-browser:0.6.0-m6-inbox --file docker/browser/Dockerfile .
docker cp docker/verification/m6-inbox-ui-fixtures.cjs education-platform-rs256-server-1:/tmp/m6-inbox-ui-fixtures.cjs
docker exec education-platform-rs256-server-1 node /tmp/m6-inbox-ui-fixtures.cjs seed
docker exec education-platform-rs256-server-1 node /tmp/m6-inbox-ui-fixtures.cjs cleanup
```

Chromium invocation used `docker run --rm --name m6-inbox-browser --label education-platform.verification=m6-03 --network education-platform-rs256_default`, the browser tag above and `node m6-inbox.mjs`. Three binds supplied the runner read-only, an ephemeral fixture receipt read-only at `/fixtures/private.json`, and the ignored run evidence directory at `/evidence`. Chromium accessed Nginx through the verified Docker Desktop host gateway on the established localhost origin. No application environment file, whole checkout or privileged Docker socket was mounted into the browser.

## Executed checks

| Verification | Result |
| --- | --- |
| Final client TypeScript check | PASS |
| Final Docker Vitest suite | 65/65, seven files; zero failures/skips |
| Existing dash.js compatibility tests | 2/2; zero failures/skips |
| Production client build through guarded wrapper | PASS |
| Real Docker Chromium inbox journey | 54/54; zero failures/skips; exit 0 |
| Four screenshot review | Arabic dark / English light, desktop 1280×900 and mobile 390×844, inspected directly |
| Targeted fixture cleanup | Three users, two courses, 106 synthetic events removed; remaining run-owned users/events verified zero |
| Final preview | Client/server/Nginx/PostgreSQL/Redis healthy; temporary browser container absent |
| Nested DRM / whitespace | DRM unchanged and clean; normal Git whitespace check passes |

The twelve new client cases cover disposal/remount and late responses/writes/401, BigInt revision ordering, filter races, a concurrent arrival beyond the read-all fence, failed writes, confirmed writes followed by failed refresh, preservation of forty loaded rows with overlap deduplication, bounded stale retries, final auth failure, count-outage recovery and safe target construction.

The browser uses supported registration/login/logout flows for two STUDENT fixtures and an explicitly internal ADMIN fixture. Its 105 own notices and one foreign notice exercise first-page size, full accessible badge count, recipient isolation, dates and title, unavailable targets, wallet-link navigation without marking read, explicit read/unread, forty-row pagination and refresh order. Test-only HTTP interception injects a refreshable 401, a write 503, a list 503 and a delayed previously captured authenticated response. These are controlled failure cases, not claims of an actual Redis outage. It proves one real coordinated refresh call followed by retry, failed-write read/count consistency, visible retry/recovery, offline/online state and rejection of an old account's late response after logging into the other account.

Four layouts verify RTL/LTR, theme and translated notice copy, no horizontal page overflow, minimum 44px control targets (fractional browser measurement tolerance 0.5px), and at least 4.5:1 computed notice text contrast. Keyboard focus reaches Refresh with a visible outline; reading the sole unread row returns focus to the selected filter. Mark-all-read, empty Unread, reopening a read notice, the ADMIN's own empty inbox, API-driven revocation and final sign-in state pass. All read writes carry CSRF; persistent storage checks and uncaught-browser-error checks pass.

There were no failed application assertions or blocked checks in this package. The client suite was first run after implementation and rerun on final source following the small heading-focus/selected-filter refinements. Before its first run, the browser helper was aligned to the existing "Log out" label and given bounded delayed-response waits. Server suites were not repeated: this package has no server changes, and package 02 already records the fresh backend gates. No external DRM/R2/media suite ran or is claimed.

## Evidence, cleanup and rollback

Sanitized check labels and four screenshots remain locally in ignored `docker/browser/evidence/m6-03/2026-10-01-m6-03-1790816670066/`. The temporary receipt contained fixture credentials only, was never printed and was removed from both the server container and the host evidence directory. The copied helper was also removed. Cleanup was restricted by a run UUID prefix; no development volume, unrelated account, financial/subscription record or external media was deleted. The preview and its owned volumes remain available.

To repeat, inspect the guard and ownership first, rebuild the client/browser images from the checkout, seed a new receipt, copy it privately, run the browser with the three narrow mounts, and execute cleanup even if the runner fails. The helper refuses an existing receipt, a different origin/database or production mode. Do not put the receipt, environment files or private evidence into Git.

Package 03 rollback is a runtime client rollback to the prior reviewed image/source, leaving package-02 storage and APIs intact. Preserve other uncommitted work; do not reset the whole checkout or remove database volumes. No schema downgrade or DRM action is needed.

## Review ruling and next package

Package 03's bounded implementation and verification pass same-agent review. Its final evidence supports the inbox interface and privacy/race behavior only. Package 04 next adds committed source producers, durable fanout/dispatch, cleanup and the architecture's Socket.IO/Redis delivery inside the existing Express application. Package 05 must verify real event, reconnect, revocation, replica/restart and retention behavior, followed by independent review and owner milestone acceptance. Production, commercial DRM and 10,000-user qualification remain outside this result.
