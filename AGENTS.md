# Agent entry point

Read [the index](reports-and-markdown-files/README.md), [agent responsibilities](reports-and-markdown-files/agent.md), [rules](reports-and-markdown-files/rules.md), and [decisions](reports-and-markdown-files/decisions.md) before working.

The owner's original design is preserved; subsequent explicit owner clarifications govern interpretation. Unanswered questions are not permission to invent policies.

Use client/ and server/ for platform implementation. The backend is ONE Express application with separate internal modules, horizontally replicable behind Nginx. Exactly STUDENT and ADMIN roles.

education-drm-service/ is a READ-ONLY external dependency. Never edit any file inside it, including code, Docker definitions, configuration, migrations or Git metadata. Consume only its API; never access its database. Its technology choices are independent of the platform's Nginx/Redis/PostgreSQL/Prisma stack.

Confirmed scope: recorded programming courses; admin-set fixed subscription duration; student-submitted manual recharge requests verified/approved by admins in EGP; Arabic primary and English secondary with both content translations mandatory; authentication/session tokens in cookies, never local storage; stop access on subscription expiry. External DRM owns video processing, security and watermarks. No live classes.

Current manager work is planning and handoff preparation. The saved Open Code prompt defines the bounded M1 implementation assignment when handed to the worker; it does not authorize subsequent milestones. Follow the assigned milestone's scope. Development and verification of platform services must use Docker. Do not interpret external DRM defects as authorization to repair that package.

The owner has also authorized first-pass UI generation in Google Stitch and reports-and-markdown-files/design.md. This design work does not authorize application implementation. The owner will review and adjust colors in Stitch; synchronize those reviewed choices before implementing final visual styles.
