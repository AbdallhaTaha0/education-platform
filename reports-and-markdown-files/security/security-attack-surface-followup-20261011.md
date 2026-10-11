# Attack-surface inventory follow-up — 2026-10-11

This delta updates the [125-route baseline inventory](security-audit-attack-surface-20261005.md). Current total: **132 route-method registrations** (125 baseline + 7 M10 routes + 2 course-cover routes − 2 retired caption routes). Unchanged routes, input details and source traces remain in the baseline table. The deployed path may include the Nginx `/api` prefix rewrite; Nginx/Express method behavior and ingress controls still require a real-host check.

| Endpoint | Method | Authentication | Authorization | Input accepted | Sensitive | Rate limit | Risk review |
|---|---|---|---|---|---|---|---|
| `/api/admin/courses/:courseId/students` | GET | Session cookie | ADMIN; bounded course roster | UUID, `q` ≤100, cursor, limit 1–50 | Yes: student roster/progress | No route-specific limit | BOLA, privacy, pagination; route rejects stale ADMIN claims and is in the guard matrix. |
| `/api/admin/courses/:courseId/students/:studentId/views` | GET | Session cookie | ADMIN and course/student relationship | UUIDs, cursor, limit 1–50 | Yes: view details | No route-specific limit | BOLA, privacy, pagination; relationship is checked in service. |
| `/api/admin/students/:studentId/report-courses` | GET | Session cookie | ADMIN; only eligible course/report data | UUID, cursor, limit 1–50 | Yes | No route-specific limit | BOLA, privacy, bounded query. |
| `/api/admin/students/:studentId/report-contact` | GET | Session cookie | ADMIN; target must be a STUDENT | UUID | Yes: parent phone | No route-specific limit | Sensitive contact disclosure; role and target are checked. **NEEDS MANUAL VERIFICATION** for production admin access policy/log ACLs. |
| `/api/admin/parent-reports/generate` | POST | Session cookie | ADMIN + exact Origin + session CSRF | Student UUID, 1–50 course UUIDs, allowlisted report period/language/format | Yes: generated progress/contact report | 30/minute/IP | Privacy, IDOR, abuse and recipient data; report is transient and the body/phone-bearing URL are not logged. |
| `/api/learning/courses/:courseRef/lessons/:lessonId/views/start` | POST | Session cookie | Student identity, entitlement, course/lesson binding and progression | Course/lesson identifiers, playback reference ≤128 characters | Yes: learning activity | 30/minute/IP | Binding, replay, duplicate sessions and lifecycle; M10 Docker integration covers retries and changed playback state. |
| `/api/learning/views/:viewSessionId/heartbeat` | POST | Session cookie | Student owns the view and valid playback/course state | View UUID, monotonic played-milliseconds value | Yes: learning activity | 120/minute/IP | Race, stale state and overcount; row lock and concurrency integration regressions cover exactly-once threshold transition. |
| `/api/admin/catalog/courses/:id/cover` | GET | Session cookie | ADMIN; UUID course ID | UUID path only | Yes: unpublished course artwork | Shared admin read guard | Draft inspection is private/no-store; JPEG/PNG bytes only, `nosniff`; student denial covered by course-cover integration tests and protected-route matrix. |
| `/api/catalog/courses/:id/cover` | GET | Public | Only PUBLISHED, non-deleting course | UUID path only | Public image bytes | Public GET policy | Unpublished/deleting/draft media must remain hidden; MIME/signature, cache revalidation, `nosniff`, exact path and query validation are covered by course-cover tests. |

## Removed surface

The two caption routes present in the baseline—ADMIN POST and DELETE under `/api/admin/learning/lessons/:lessonId/captions`—were retired by the owner-authorized caption removal. The current route-surface regression tests also probe the former student caption GET and both ADMIN methods and require 404. They are not included in the current route count.

## Coverage and limits

`server/tests/unit/security-route-surface.test.ts` sends missing credentials to every snapshotted protected route and stale ADMIN claims backed by a current STUDENT database role to every ADMIN route. The private cover read was added to both matrices in this follow-up. These guard tests establish the middleware boundary, not all valid-session object-ownership permutations; the listed route-specific integration tests exercise the sensitive M10/course-cover behaviors. Express GET-to-HEAD, OPTIONS/preflight, malformed HTTP framing, forwarded-header trust, and provider edge behavior remain **NEEDS MANUAL VERIFICATION** against the real Nginx/provider path.
