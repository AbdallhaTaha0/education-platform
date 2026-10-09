# Upload session refresh - 2026-10-09

## Observed Failure

The owner reported a blank admin course page with a session-expired notice
during upload. Sanitized local server logs at 00:22:44 UTC show simultaneous
`/auth/me` failures, a successful refresh rotation, then a second refresh
that triggered `refresh reuse revoked family`. Subsequent course and wallet
requests failed authentication. This was a refresh race, not a video codec
failure or a need to increase session duration.

## Scoped Fix

- `client/src/auth.tsx` keeps its per-tab shared refresh promise and adds an
  origin-wide Web Lock around checking current cookies and rotating them.
- Inside that lock, a direct `/auth/me` request checks whether another tab
  already refreshed. A delayed 401 does not cause a redundant rotation.
- Credentials remain HttpOnly cookies; no token, lock state or authentication
  secret is stored in local storage. CSRF is reread before retrying mutations.
- Revoked sessions do not refresh. Backend expiry, refresh rotation, replay
  revocation and authorization remain unchanged.
- On browsers without Web Locks, the existing per-tab coordination and the
  session recheck remain, but cross-tab serialization is not guaranteed.
- Unauthenticated admin workspace routes now render a visible sign-in action
  instead of only a toast/blank course page. Revoked sessions require a fresh
  login; this fix does not resurrect or rewrite them.

## Verification

Docker client test stage: 294 Vitest tests across 36 files passed, plus 10
Node build-tool/security patch tests. New regressions cover two independent
client modules with shared cookies, delayed unauthorized responses, and revoked
sessions. Existing video and material retry fixtures now account for the
additional safe session check.

Both platform serving images built successfully and were refreshed together
in the existing local preview; the proxy was restarted. No database migrations,
owner-data changes, DRM edits, deployment, commits or pushes were performed
for this fix. Earlier uncommitted platform and authorized DRM work is preserved.

Docker Chromium verification used synthetic intercepted API responses:

- Two actual tabs with simultaneous expired requests: exactly one refresh,
  both course editors retained and manual status checks completed.
- Expiry between storage upload and completion: one storage PUT, one successful
  completion and one refresh, followed by READY after 13 status checks.
- Genuine authentication failure: protected editor absent, sign-in action
  visible on the admin route; mobile screenshot inspected.

The browser tests verify client concurrency and UI behavior, not a replay
against the owner's revoked session. Screenshots are in ignored
`docker/browser/evidence/`. All owned test containers used `--rm` with label
`session-repair=20261009`; none remain. No test volumes or networks were created.

The local preview remains at `http://localhost:8080`. Existing revoked login
must be replaced by signing in again, then refreshing other open tabs so they
load the coordinated client code. Ordinary short access-token expiry can then
refresh without interrupting upload; absolute expiry/revocation still requires
login by design.
