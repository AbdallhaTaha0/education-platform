# Agent entry point

Read [the index](reports-and-markdown-files/README.md), [agent responsibilities](reports-and-markdown-files/agent.md), [rules](reports-and-markdown-files/rules.md), and [decisions](reports-and-markdown-files/decisions.md) before working.

The owner's original design is preserved; subsequent explicit owner clarifications govern interpretation. Unanswered questions are not permission to invent policies.

Use client/ and server/ for platform implementation. The backend is ONE Express application with separate internal modules, horizontally replicable behind Nginx. Exactly STUDENT and ADMIN roles.

education-drm-service/ is an independently deployed external dependency. Platform code consumes only its API and never accesses its database. Its technology choices remain independent of the platform's Nginx/Redis/PostgreSQL/Prisma stack. Default work must not edit it; however, the owner explicitly authorized bounded DRM-maintenance prerequisites on 2026-09-28 for permanent media deletion and on 2026-09-29 for retry-safe reissuance of an upload URL for the same existing UPLOADED asset. Only a prompt that explicitly assigns one of those bounded DRM tasks may edit the nested package.

Confirmed scope: recorded programming courses; admin-set fixed subscription duration; student-submitted manual recharge requests verified/approved by admins in EGP; Arabic primary and English secondary with both content translations mandatory; authentication/session tokens in cookies, never local storage; stop access on subscription expiry. External DRM owns video processing, security and watermarks. No live classes.

Milestone 1 is accepted at revision fce352f, Milestone 2 at revision b8080a8,
Milestone 3 at revision d520dd7, and Milestone 4 at code checkpoint 03e51eb.
The accepted nested DRM recovery checkpoint is 5293917. Follow the assigned
milestone's scope. Development and verification must use Docker. A DRM defect
is authorization to repair that package only when the owner's explicit
DRM-maintenance prompt assigns it; that permission does not merge DRM
persistence or internals into the platform backend.

Use reports-and-markdown-files/design.md as the current UI specification. The earlier generated Stitch pages are not an implementation source. Keep visual tokens easy to revise when the owner reviews colors.
