# Logout redirect — 2026-10-05

Owner request: logout should return to the login page.

Later owner follow-up: a URL change alone left the old screen visible. The corrected implementation reloads the login route after success. Actual logout from the owner's open learning page was verified, and the [wallet/logout follow-up](../payments/wallet-instapay-and-logout-20261005.md) records the final build and browser checks.

The shared authentication provider now navigates to `#/login` after a successful logout or logout-all response. This covers header and profile actions for STUDENT and ADMIN. Failed server logout retains the existing error behavior. No backend, schema or DRM changes.

Docker frontend TypeScript/Vite build passed. Disposable Docker browser verification passed all 19 checks, including successful STUDENT and ADMIN header logout displaying the login form and the existing 17 progress checks. Cleanup verified zero disposable containers, networks and volumes. Evidence remains in ignored `docker/browser/evidence/ide-modes/progress-flow.log`.

Local preview client updated; proxy recreated with retained Compose configuration. Prior client is preserved as `fayq-platform-client:before-logout-fix-20261005`. Rollback: retag that image to `fayq-platform-client:0.9.0-m9`, verify retained preview guards, then recreate only client and proxy. Retained databases, backend, grading, materials and DRM are preserved. No commit, push or production release.
