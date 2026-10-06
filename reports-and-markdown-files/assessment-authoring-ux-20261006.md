# Assessment authoring review and UX repair — 2026-10-06

Owner request: review the entire assessment creation experience, fix broken dropdowns and question-type selection, and improve its usability. This delivery changes platform UI and verification only; assessment contracts, grading policy, database schema and external DRM remain unchanged.

## Findings and changes

1. **Controlled native dropdowns reverted their selections.** The enclosing editor's `input` handler triggered a React state update before a native select's `change` handler could read the selected value. A real keyboard interaction reproduced the bug; Puppeteer's synthetic `select()` alone did not. The editor now avoids state updates on select `input` events and clears feedback after `change`. Assessment kind, question type, output type, boolean values, generator, comparison, check type and interaction controls now retain the chosen values.
2. **Changing question type was unnecessarily destructive.** Switching no longer opens a blocking confirmation. Titles and identity stay intact, and each type's settings are remembered in memory for the current editing session. Only the selected type is saved; temporary alternate-type state is cleared when another assessment opens.
3. **Long forms obscured individual questions.** Questions now have labelled, focused accordions. Adding a question opens it; removing one selects a surviving question. Save validation opens and focuses a closed question containing missing data. Required/Optional remains an explicit owner policy choice.
4. **Some invalid grading inputs reached the API.** Empty behavior-check lists and missing interaction selectors now receive local field feedback. Removing a selected correct choice clears that answer. Existing typed-value validation prevents stale committed values from being submitted after invalid edits.
5. **Object property names were difficult to edit.** A stable property key and blur-based rename permit multi-character names without remounting the field on every keystroke.
6. **Changing behavior checks erased reusable configuration.** Shared selectors, interaction steps and relevant values now survive compatible check changes. Interaction selectors and values expose the API's existing length limits in the form.
7. **Test preparation could be repeatedly requested.** The preparation action is disabled while requesting or preparing; stale errors and review state are cleared appropriately. Hidden tests still require explicit review before publication.
8. **Native dropdown Escape could close the entire workspace.** Native select Escape and already-consumed keyboard events are now left to their controls; the existing keyboard focus trap remains.
9. **Mobile workspace inherited a page spacing margin.** The fullscreen editor now explicitly has zero margin, restoring the entire 390 × 844 viewport rather than starting 16 pixels below its top. Horizontal fit and an Arabic viewport screenshot were checked.
10. **Save failure feedback needed an editor-local location.** Failed requests now show an inline alert inside the workspace while preserving entered values. The shared `Notice` error component uses a global portal, so the editor uses an explicit local alert instead.

## Verification

- TypeScript and Vite production build in Docker: PASS.
- Frontend regression suite: 173 tests across 25 files PASS. Existing DASH patch checks also passed during the review.
- Native keyboard browser checks cover JavaScript, web HTML/CSS/JavaScript and Python; all question types; typed answers; check interactions; multi-question validation; Arabic/English; mobile layout; Escape; and a controlled HTTP 503 save failure followed by a successful real API save.
- Successful creation and publication use the real isolated platform API. Python private tests are prepared, reviewed and published through the real grading controller. The injected 503 is only a failure-feedback test and is not presented as backend availability evidence.
- The prior 11-check assessment-save flow is rerun to preserve explicit Required/Optional selection and localized inline field warnings.
- Final browser verdict: **54/54 authoring + 11/11 save checks PASS**; no page runtime errors. Guarded cleanup confirms **0 disposable containers, 0 networks, 0 volumes**.
- The disposable project is `fayq-ide-modes-test`, with guarded isolated volumes, no published ports, synthetic accounts and course fixtures. Its containers, network and volumes are removed in `finally` on success and failure.

Reproduce after building the matching frontend image and tagging it `fayq-ide-modes-client:preview`:

```text
node docker/ide/modes-verify.mjs --assessment-authoring-only
```

Private browser evidence resides in the ignored `docker/browser/evidence/ide-modes/` directory. The before-fix native-selection failure is retained separately. During harness development, a radio-list `$eval`/`$$eval` typo and an assertion that looked for globally portalled error text inside the editor were corrected; these were not backend defects. The mobile bounds failure did identify and lead to a product fix.

## Delivery and limits

The local preview update uses the guarded `client-up` action in `docker/local-preview.mjs`, refreshing client and Nginx only. Existing server, grading, external DRM, PostgreSQL and Redis containers and their mounts are protected. A rollback frontend tag is retained.

Installed runtime image: `fayq-platform-client:0.9.0-m9`, image ID `sha256:93197620567bebcfcb315de9b55bfd350f34e39e2098642be43746c0a447ee75`. The same verified image is retained as `fayq-assessment-authoring-client:20261006`. The prior preview frontend is retained as `fayq-platform-client:before-assessment-authoring-20261006`.

Post-refresh inspection confirms **10 protected containers retain their identities, image IDs and storage attachments**. `http://localhost:8080/`, platform `/api/health/ready` and external DRM `/health` all return **200**. No fixture was created in the retained owner environment.

To roll back only the UI, tag the retained `before-assessment-authoring-20261006` image back to `fayq-platform-client:0.9.0-m9`, then invoke `node docker/local-preview.mjs client-up`; the same persistent-volume guards apply. Do not remove retained data volumes.

No migration, production deployment, DRM source change, commit, push or milestone acceptance is part of this task. Earlier pending security-delivery changes and the staged nested DRM reference remain preserved. The build's existing bundle-size and dependency-audit warnings are not resolved by this UI task.
