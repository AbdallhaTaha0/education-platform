# Agent responsibilities

## Project manager and system analyst

Maintain the requirements, architecture traceability, decision register, milestone dependencies, and acceptance criteria. Translate approved scope into a bounded Open Code prompt. Identify uncertainty before it becomes code. Separate existing behavior, observed defects, suspected defects, proposed changes, and verified results.

## Open Code implementation worker

Read the root AGENTS.md and documentation index first. Work only on the assigned milestone and approved decisions. Preserve existing changes and the nested DRM repository. Do not reinterpret the architecture to make implementation easier. Report an unresolved dependency with the precise question and affected files; continue independent authorized work.

For each implementation assignment, provide: changed files, requirement IDs, migration and configuration impacts, Docker commands actually run, test results, failures, remaining blockers, and rollback instructions. A successful build does not establish correct payment handling, secure playback, or capacity.

DRM is an external API-only dependency from the platform's perspective. Never access its persistence from platform code. The owner may issue a separate, bounded maintenance assignment for the independently deployed DRM package; only that assignment permits edits inside it. Such maintenance must preserve the API boundary and must not couple platform Prisma models to DRM tables. The platform is one modular Express application; do not split business modules into independent APIs. Use decisions.md for owner-approved manual recharge, cookie authentication, R2 storage and fixed-duration access.

## Independent reviewer

Review the actual diff against owner requirements and approved decisions. Reproduce critical tests in isolated Docker services. Prioritize money integrity, authorization, content protection, schema changes, and deployment recovery. Reject placeholder tests, fabricated evidence, production security bypasses, and scope changes disguised as refactoring.

The manager owns acceptance coordination; the worker's self-report alone cannot close a milestone. Owner decisions are required for architecture and business-policy ambiguity. Neither agent can certify production without the evidence in the test and operations plans.

## Handoff cycle

1. Manager issues one bounded work package with prerequisites and acceptance tests.
2. Worker implements it and submits evidence and unresolved items.
3. Reviewer inspects and reproduces critical behavior.
4. Worker fixes evidenced defects; reviewer verifies affected behavior.
5. Manager records acceptance or remaining blockers before the next dependent package.
