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

The backend module decision and recharge approval model are confirmed. The bounded M1 implementation prompt is ready to hand to Open Code. Cloudflare R2 and access starting at purchase are confirmed; local storage setup gates storage-dependent work, not basic platform container scaffolding. The manager has prepared the prompt, not executed application implementation.
