# ADMIN course workspaces — 2026-10-05

## Owner request and delivered behavior

The owner requested separate course tabs and clearer sections and assessments. Course management now offers searchable, paginated route shortcuts: every course opens its own bookmarkable workspace. Saving a course rename updates its active shortcut immediately.

Each workspace has five named tabs:

1. Sections & lessons.
2. Assessments (quizzes, assignments and submissions).
3. Edit course details.
4. Prices & subscription access.
5. Publish, archive & delete.

The first two tabs provide section and lesson searches. Only one section and one selected lesson editor mount at a time; section/lesson choices use the existing 10/20/50 pagination. Search includes both content languages. Filtering choices keeps the current editor open, preventing searches from silently discarding work. Empty sections clearly offer the next creation action.

Video tools and assessment tools have separate areas. Assessments open their existing language modes and list immediately. Section creation/order and lesson creation use named expandable controls; permanent deletion retains its explicit confirmation. Existing publication, subscription, required/optional assessment and financial policies are unchanged.

Course, section, lesson and internal-tab switches respect the existing unsaved-change guard. An active video upload registers a navigation blocker; confirmed departure aborts the existing upload operation through its established unmount cleanup. Course route changes remount the detail workspace so another course cannot inherit its editor state. The selected section/lesson remains stable across creation, reloads and reorder; deletion falls back to an available item.

Arabic/English labels, RTL, keyboard-operated internal tabs and mobile layouts follow the existing design tokens. Course shortcuts remain ordinary route links with `aria-current`; local course areas remain actual accessible tabs/panels. Pagination boundary explanations now distinguish the first/last page from an operation in progress.

## Implementation scope

- New `AdminCourseTabs.tsx` and `CourseContentWorkspace.tsx`.
- Updated `AdminListPage`, `AdminDetailPage`, `LessonEditor`, `AdminAssessmentPanel`, `MediaUploader` and the admin-course route key in `App`.
- Small shared pagination explanation correction.
- New disposable course-workspace fixture/browser flow; updated existing dashboard, catalog-editor and assessment-save browser flows for the separated controls.

No backend, schema, migration, dependency, role, deployment or DRM source change. No new architecture or access policy. `design.md` remains unchanged.

## Docker verification

| Verification | Outcome |
| --- | --- |
| Final frontend TypeScript/Vite runtime build | PASS |
| Final frontend unit regressions | 173/173 PASS |
| DASH compatibility checks | 2/2 PASS |
| Catalog integration, real disposable PostgreSQL/Redis | 61/61 PASS |
| Course-workspace browser checks | 17/17 PASS |
| Existing ADMIN dashboard/role/keyboard/mobile/draft checks | 27/27 PASS |
| Real bilingual Required/Optional assessment saves | 11/11 PASS |
| Real catalog creation/edit/order/addition/archive/delete browser flow | 36/36 PASS |
| Final local root and readiness | HTTP 200 / 200 |
| Final served bundle contains the new course workspace | PASS |
| Disposable project cleanup | 0 containers, 0 networks, 0 volumes |
| Diff whitespace and verification-script syntax checks | PASS |

Browser flows use real platform authentication, API and persistence in the guarded `fayq-ide-modes-test` project, with synthetic course/media fixtures. They do not mutate owner courses or real videos. Desktop and Arabic mobile screenshots were inspected; overflow checks pass and no browser runtime errors were observed.

Reproduction (after building current test/runtime image aliases described by the existing IDE verification runbook):

```text
node docker/ide/modes-verify.mjs --course-workspace-only
node docker/ide/modes-verify.mjs --assessment-save-only
node docker/ide/modes-verify.mjs --catalog-only
```

`--course-workspace-only` now includes the workspace, existing dashboard and assessment-save flows. Host Node orchestrates Docker only; browser/application/test execution occurs in containers. Private logs/screenshots remain in the ignored `docker/browser/evidence/ide-modes/` directory.

## Findings resolved during verification

An actual selection defect was found and repaired: editors initialized before their first lesson existed used a fallback without recording its ID, so reordering could change the selected lesson. Both section and lesson selections now record the valid selected ID; the real reorder regression passes.

Two browser-harness issues were corrected: a shortcut click landed on the sticky header after scrolling, and assessment navigation clicked before the asynchronous course load finished. The tests now explicitly activate the intended route and wait for the course tab. Failed attempts cleaned their disposable resources; the subsequent relevant flows pass. A course-name refresh check was added to ensure the active course shortcut updates after a real save.

## Retained preview delivery and preservation

Available at `http://localhost:8080/#/admin/catalog`.

After the retained-preview ownership/volume guard passed, only `client` and its Nginx proxy were recreated. No migration, bootstrap, retained-volume deletion, SQL fixture, backend restart or DRM operation was performed on the retained preview.

Final runtime image: `fayq-course-workspace-client:20261005`, also tagged as the serving `fayq-platform-client:0.9.0-m9`, image ID `20a47f8d16afba9274322d72c805244c87d5e40e9818c4bbfc8c11d4dc2975e7`.

Rollback frontend: `fayq-platform-client:before-course-workspace-20261005`, image ID `ce31dbae0a557ae404748c14cadc940511378eb9cb94f74e86ddd5227e70ca22`. Restore that alias and recreate only client/proxy using the same guarded retained-preview Compose configuration if rollback is needed.

Retained server `7ed38e9f3406`, grading `d6247768b15b`, PostgreSQL `65ca220659f4` and Redis `00dd79c3eab4` container identities remain unchanged and healthy. DRM API/worker/PostgreSQL/Valkey container identities also remain unchanged; nested DRM checkout remains clean at `dd66be3`.

This frontend refresh includes the latest committed phone-watermark changes that the preceding independent review found absent from the old serving client. No production release, capacity qualification, milestone acceptance, commit or push is claimed. Working-tree changes remain available for owner review.
