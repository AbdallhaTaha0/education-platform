# M7 package 02 — bounded PostCSS security update report

Date: 2026-10-01. Worker package: `reports-and-markdown-files/m7-02-open-code-worker-prompt.md`.
Scope: update the client's directly pinned PostCSS `8.4.49` → exactly `8.5.28` (same-major
registry fix from the M7-01 audit) and verify the affected graph, build and rendered UI in
Docker. No Prisma/Vitest/Vite/React/dash.js/server changes, no DRM edits, no commits/pushes,
no production deployment, no external load, no capacity claim. This report claims no
independent or owner acceptance; M7 acceptance remains a future gate.

Subsequent disposition: [manager review](m7-02-manager-review.md) reproduced the build, audit, 72 tests, 68 browser checks and eight screenshots, tightened the verification-only stability wait and verified a failing contrast negative control. Package 02 is accepted for its bounded scope; owner M7/production acceptance remains open. Original worker evidence below retains its timing-failure history.

Baseline: platform `31ca60d3a2d832b704423060f3d55da7eae65ee3` (still HEAD, `0 0` vs
`origin/main`); pre-existing uncommitted M7-01 report/review/prompt/index changes preserved
and untouched. DRM gitlink and checkout remain `bad0c1df9f5d5844fe365c402fcccfee33ab6906`,
clean, read-only.

## 1. Changed-file list

- `client/package.json` — one line: `"postcss": "8.4.49"` → `"postcss": "8.5.28"` (exact pin kept).
- `client/package-lock.json` — PostCSS and its necessary transitive closure only (three logical nodes, four textual diff hunks, §2).
- `docker/verification/compose.m7-02-postcss.yml` (new) — one-service override pointing only
  the `client` service at the newly built runtime image; used with the private
  `compose.m6-delivery-browser.yml` base under project `m7-02-postcss`.
- `docker/browser/m7-02-postcss.mjs` (new) — bounded Chromium matrix (8 language/theme/width
  combos, inbox/read controls, cookie login, stylesheet/keyboard/storage checks) with
  internal-nginx resolution; no host ports, no preview access.
- `docker/browser/m7-02-contrast-probe.mjs` (new) — one-off diagnostic that dumps per-element
  contrast inputs for the first inbox card; used to disposition the transient check in §7.
- `reports-and-markdown-files/m7-02-postcss-report.md` (this file) + its README index row.

Unchanged as required: `server/` (any file), `client/src/`, `client/Dockerfile`,
`postcss.config.js`, `tailwind.config.js`, `vite.config.ts`, dash.js pin/patch/tests,
migrations, Compose files (except the new override), DRM, gitlink.

## 2. Exact manifest/dependency diff

`git diff client/package.json`: only the pin line above.

`git diff client/package-lock.json` (three logical nodes across four textual hunks, no other packages touched):

1. `packages[""].devDependencies.postcss`: `8.4.49` → `8.5.28` (manifest mirror).
2. `node_modules/postcss`: `8.5.28`, `resolved`
   `https://registry.npmjs.org/postcss/-/postcss-8.5.28.tgz`, `integrity`
   `sha512-RRuzqDtt5Y9h3quz5hWhK+TPnsmVs6WwSU6LkJMeY4HstUEDuYTG8UJSdawMRzmzAtV+KEoG8N3Qg2qLy5vM/A==`
   — byte-matches the registry metadata (§3). Its declared range `nanoid ^3.3.7` →
   `^3.3.18` is upstream 8.5.28's own floor; the resolved `nanoid` version already
   satisfies it, so no nanoid entry changed.
3. Removed `node_modules/vite/node_modules/postcss` (nested duplicate `8.5.28` that existed
   only because top-level `8.4.49` no longer satisfied vite `6.4.3`'s `^8.5.3` range).
   With top-level at `8.5.28`, npm deduped to a single instance — a necessary resolution
   closure change, not drift.

Verification: `Select-String '"8.4.49"' client/package-lock.json` returns nothing; every
remaining `postcss` range dependent (tailwind `^8.1.0`, autoprefixer `^8.0.0`,
`postcss-nested ^8.4.21`, vite `^8.5.3`, etc.) is satisfied by the single `8.5.28`.
`npm install --save-dev --save-exact --package-lock-only --ignore-scripts postcss@8.5.28`
was used; `npm audit fix --force` was not. No unrelated version moved.

Lockfile identity: before `package-lock.json` SHA256
`60A7F0FB167D3CC7FF4A354DAFD8987D89300CFBD36A3D3EA97D5036A074F582` (128,492 bytes);
after SHA256 `DB82ABABEE43B23317EB54B1B607CCF8E0CD87D0C0A4B31103124202E463C0C3`.
`package.json` after SHA256 `329C342E48925EB6337FB1AC8993684B9D3B200A514163F068F7FA0A6D785F40`.

## 3. Registry metadata check (Docker, before editing)

`docker run --rm --pull=never --name m7-02-meta node:22-bookworm-slim sh -c
"npm view postcss@8.5.28 version engines dependencies dist.integrity --json"` →
`version 8.5.28`, `engines { node: ^10 || ^12 || >=14 }` (covers the project's Node 22),
`dependencies { nanoid ^3.3.18, picocolors ^1.1.1, source-map-js ^1.2.1 }`,
`dist.integrity sha512-RRuz…A==` (matches the lockfile hunk). Exit 0.

## 4. Before/after audit (isolated Docker, read-only mounts)

Baseline (changed-checkout pre-edit state matches M7-01 expectation):
`docker run --rm --pull=never --name m7-02-baseline-audit -v "${PWD}/client:/audit:ro" -w /audit
node:22-bookworm-slim sh -c 'npm audit --audit-level=low --json'` → 3 entries, 1 high /
2 moderate: PostCSS high rollup (GHSA-6g55-p6wh-862q file-read CVSS 7.5, GHSA-r28c-9q8g-f849
traversal CVSS 7.5, GHSA-fxqj-rqcc-2cmp + GHSA-qx2v-qp2m-jg93 moderate) on `postcss 8.4.49`
with fix `8.5.28` non-major; two vitest/`@vitest/mocker` moderates (GHSA-82fw-gwwq-j7x9)
with fix `vitest 5.0.3` major. Exit 1 (findings), no tool failure.

After (same command shape, `--name m7-02-reaudit`, on the edited checkout) → 2 entries,
0 high / 2 moderate / 0 critical: the PostCSS entry is gone; only the explicitly deferred
vitest/mocker moderates remain (fix still `vitest 5.0.3`, `isSemVerMajor: true`, out of
scope per the package). Dependency totals moved 257 → 256 (dev 219 → 218) exactly because
the nested vite-scoped postcss duplicate was deduped. No newly introduced finding, and the
result is not presented as a clean full audit.

`npm ls postcss --all` inside the built test image: single `postcss@8.5.28`, every consumer
(autoprefixer, tailwind chain, vite) `deduped`. Exit 0.

## 5. Images (built from the changed checkout through `client/Dockerfile`)

- Test: `edu-platform-client-test:0.7.0-m7-02-postcss`, manifest list
  `sha256:5abd370276b468c7b6394adac9abc6eb816594786e5a76b7614622c3008ac727`.
  Clean `npm ci` ran inside Docker and exercised the guarded dash.js postinstall
  (`dash.js remote ClearKey compatibility verified`); install-time audit already showed
  only the 2 deferred moderates. Host npm was never used for installs/builds/tests.
- Runtime: `edu-platform-client:0.7.0-m7-02-postcss`, manifest list
  `sha256:1a67000a5858743b87717374866524f37bfc82e600040a89619ac98a539e8edd`
  (config `sha256:1dcda1fd0f087e70d17a6feaec1625b6150aac6c7509b5be2e04d06871852233`).
  `npm run build` (`tsc -b && vite build`) succeeded in-image: 140 modules, `dist/index.html`
  plus `assets/index-DpzOW-wN.css` (29.13 kB) and `assets/index-3JsyFGF4.js`, exit 0.
- dash.js guard intact: `dashjs 5.2.1` unchanged; `postinstall` + `patch-dashjs.test.mjs`
  both ran green (§6). No CSS token, source, or config file changed.

Served-bundle smoke from the NEW runtime image (standalone, no ports):
`docker run -d --name m7-02-smoke edu-platform-client:0.7.0-m7-02-postcss`, then
`docker exec m7-02-smoke wget -q -O - http://127.0.0.1:8080/` returned the FAYQ shell
(`FAYQ — تعلمها. برمجها. حققها.`) with `/assets/index-3JsyFGF4.js` +
`/assets/index-DpzOW-wN.css`; container image `sha256:1a67000a…` (the new manifest).
Container removed afterwards.

Byte-identity note (why no visual drift is expected): the built CSS and JS were extracted
from the new and the previous (`0.5.0-m5-rs256verify`, postcss 8.4.49) runtime images via
`docker create` + `docker cp` and hashed on the host. CSS SHA256 `B2190B96…BBED` both;
JS SHA256 `0A973EAD…D893` both. The security fixes change no output for this input.

## 6. Typecheck, unit, compatibility (all inside the new test image)

- `npm run typecheck --silent` (`tsc -b`) → exit 0, no output.
- `npm test --silent` (`node --test scripts/patch-dashjs.test.mjs && vitest run`) → exit 0:
  dash.js compatibility 2/2 (remote-binary-cenc behavior + unknown-version/signature
  fail-closed), vitest 8 files / 70 tests passed (player requests/errors/state/session/
  watermark, notifications realtime/inbox, brand). No test was rewritten.

## 7. Disposable Chromium matrix (project `m7-02-postcss`, no public ports)

Stack: `docker compose -p m7-02-postcss -f
docker/verification/compose.m6-delivery-browser.yml -f
docker/verification/compose.m7-02-postcss.yml`. Resolved config before startup showed
project `m7-02-postcss`, network `m7-02-postcss_default`, volume `m7-02-postcss_pgdata`
only (no `docker_*`/existing names), no `ports:` entries, client = the new `0.7.0-m7-02`
image, server/migrate = `0.5.0-m5-rs256verify` (identical to the preview's server;
server code is untouched in this package). `up -d --wait`: postgres/redis/server/client/
nginx healthy, migrate exited 0. Disposable client container image digest
`sha256:1a67000a…` equals the newly built manifest — the browser reached the new image,
not the older preview (which stayed up, healthy, and untouched throughout).

Fixtures (run-owned, labelled): `m6-inbox-ui-fixtures.cjs seed` ran in the verified server
image on the disposable network (real register-API for 2 students, direct ADMIN row,
real notification-store materialization): `students=2, admin=1, courses=2, synthetic
notices=106` (`m6-ui:<run>:` keys). Receipt stayed in an ignored TEMP dir; only shapes
(3 users, 105 own + 1 foreign) were recorded, never credential values. These fixtures
prove rendering only — not external playback or real bank receipt.

Browser (`edu-platform-browser:0.6.0-m6-inbox` image reused read-only, overridden
entrypoint `node m7-02-postcss.mjs`, internal `nginx` DNS resolution, origin
`http://localhost:8082` matching `ALLOWED_ORIGINS`):
final run `M7-02 BROWSER: passed=68, failed=0, skipped=0`, exit 0. Coverage: anonymous
sign-in prompt + Arabic default; cookie login (email + password) as fixture student;
20 first-page rows with exact unread count 105; same-origin stylesheets all HTTP 200;
wallet-target navigation without implicit mark-read; all 8 combos
(ar/en × dark/light × 1280/≈390px) each asserting lang/dir/theme state, header
navigation, applied stylesheet, no overflow (`scrollWidth <= innerWidth + 1`), translated
notice copy, ≥44px touch targets, and ≥4.5 text contrast; keyboard Tab reaching Refresh
with a ≥2px visible focus outline; explicit mark-read (105→104) / mark-unread (→105) /
mark-all-read (→0); persistent-storage check (only `edu-platform-lang`/`-theme`, no
session/IDB); zero page errors and zero failed requests.

Transient contrast timing (reported, not hidden): two pre-fix runs each failed exactly one
`text contrast` check on different combos (`desktop-ar-dark`, then `mobile-en-dark`) while
all other checks passed. Served bytes are proven identical old-vs-new (§5), and the
contrast probe (fresh desktop ar-dark load) measured ratios 15.1/8.78/12.6 — all passing
with exact FAYQ dark tokens. Root cause is harness timing: the check sampled computed
colors mid language+theme re-render. Fix kept the 4.5 bar unchanged and added a
`settlePaint()` repaint-stability wait (identical consecutive computed-style samples
before asserting). The final 68/68 run includes all previously failing combos.

Screenshots (ignored TEMP evidence, visually inspected — FAYQ dark/light, RTL/LTR,
single-column mobile, populated inbox, no broken layout or missing styles):
`C:\Users\pc\AppData\Local\Temp\m7-02-run\evidence\m7-02-{desktop,mobile}-{ar,en}-{dark,light}.png`
(8 files) plus `m7-02-checks.json` (68 entries). Desktop dark/light Arabic show the
forest/cream themes with unread count 105 and 99+ badge; English mirrors LTR; mobile
shots stack cleanly with no overflow.

Skips/blocks: full server, money, crash/failover and DRM suites were not rerun — a
client build-tool-only change with byte-identical output and green client/browser
evidence gave no trigger, per the package. No live DRM/media operation was performed.

## 8. Requirement mapping

- R10 (Docker throughout): every install, build, typecheck, test, audit, fixture, and
  browser step ran in Docker (unique `m7-02-*` names/tags); host Node/npm performed no
  install/build/test.
- R11 (preserve architecture): one Express app, same server/migrate images as the
  preview, no service/infra substitution; only a same-major build-tool pin moved.
- R13 (cookie identity): browser used the supported email+password cookie login, session
  CSRF-protected read writes; no session-revocation test is claimed here. Storage holds only lang/theme
  prefs, never auth tokens.
- D22/FAYQ: semantic tokens and theme behavior untouched; all 8 screenshots confirm the
  approved dark-default/light-alternative identity in both languages and widths.
- D25/R17: inbox list/count/read/mark-all-read/filters verified against labelled
  synthetic fixtures through real store/API paths; no producer, retention, or realtime
  claim beyond the rendered controls.

## 9. Cleanup (ownership-verified)

- Fixture cleanup in the disposable DB: `users=3, courses=2, events=54`, receipt unlinked.
- Guard re-resolved (`m7-02-postcss_default`, `m7-02-postcss_pgdata` only) then `down -v`:
  all six run containers, the network, and the volume removed; `docker ps -a`,
  `volume ls`, `network ls` show only the pre-existing `education-platform-rs256-*`
  resources (all still healthy, same uptimes). No `m7-02-*` container, network or volume
  remains; built image tags are retained as evidence. No global prune, no
  existing-volume deletion, no preview mutation.
- DRM checkout re-verified clean at the pin; `git status` shows only the intended
  package changes (§1). TEMP comparison copies removed; evidence PNGs/checks.json kept
  at the ignored path above for manager inspection.

## 10. Rollback

Revert the manifest pin and four lockfile diff hunks covering the three logical nodes
in §2, then rebuild `edu-platform-client[-test]:0.7.0-m7-02-postcss` — or simply keep
using the previous `0.5.0-m5-rs256verify` client image, whose served assets are proven
byte-identical. No database rollback, migration, or external media repair is involved
(disposable database was destroyed; preview data untouched).

No production deployment and no 10,000-user capacity claim are made in this package.
