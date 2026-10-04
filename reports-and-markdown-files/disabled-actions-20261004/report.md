# Website-wide disabled-action explanations — 2026-10-04

The owner clarified that explanations must cover the whole website, including STUDENT and ADMIN, and authorized implementation where needed. The retained preview at http://localhost:8080 now shows bilingual reasons for disabled actions. This is a local UX change, not milestone acceptance or production qualification.

## Delivered behavior

`client/src/components/ui/Button.tsx` keeps the native disabled state and displays a compact explanation inside the control below its label. No hover, click or focus is required. The label keeps its accessible name; `aria-describedby` associates the explanation, existing descriptions are preserved, and a matching title provides supplementary hover feedback. Reasons disappear when the action becomes available. Existing custom controls retain their styling through `unstyled`; disabled styling uses a blocked cursor rather than suggesting every disabled action is loading.

Every non-request disable condition found in the source audit received its specific explanation or already has visible contextual text. Actions disabled only during an in-flight request share “Wait for the current request to finish, then try again.” Arabic equivalents are provided throughout.

| Area | Explained conditions and next steps |
| --- | --- |
| Authentication, profile and support | Current request must finish before another submit/save/logout. |
| Wallet and purchases | Transfer methods loading, failed or unconfigured; unavailable recharge channels; package review not loaded; purchase or recharge request in progress. |
| ADMIN recharge decisions | Verify receipt and check the confirmation box before approval; already processed request; pending decision. |
| Notifications | No unread notifications; loading, refreshing or saving in progress. |
| Student/submission directories | First page or no further pages. |
| Course/catalog administration | First/last ordering item; unavailable course-state transition; exact deletion confirmation text; package creation needs at least three eligible courses. Other saves/uploads/archive operations explain their pending request. |
| Assessments | Preparation already running; prepare the current draft and open private-test review before publishing; grading already in progress. Authoring limits: at least one and at most three samples, eight choices, ten questions, ten function arguments and twenty checks. Console text comparison explains why object/array options are unavailable. |
| Practice allowances | Enter a whole number from 0 to 2147483647; pending adjustments. Returning to valid input removes the explanation without saving an adjustment. |
| Learning | First/last lesson; required assessments block access; video unavailable; playback request pending. Existing locked curriculum rows retain their explanation and now associate it with the control. Expired/error playback controls explain recovery without bypassing access checks. |
| IDE | Used allowance and the displayed reset time; no execution to stop; empty console; formatting/run setup pending; reset must wait. Code remains physically left in Arabic and English, with the green Run control and yellow JavaScript badge. |

Caption/resource custom buttons in the pending course-material source now use the same shared feedback. The pending session-recovery selector explains that the user must first choose a session. Their backend integration/release remains a separate handoff; this change does not claim those features have been deployed.

## Source and preview isolation

The working tree already contained course-material and playback/session worker changes. They were preserved. The deployed frontend uses the retained verified source image `fayq-course-video-client-test:20261004`, overlaid with these explanations and the completed IDE changes. Pending API integrations were not inadvertently released.

The reproducible local helpers are `docker/disabled-reasons/apply.ps1`, `Dockerfile`, and `browser.mjs`. `preview-src/` is an ignored extraction of the verified frontend source, not an independent implementation or a credential fixture. The shared implementation and all explanation edits also live in `client/src/` for the eventual combined integration.

Final serving image and tested image match: `sha256:35801786cb5ad40deb08f4bdab2b2541a3284293b8b7e3bbd527a276770fd1b0`. A rollback image is retained as `fayq-platform-client:before-disabled-reasons-20261004`. Only the frontend and its Nginx gateway were recreated; backend, grading, databases and external DRM were not changed by this assignment.

## Verification and limits

- Final preview Docker typecheck, production build, 93 Vitest tests and two dashjs compatibility checks passed.
- The complete current frontend source also passed a Docker production build and 110 Vitest tests plus two compatibility checks. This validates source compatibility, not the pending materials/session APIs. The last shared styling adjustment was covered by the final preview build and browser rerun.
- **56 real-browser assertions passed** in Docker using the existing synthetic STUDENT and ADMIN accounts, Arabic/English, desktop and 360px phone widths. Checks cover IDE reasons, first/locked lesson navigation, notifications, student pagination, invalid/valid allowance input, course ordering, and expanded protected-deletion confirmation. Every visible disabled button on those pages has a visibly rendered, associated explanation; no horizontal overflow was found.
- Visual screenshots were inspected: [Arabic student desktop](student-ar.png), [Arabic ADMIN allowance on a phone](admin-ar-mobile.png), and [English ADMIN course actions on a phone](admin-course-en-mobile.png). Additional translated screenshots and the exact check list are retained in [browser-result.json](browser-result.json).
- Browser verification did not run code, play video, submit assessments, save allowance changes, approve recharge, purchase or delete content. Successful test sessions were signed out through their own browser context; other owner sessions were preserved. Temporary local form input was discarded.
- The final retained-preview guard passed for both platform and external DRM, preserving their two volumes each. Local readiness returned HTTP 200. Task-label inspection found zero remaining task containers, networks and volumes. Test/extraction containers had exact names/labels, verified mounts and scoped removal; no global prune.

Initial harness attempts were corrected: the internal `nginx` hostname did not match the approved login origin, and waiting for complete network idleness timed out against the site's notification connections. The final harness uses the gateway's network namespace with the actual localhost origin and page/element readiness. A first full-source test invocation lacked `vitest.config.ts` and incorrectly discovered a separate Node test as a Vitest suite; rerunning with the actual configuration passed. These attempts are not counted as passing evidence. The first preview-guard call without host permissions failed its ignored-file check; repeating with the required Docker/host permissions passed, as did the final guarded update.

Rare asynchronous states and every authoring maximum were audited in source and compiled; they were not all induced through the real backend. This report does not claim an exhaustive browser check of every possible disabled state, new backend capability, materials API acceptance, production deployment, commit or push.

## Rule traceability

Read the required documentation index, agent responsibilities, rules and decisions. Followed the current design and owner clarification: Arabic/English, existing visual tokens, accessible descriptions and mobile adaptation. Implementation stays in `client/`; cookies, authorization, progression, financial confirmation and server checks remain authoritative. No extra role, schema change, DRM source edit, access bypass or owner-data rewrite was introduced.
