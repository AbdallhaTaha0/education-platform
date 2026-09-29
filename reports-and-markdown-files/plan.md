# Delivery plan

Updated after owner clarification. No schedule or capacity guarantee is implied.

| Milestone | Deliverable | Exit gate |
| --- | --- | --- |
| M0 Decisions and contracts | Confirmed boundaries and traceable requirements | Only relevant unresolved policies gate dependent work |
| M1 Docker foundation | Separate platform client/server images; Nginx, PostgreSQL, Redis, migrations/tests; external DRM connection contract | Clean Docker startup, persistence/readiness and unchanged external package |
| M2 Identity and bilingual shell | Cookie auth/session, STUDENT/ADMIN authorization, Arabic-default UI | Session/CSRF/role tests and RTL/LTR browser checks |
| M3 Catalog and administration | Bilingual programming courses, lessons, fixed-duration plans and external upload/status | Publication checks; protected lesson listings; API-only media integration |
| M4 Wallet and subscriptions | Student recharge requests, admin verified approval, EGP ledger and transactional purchase | Exactly-once credit/debit, concurrent spending and duration-policy tests |
| M5 Protected learning | Dashboard, external DRM player integration and subscription expiry enforcement | Real external playback, session lifecycle, expiry denial/termination and watermark observation |
| M6 Confirmed realtime/notifications | Only owner-confirmed diagram capabilities; no live classes | Relevant cross-replica/job authorization and retry checks |
| M7 Production qualification | Recorded-course load, hardened deployment, restore/rollback and alerts | Approved capacity/recovery gates and no critical unresolved external dependency failures |

Start operational and security checks in each milestone, not only M7. M1 does not need guessed payment providers, full business schemas or commercial DRM internals. M4 requires remaining financial/duration-unit details before dependent implementation. M5 verifies external behavior and reports blockers without repairing DRM.

## Next step

M1 is accepted at revision `fce352f`. M2 identity and bilingual shell are accepted after independent Docker verification on 2026-09-28. M3 catalog/media work and the explicitly authorized bounded DRM recovery/job-status prerequisites were independently accepted for their locally verified scope on 2026-09-29. Live R2/real-DRM verification remains blocked, and no general milestone authorizes unrelated edits inside the external DRM package.
