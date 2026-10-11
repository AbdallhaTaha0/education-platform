# Current release: IDE suspended, multiple-choice quizzes retained

Owner approved temporarily disabling the IDE throughout the platform on
2026-10-07, explicitly retaining multiple-choice quizzes. This is a release
configuration change, not removal of the feature or its stored data.

## Behavior

- `CODING_IDE_ENABLED` defaults to `false`; only explicit `true` enables coding.
  Invalid values fail startup. `/api/features` publishes only the safe capability.
  React defaults to disabled until that backend response arrives, including SSR.
- Student practice, JavaScript/web/Python coding assessments, mixed coding/choice
  assessments, Python previews, admin allowance controls and test preparation
  are unavailable. Direct authenticated requests return `503 IDE_DISABLED`;
  authentication, roles and CSRF remain enforced.
- Navigation, account shortcuts, help links and admin authoring controls follow
  the same backend setting. Direct IDE routes show an Arabic/English notice.
  New assessments default to multiple choice, with coding types unavailable.
- Choice-only assessments remain available regardless of their historic IDE
  mode label. Answers are marked privately in the Express backend transaction,
  with idempotency, immutable published versions and one earned-pass record.
  Wrong answers permit retries. No Docker process, grading queue or execution
  host is needed for this flow. Private answer keys never enter student payloads.
- Already accepted pending/running choice submissions finish during authorized
  result polling. The transaction replaces the legacy lease safely and releases
  the existing admission counter. Suspended coding submissions remain intact.
- Required coding assessments do not lock later lessons while disabled.
  Required choice quizzes still lock progression until passed. Classification
  uses the immutable published version, not an edited administrator draft.
  No artificial passes or permanent unlocks are created by the switch.
- The grading controller refuses to start when disabled. Its local Compose
  service is now in the explicit `coding-ide` profile. Existing drafts, source,
  assessment versions, allowance settings, submissions and passes are retained.

No database migration, DRM modification, production deployment or commit/push
is included. The existing production `runsc` safeguard remains unchanged.
Railway preparation explicitly sets `CODING_IDE_ENABLED=false`; its execution
host compatibility blocker is therefore outside this release's enabled scope.
Other deployment/security/recovery/capacity gates remain in force.

## Verification and local preview

- Server verification: 598 unit tests and 25 integration tests passed (623
  total), including 9 disabled-release cases and the 16 existing M9 cases.
  After the final route guards, all 334 affected checks passed again.
  Server and test TypeScript checks passed.
- Client verification: all 291 unit tests and 10 tooling checks passed.
  Matching server/migration/client production images built successfully;
  Prisma construction and runtime dependencies passed the build smoke checks.
- Real Chromium through isolated Nginx: 11/11 checks passed. Student/admin IDE
  links and direct routes are disabled, choice quizzes show wrong/correct
  feedback without a grading service, required coding is hidden, and admin
  authoring offers multiple choice without coding preparation controls. No
  browser runtime errors were observed. React review confirmed fail-closed
  capability loading, effect cleanup and unconditional hooks; the IDE stays lazy.
- Verification corrected synthetic fixture constraints and test typing, browser
  viewport/language setup and matching SSR/client builds. The browser also
  found an overlooked student account IDE shortcut; it is now gated, as is the
  legacy account shortcut, and the final browser run passed.
- Owner preview is refreshed at `http://localhost:8080`: server, client, Nginx,
  PostgreSQL and Redis are healthy; migration exited 0; readiness returns 200
  and `/api/features` reports `codingIdeEnabled:false`. The previous grading
  container is stopped and is excluded from normal startup by its profile.
  Preview database/cache volumes were retained; no private environment values
  were changed. The independent DRM repository remains clean and untouched.
- Final cleanup removed only `fayq-ide-off-test`: zero matching containers,
  networks or owned volumes remain, including its anonymous Redis volume and
  all synthetic fixtures. No global pruning or preview data deletion occurred.
  Changes remain uncommitted; nothing was pushed or deployed.

## Reproduce safely

Use project `fayq-ide-off-test` with `docker/compose.test.yml` and
`docker/verification/compose.ide-disabled.yml`. Before creating or removing
resources, verify that the resolved project matches, `pgdata-test` resolves to
`fayq-ide-off-test_pgdata-test`, is not external, and no development volume is
attached. This stack publishes no host ports and has no Docker socket mount.

1. Build `test`, `migrate`, `client-test`; start `migrate` and `redis`.
2. Run the test service with `LOG_LEVEL=fatal` and:
   `npx vitest run tests/unit tests/integration/ide-disabled.test.ts tests/integration/m9-assessments.test.ts`.
3. Run `npm run typecheck` in the test service; run `client-test`.
4. Add `docker/verification/compose.ide-disabled-browser.yml`, build `client`,
   run the server image with `ide-disabled-seed.cjs` mounted read-only at
   `/srv/server/ide-disabled-seed.cjs`, and command `node ide-disabled-seed.cjs`.
   Synthetic fixtures require the disposable `education_platform_test` database;
   never run this seed against the preview or a deployed database.
5. Start `nginx`; run `browser`. Chromium maps its localhost origin to that
   isolated Nginx service. It never connects to the owner preview.
6. In a `finally` cleanup step, verify the project label and actual mounts,
   then run Compose `down -v --remove-orphans` **only for this test project**.
   Verify no matching test containers, networks or volumes remain. This removes
   all its synthetic accounts, purchases, assessments and fixtures.

Existing IDE regressions explicitly set `CODING_IDE_ENABLED=true` inside the
disposable test service; the new disabled suite temporarily sets false and
restores the previous test value. Test-only enabling is not release approval.

## Re-enable later

Keep the current value false for this release. React requires no separate
build-time flag. For a future approved reactivation, qualify the isolated
execution host first, deploy matching controller/execution images, explicitly
enable the backend and controller, and include the `coding-ide` local profile.
Recreate the affected services and reload browsers. Run the full enabled IDE
and security regressions before making it available. Existing passes remain
valid; original coding requirements resume. Do not bypass `runsc` in production.

To roll back this change, restore the previous application images and deployment
configuration together. There is no migration to reverse and no data to restore.
