# Agent entry point

Read [the index](reports-and-markdown-files/README.md), [agent responsibilities](reports-and-markdown-files/agent.md), [rules](reports-and-markdown-files/rules.md), and [decisions](reports-and-markdown-files/decisions.md) before working.

The owner's original design is preserved; subsequent explicit owner clarifications govern interpretation. Unanswered questions are not permission to invent policies.

Use client/ and server/ for platform implementation. The backend is ONE Express application with separate internal modules, horizontally replicable behind Nginx. Exactly STUDENT and ADMIN roles.

education-drm-service/ is a READ-ONLY external dependency. Never edit any file inside it, including code, Docker definitions, configuration, migrations or Git metadata. Consume only its API; never access its database. Its technology choices are independent of the platform's Nginx/Redis/PostgreSQL/Prisma stack.

Confirmed scope: recorded programming courses; admin-set fixed subscription duration; student-submitted manual recharge requests verified/approved by admins in EGP; Arabic primary and English secondary with both content translations mandatory; authentication/session tokens in cookies, never local storage; stop access on subscription expiry. External DRM owns video processing, security and watermarks. No live classes.

Milestone 1 is accepted at revision fce352f. The saved M2 Open Code prompt defines the bounded identity and bilingual-shell assignment when handed to the worker; it does not authorize M3 or subsequent milestones. Follow the assigned milestone's scope. Development and verification of platform services must use Docker. Do not interpret external DRM defects as authorization to repair that package.

Use reports-and-markdown-files/design.md as the current UI specification. The earlier generated Stitch pages are not an implementation source. Keep visual tokens easy to revise when the owner reviews colors.
