# Production candidate preparation — 2026-10-11

Owner authorized release preparation, merging delivered changes into
`deployment`, and guided Railway backend / Vercel frontend deployment using
generated URLs. This supersedes historical no-deployment instructions for this
task. Student launch remains gated until commercial DRM is completed and
qualified. No milestone or capacity acceptance is inferred.

## Candidate and changes

- Platform baseline: `dev` at `da94f61`, pulled without resetting local work.
- External DRM candidate: merge `53de347`, combining existing recorded silent-video
  repair `c38c3b4` with serving-stage alias `71c49dd`. No new DRM implementation;
  separate persistence and the API-only platform boundary stay intact.
  Verified and pushed to external `dev`, `testing` and `deployment`.
- Vercel output removes the reserved root `/.well-known` rewrite. Use
  `/api/.well-known/jwks.json` through the same-origin API proxy for signing keys.
  [Vercel documents the reserved path](https://vercel.com/docs/routing/rewrites).
- Environment template explicitly retains `CODING_IDE_ENABLED=false`.
- Added private one-time setup for the owner's three initial release admins.
  It never runs at startup and supplies no default password.
- [Commercial DRM options and remaining integration](commercial-drm-options-20261011.md).

## Fresh database and private admin setup

Use a fresh production platform PostgreSQL database. Do not migrate local users,
courses, wallets or media metadata. Local owner preview and data remain intact.
The independent DRM service has a separate fresh database.

After platform migration and before registration opens, privately provide these
variables to a one-shot Railway job using the platform serving image:

| Index | Fixed display name | Private variables |
| --- | --- | --- |
| 1 | AliIbrahim | `RELEASE_ADMIN_1_EMAIL`, `RELEASE_ADMIN_1_PHONE`, `RELEASE_ADMIN_1_PASSWORD` |
| 2 | SeifWaleed | `RELEASE_ADMIN_2_EMAIL`, `RELEASE_ADMIN_2_PHONE`, `RELEASE_ADMIN_2_PASSWORD` |
| 3 | AbdallahTaha | `RELEASE_ADMIN_3_EMAIL`, `RELEASE_ADMIN_3_PHONE`, `RELEASE_ADMIN_3_PASSWORD` |

Contact details were supplied privately; never commit them. Each admin chooses a
private strong password. Run `npm run bootstrap:release-admins` only in that
one-shot job, leaving the normal application start command intact. Remove these
variables after success and verify all three website logins. Actual production
account creation has not occurred.

The command normalizes email/phone, requires distinct valid identities/passwords,
hashes with production Argon2 and atomically creates exactly three ADMIN users.
A transaction advisory lock shared with ordinary first-admin setup serializes
concurrent attempts. Any existing user causes refusal. Invalid input or a failed
transaction cannot leave a partial batch. This owner-approved exception adds no
public bootstrap endpoint.

## Docker evidence

| Check | Result / boundary |
| --- | --- |
| Platform runtime and test builds | PASS, including Prisma/Argon2 serving-image smoke |
| Server TypeScript, including tests | PASS |
| Frontend suite | PASS 46 files / 391 tests, network disabled |
| Backend CI | PASS unit suite and 52 integration files / 462 tests against disposable PostgreSQL/Redis |
| Deployment SDK and output/routing tests | PASS typecheck and 5 tests |
| Vercel artifact build/inspection | PASS synthetic HTTPS gateway, assets present, no static root index, API JWKS route |
| DRM API/worker builds | PASS merged source; final API stage serves traffic |
| DRM configured unit suite | PASS 15 files / 103 tests with synthetic configuration |
| Native video transcoding | PASS 2 tests: finite encrypted output with and without audio, real FFmpeg/Shaka inside Docker |
| Production-mode rehearsal | PASS `fayq-deploy-verify-1791719488613`; separate platform/DRM migrations exited 0 |
| Gateway probes | PASS live/ready/API JWKS, protected anonymous denial, Secure CSRF cookie, public-only keys, Arabic/English SSR and internal-route protection |
| Three-admin setup | PASS invalid count/duplicate/weak-password refusal with zero writes; concurrent one-winner batch; exact names/roles/password hashes; repeat CLI refusal without secret output |
| Cleanup | Disposable rehearsal containers/network/anonymous volumes absent; suite stack and its data volume removed |

Backend CI retains its existing exclusion of the external-storage
learning-materials suite; no real R2 upload/download qualification is claimed.
The rehearsal used synthetic credentials and an unreachable synthetic HTTPS DRM
origin, not commercial issuance. Initial verification invocations had an
unsupported Compose option and missing DRM fixture/configuration; these are not
passes. Corrected backend and configured DRM unit/native retries passed.
The unrelated DRM deletion integration suite was not qualified in this run.

No actual cloud browser pass is claimed. Brave access and the Railway new-project
page were inspected. No paid resource, account, bucket edit, production database
or cloud deployment was created. Existing frontend build-tool advisories remain
subject to the security follow-up report; these test passes do not waive them.

## Guided release order and unresolved launch gates

Use [the service/environment runbook](railway-vercel-20261007.md) and
[dedicated GitHub migration instructions](railway-github-migration-20261007.md).
Promote the candidate through `testing` to `deployment`, preserving historical
probe evidence and branch history without reset or force-push.

1. Confirm Railway project/workspace, environment and hosting budget. Create fresh
   persistent platform PostgreSQL/Redis; retain qualified PostgreSQL 16 / Redis 7
   unless a separately tested major-version change is approved.
2. Run the dedicated migration service to exit 0, then backend and gateway from
   the same platform revision. Keep database/cache/backend private and use the
   repository root build context with the documented Dockerfile paths.
3. After commercial DRM is qualified and public access is approved, give the
   gateway a generated HTTPS Railway domain. Connect the new Vercel
   platform project to `deployment`; build its client output with that gateway
   origin. Keep browser API base `/api` and the Arabic-default build.
4. Set the stable generated Vercel production alias as platform allowed/public
   origin and matching DRM assertion issuer/CORS origin. Keep indexing disabled
   until launch approval; do not allow every ephemeral preview origin.
5. Generate fresh production authentication/encryption/signing secrets privately.
   Reuse approved R2 credentials only in confirmed Railway services; no secrets
   in public `VITE_*` values. Review bucket/prefix ownership before writes to
   preserve retained local media. Run and verify the private admin setup.
6. Select a commercial DRM provider and complete its external key/packaging/license
   integration. Deploy independent DRM API/worker and persistence. Keep
   `CLEAR_KEY_ENABLED=false`, `PREMIUM_DRM_REQUIRED=true`, HTTPS and signed
   assertions. No ClearKey production fallback is approved.
7. Qualify actual Vercel → Railway cookies, CSRF/Origin, unspoofable client-IP
   rate-limit identity, notifications/reconnect, R2 upload/download CORS,
   protected playback and expiry/session/device denial. Re-run Student/Admin
   Arabic/English journeys at measured 1280×900, 1920×1080, 390×844 and 360×800
   with disposable cloud fixtures. Synthetic placeholders are not playback proof.
8. Prove backup/restore and migration rollback, review remaining advisories and
   measured capacity/cost, and configure real manual EGP recharge instructions.
   No real payment is verification evidence.

Until gates pass, do not onboard students, publish owner courses or accept real
recharge traffic. This is a deployable candidate, not student-launch readiness.
Provider selection and actual cloud setup remain the owner's next guided steps.
The current launch gate is operational: no public cloud API/frontend is deployed.
There is no new application registration-disable flag. Keep services private
until commercial integration and the controlled cloud qualification plan exist;
do not expose the gateway and rely on an unpublished link as protection.

## Promotion receipt

Platform preparation commit: `9f33adc`; testing merge: `88415b7`; deployment
merge: `0d6592d`. Implementation, Docker files and the DRM reference in the
deployment merge match the Docker-verified candidate exactly. Testing's six
historical grading-probe evidence files are preserved. A historical gitlink
conflict was resolved to external `53de347`, confirmed to descend from the
previous deployment reference `d1bfd69`.

Previous remote testing/deployment histories and platform dev are ancestors of
this merge. This report receipt accompanies the same verified candidate;
promotion introduces no extra application code. Owner preview's five services
remain healthy. Disposable suite containers/network/data volume were independently
confirmed absent after cleanup.
