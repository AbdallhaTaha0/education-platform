# M8 package 02 — FAYQ shell and landing implementation

Date: 2026-10-01. Executor: Codex manager, directly assigned by the owner: “you work on the M8”. Status: **implemented with same-agent Docker verification; ready for review**. This is the first application redesign package, not completion or acceptance of the whole M8 milestone. No commit, push or production deployment.

## Baseline and bounded scope

The owner approved the ages-15–18 audience, FAYQ direction, supplied mobile dock, whole-site redesign and isolated dummy content. This implements the shared foundation and landing page from [the brief](m8-design/website-redesign-brief.md); later student/admin workflows and new feature contracts remain separately sequenced. The direct owner assignment governs execution over the earlier prepared prompt's waiting language.

M7-04 had independent manager acceptance. M7-05 client tooling had implementation/same-agent evidence and still awaits independent review. M8 preserves its exact dependencies. Client manifest SHA256 remains `1b50760a1e2f0ffcb6761bebd833f019624ed997907ca5194f4309a3d4d6586b`; lockfile remains `a6b89890fd991b035c0a6382e9c8ef0068059226fb7fa7fa80de7c1ef7ecc34f`. No backend, schema, migration, Dockerfile, dependency or DRM changes were made by this package.

## Resulting experience

- Landing: bilingual teen-oriented hero, responsive illustration, concise benefits, API-backed featured courses, an explicitly illustrative personal-project block, accurate manual funding/purchase steps, useful expandable FAQ, discovery actions and footer. Marketing health/readiness cards were removed; operational endpoints were preserved. “How do I start?” scrolls and focuses its heading without replacing the application's route hash.
- Shared shell: compact logo/theme/language/notification top bar; desktop navigation; four labeled mobile destinations with an elevated active icon, semantic theme colors, RTL order and safe-area spacing. Student destinations are Home, Discover, My learning and Profile. Anonymous My learning opens login. Admin destinations are Overview, Courses, Recharge review and Account.
- Reachability: Profile now links to existing wallet, purchase history, learning, notifications and role-appropriate admin tasks. Logout and logout-all controls are preserved. Offer/purchase routes activate Discover; learning routes activate My learning; wallet/history/auth routes activate Profile. Notifications retain their top-bar entry. Admin course details and recharge review map to their respective dock entries.
- Accessibility: 44px minimum navigation/control targets, visible focus, aria-current and labels, page bottom padding, dock suppression while an input/select/textarea is focused, and fullscreen suppression. The existing skip link now focuses/scrolls content without breaking the hash router. Existing offer subscription text was corrected from white on lime to the semantic dark foreground.
- Public course artwork now alternates three restrained code motifs. These are decorative presentation variants, not inferred categories or newly invented course metadata. The landing shows at most three real API courses and retains loading, empty, error and retry states.

## Logo and assets

`Wordmark.tsx` centrally renders an editable reconstruction of the reference's angular FAYQ, Q tail and amber rays. It is **not an extracted original logo**. Letter proportions and Q geometry differ; this is explicitly reviewable. The Latin logo arrangement stays LTR and accessible FAYQ naming remains HTML. The Q ring adapts to readable green in light mode; its tail remains lime. No board screenshot or remote asset is used as the logo.

The fictional learner illustration was already generated and reviewed in M8-01; provenance remains in [the asset notes](m8-design/assets/README.md). Docker Chromium canvas converted its unchanged 1672×941 composition to WebP at quality 0.84: 640×360 / 27190 bytes, and 1280×720 / 70008 bytes. The page uses srcset, explicit dimensions and a decorative empty alt; copy stays HTML on solid surfaces. Self-hosted fonts and existing semantic tokens are preserved. See [consumed asset notes](../client/src/assets/README.md).

## Dummy data and local preview

The real disposable UI database used two synthetic `.example.test` accounts and three bilingual **DRAFT** courses. No media, publication, balance, purchase, subscription or grant was forged by the M8 fixture helper. Real cookie logins, account navigation, empty student learning/wallet/history, admin creation access, draft catalog and empty recharge queue were exercised through the actual server.

The populated public-course matrix uses browser-intercepted contract doubles from the approved illustrative content file, with an explicit screenshot banner. This verifies layout/API handling, not real publication or DRM. The actual public catalog correctly excluded the draft fixtures. No production demo flag, role switch or hardcoded authenticated balance was introduced.

A deliberately retained **read-only local design preview** at `http://localhost:8084/#/` serves the actual built client with three illustrative offers from an independent Nginx configuration. Its bilingual banner states that courses/prices are samples and sign-in/payments are unavailable. It has no database, private accounts or credentials; auth/payment APIs are unavailable. Container: `m8-ui-preview`, label `codex.scope=m8-02-readonly-preview`, localhost-only port binding. Sample JSON/config are readonly mounts. This configuration must never be used for a platform deployment. The previous design prototype on 8083 and actual platform preview on 8082 were preserved.

## Verification actually performed

All client installation/build/testing/execution used Docker. Final client runtime tag: `edu-platform-client:0.8.0-m8-02`; image index `sha256:f35daa2d4d113aa5187d4df26bebeb1aec720f953e48fbfcb99f95d496516cf1`, non-root user 101. Typecheck and production build passed; the unchanged client suite passed **70/70** and dash.js patch guards **2/2**. The inherited large bundled-JavaScript warning remains (about 1.29 MB raw / 379 KB gzip); code splitting was outside this visual package.

Final Docker Chromium run: **103/103**, exit 0. Eight Arabic/English × dark/light × 390/1440 combinations covered language/direction/theme, loaded hero, sample courses, dock destinations/active state/target size, no overflow, text contrast ≥4.5 on selected important pairs, router-safe how action, FAQ and footer clearance. Added 320px long-title coverage, keyboard focus/skip behavior, fullscreen dock hide/restore, actual student/admin cookie login, profile shortcuts, notification entry, logout, real draft administration, account/financial entry routes, public empty/loading/failure/retry, successful stylesheet/WebP/self-hosted-font requests, and storage containing only non-sensitive language/theme preferences. No page or failed-request errors were recorded. This does not constitute a comprehensive accessibility audit of every existing page.

Captured eight full landing screenshots, eight viewport screenshots and student-profile/admin-catalog screenshots. All eight visual combinations were inspected, plus representative authenticated views. The learning/player implementation was untouched; existing player/session/watermark tests passed. **Real protected playback, cosmetic changes during active playback and physical-device keyboard behavior were not reproduced** in this package because there was no legitimate media fixture/device. DOM fullscreen and focused-input checks do not prove those device/player cases. No full server suite rerun or real DRM qualification is claimed.

Principal reproducible commands (PowerShell Docker PATH setup omitted):

```text
docker build --pull=false -f client/Dockerfile --target test -t edu-platform-client-test:0.8.0-m8-02 .
docker run --rm --network none --name m8-02-client-tests edu-platform-client-test:0.8.0-m8-02 sh -c 'npm run typecheck --silent && npm test'
docker build --pull=false -f client/Dockerfile --target runtime -t edu-platform-client:0.8.0-m8-02 .
docker compose -p m8-02-ui -f docker/verification/compose.m6-delivery-browser.yml -f docker/verification/compose.m8-02.yml up -d --wait
docker exec m8-02-ui-server-1 node /tmp/m8-02-fixtures.cjs seed
docker run --rm --pull=never --name m8-02-browser --network m8-02-ui_default [readonly harness/demo mounts; evidence mount] edu-platform-browser:0.6.0-m6-inbox node m8-02-ui.mjs
```

The fixture helper/demo input must first be copied to `/tmp` in the guarded server; its private receipt is copied to the ignored harness evidence mount. Image conversion and preview JSON generation use the committed Docker browser helpers and readonly source mounts. Raw logs, machine-readable results and screenshots are ignored under `docker/browser/evidence/m8-02/`; no private receipt remains there.

## Failures, corrections and cleanup

An initial attempt reused the M7-03 financial helper, whose simulated READY media violates the M8 fixture boundary. Those isolated rows and receipt were immediately cleaned before M8 browser verification; they are not claimed as legitimate publication/playback evidence. The replacement helper creates only accounts and draft courses. No real media or DRM calls occurred.

The first matrix attempt did not reload an identical hash URL and therefore did not fetch its newly selected API double; the harness was changed to use unique navigation query values. Another run passed 84 checks before an idle wait timed out while authenticated realtime traffic continued; completion now waits for the expected course DOM. Its failed result/log are retained. Subsequent successful runs passed 92, then 102 with added asset/overlap checks, and finally 103 after the anonymous-learning destination correction. No assertion threshold was relaxed. Host orchestration also encountered a reserved PowerShell variable name and a quoting error; both were corrected before the final Docker builds. The first preview had network disabled, making its port mapping unusable; it was replaced with the guarded localhost-only bridge preview and HTTP/banner/catalog checks passed.

Cleanup removed two M8 accounts, three draft courses, their receipt and all owned `m8-02-ui` containers/network/volumes after checking project labels and every volume's attachments. Only the two pre-existing platform named volumes remain. The two intentional design previews are retained. Existing platform services remain healthy and migrate exited 0; nested DRM is clean at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`.

## Changed files and rollback

Product: `client/src/App.tsx`, `components/layout/Header.tsx`, `components/ui/Wordmark.tsx`, `features/home/pages/HomePage.tsx`, `features/catalog/pages/PublicCatalogPage.tsx`, `features/catalog/pages/OfferPage.tsx`, `features/identity/pages/AccountPage.tsx`, `features/notifications/components/NotificationEntry.tsx`, `styles.css`, and the two WebP assets/asset README.

Verification: `docker/browser/m8-02-ui.mjs`, `m8-optimize-assets.mjs`, `m8-preview-data.mjs`, `docker/verification/compose.m8-02.yml`, `m8-02-fixtures.cjs`, `nginx.m8-preview.conf`. Documentation: this report, current M8 plan/design packet/index follow-ups. Pre-existing M7 changes are separate and preserved.

Rollback only these M8 source/assets/tooling hunks; rebuild the prior client. Do not reset the tree or revert M7 manifests/lockfiles or server changes. No product database migration needs rollback. To remove the retained preview, inspect its exact label before removing only `m8-ui-preview`; preserve the earlier prototype and platform preview.

Next is reviewed discovery/student-page work under the M8 sequence. Saved-course persistence, new summary/report endpoints and proposed metadata still require their bounded contracts; they were not implemented by this visual package. M7 remaining security/operations/release gates and M5 formal acceptance remain separate.
