# Prompt 02 — local credentials, tenant and RS256 setup

Apply `00-worker-contract.md`; prerequisite: accepted package 01. Scope: local configuration and test identities.

1. Audit credentials by presence only. Confirm replacement R2 credentials are locally provided and old-key revocation is owner-confirmed; do not attempt to prove revocation by testing the exposed key.
2. Inspect `credential-presence-audit.mjs`, `configure-local-rs256.mjs`, `ensure-second-drm-tenant.mjs` and `prepare-platform-verification-admin.mjs` before executing them. Confirm their Docker invocation and output safety. Execute helpers in a Docker environment; provide a compatible containerized runner if absent.
3. Create/configure a separate DRM test application through the supported API under the owner's approved test scope. Record safe existence/status evidence. If tenant deletion is unsupported, document the retained test tenant instead of deleting DRM rows.
4. Prepare/bootstrap a throwaway ADMIN only after the guard proves disposable volumes. Generate credentials locally, preserve them only in ignored configuration and authenticate without exposing cookies or CSRF values.
5. Configure platform-to-DRM credentials and generate a fresh RSA signing key locally. DRM must trust the actual platform JWKS URL; preserve assertion issuer/audience/application binding. Confirm application and DRM containers can reach it.
6. Verify public JWKS has the expected RSA public fields and RS256, with no private parameters. Check production key/configuration failures without dumping rendered secrets.

Acceptance: ignored-secret rules pass, both tenant credentials work, isolated admin login works, JWKS is reachable from DRM and exposes only public material. Restore shared development settings or explicitly document any approved lasting configuration. Report missing owner inputs without secret values.
