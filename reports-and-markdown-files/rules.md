# Project rules

## Confirmed owner constraints

- Preserve the supplied system design. Recommendations must be explicitly labeled and must not become implementation decisions without the owner.
- Exactly two platform roles: STUDENT and ADMIN. The diagram/report's instructor wording does not authorize an instructor role.
- React/TypeScript frontend; one Node.js/Express/TypeScript backend with separate internal modules; PostgreSQL/Prisma for platform persistence. Backend replicas run the same image.
- DRM is an external API-only dependency to platform code. Never query its database or replace its video/security implementation from the platform. The owner explicitly authorized a separate bounded maintenance assignment inside education-drm-service/ for the missing permanent media-deletion API; this does not authorize unrelated DRM rewrites or cross-database coupling.
- Arabic primary/default and English secondary, RTL/LTR respectively; both content translations are mandatory. Programming courses contain recorded videos only; no live classes. Lesson/segment listings require subscription.
- Admin sets fixed plan duration; duration starts immediately at successful purchase. Expiry must stop viewing and show unsubscribed / needs renewal, enforced on the backend and through external session APIs.
- Manual EGP recharge initially: student submits request/reference/proof; admin verifies receipt and approves before credit. No automated payment gateway.
- Authentication and session tokens belong in protected cookies, never local storage. Use HttpOnly, production Secure, explicit SameSite and CSRF/session safeguards.
- Cloudflare R2 is production video storage, configured through external DRM. Docker local substitute/setup remains to be finalized without editing the external package.
- Required student flow: wallet recharge when funds are insufficient, course subscription, dashboard and authorized lessons.
- Admins manage platform content, course pricing, promotions, uploads, downloads, and removal.
- Docker from the beginning for platform services, dependencies, development, testing and production deployment. Separate frontend/backend images; connect to independently running external DRM without changing its containers.
- 10,000 simultaneous users is a required qualification target, not an already demonstrated capability.
- Keep reports and concept documents in this directory; root AGENTS.md is the discovery entry point.

## Proposed engineering acceptance rules

These implement integrity and review expectations; any policy-dependent detail remains subject to decisions.md.

- Validate authorization on the server for every sensitive operation; frontend visibility is not access control.
- Never ship application client secrets, signing private keys, content keys, or privileged admin tokens in browser assets or logs.
- Wallet credit requires authenticated admin approval after verifying actual receipt. A browser success screen or submitted screenshot cannot automatically credit money. Concurrent approvals must credit once.
- Use precise monetary representation and transactional, idempotent financial operations. Do not use floating-point arithmetic for balances.
- Treat queue delivery and external callbacks as potentially repeated. Test retry and crash recovery.
- Do not weaken DRM settings to pass production tests. Development ClearKey is not a production substitute.
- Do not rename services, substitute infrastructure, add user roles, or rewrite DRM persistence without a recorded decision.
- Keep unit, integration, browser, security, load, and recovery evidence distinct. Record skipped and blocked checks as such.
- Do not run destructive tests against existing data. Use separately named disposable Docker projects and volumes.
- No automatic production deployment, data deletion, or paid provider provisioning from a worker prompt.
