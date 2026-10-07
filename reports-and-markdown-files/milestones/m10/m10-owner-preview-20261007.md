# Latest M10 local website and dummy data — 2026-10-07

Owner requested running the latest website and adding a supplied parent phone
with dummy data. The existing local preview is available at http://localhost:8080.
No production deployment, WhatsApp message, commit/push or milestone acceptance.

Built current source using the standard Dockerfiles:
`fayq-m10-server:20261007`, `fayq-m10-client:20261007` and
`fayq-m10-migrate:20261007`. Server/client runtime health and public website/readiness
HTTP checks pass. The actual compiled browser and SSR builds include final M10 fixes.

Retained platform PostgreSQL/Redis volumes remain `m8-owner-preview_pgdata` and
`m8-owner-preview_redis-final`; PGDATA remains `/var/lib/postgresql/data`. Checked
private runtime configuration against the retained server without printing values.
Made a private PostgreSQL backup before migration, retained in ignored
`docker/browser/evidence/m10-preview-20261007/platform-before.dump`.
Applied the pending owner-authorized caption-removal migration and additive M10
tracking migration; all 25 migrations are now applied. Existing files/videos and
the external DRM persistence boundary remain intact. Started unchanged local DRM
dependencies; no DRM image/source changes. Grading and materials dependencies are
healthy. Existing courses and original accounts remain.

Added two explicitly labelled synthetic students: an active demonstration student
and a zero-activity student. Both have the owner's supplied guardian number,
normalized by the existing registration/profile phone parser. Both have synthetic
enrollment/purchase snapshots for the existing published learning demo and real
video demo courses. These dummy snapshots are not real payments; no original
wallet balance or financial/learning record was changed. No recharge approval or
actual transfer is implied. Seed uses an atomic transaction with original user,
wallet, purchase, subscription, progress, pass and submission preservation checks.

The active demo has nine synthetic counted-view facts across three lessons and
four weeks, three terminal assessment submissions (two passes, one unsuccessful)
and two earned passes. The quiet demo has no views/submissions. Historical view
facts are explicitly dummy provisioning, not measured real playback or a production
backfill. Tracking activation and existing media timestamps were not rewritten:
historical negative coverage remains honestly unavailable when not known.

Actual production report service generates Arabic WEEK/TWO_WEEKS/FOUR_WEEKS
combined reports successfully for the demo; fresh registered phone matches the
requested normalized value. Actual roster reports nine admin-only views.
Ignored seed source includes demo credentials and the supplied recipient; it is
never shipped in runtime images or committed. The administrator manually opens
and sends the desired part in WhatsApp. No external message was sent during setup.

Reproduction uses `docker/compose.dev.yml`, `docker/compose.local.yml` and
`docker/compose.m10-owner-preview.yml`, project `fayq-local-preview`, private root
`.env`, and the three exact retained-volume/PGDATA overrides above. Do not use
`down -v`, replace the volumes, reset the database or replay an old seed.
The seed is retry-safe for its exact demo identities and never replaces original
account passwords/contacts. Initial attempts failed database constraints and
rolled back completely; final provisioning and preservation checks passed.

These are retained owner-requested preview services, not disposable tests; they
remain running. No extra disposable Docker stack was created. Old reusable images,
backup and private evidence remain available for recovery.
