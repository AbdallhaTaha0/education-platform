# Visible error notifications

2026-10-02, Africa/Cairo. The owner requested errors that remain visible after a button fails and explicitly selected “Use a visible popup notification.” This is a bounded frontend change; no milestone acceptance or commit/push is inferred.

The shared error Notice now registers an in-memory, dismissible popup through ErrorFeedbackProvider. Messages stay fixed in the visible viewport, stack without overlapping each other, remain until dismissal/error clearing, and disappear when their originating component unmounts. Error content stays escaped React content; existing links in messages remain usable. No error/credential persistence, automatic retry, page scrolling, modal interaction blocking or backend change is introduced. Field-level validation remains beside inputs. Arabic/English direction and dismissal labels use the current language; semantic error tokens support both themes. Mobile placement clears the existing navigation and safe-area inset. Preparation-request and editor-formatting errors use the same mechanism.

Files: `client/src/components/ui/ErrorFeedback.tsx`, shared `Notice.tsx`, `App.tsx`, `styles.css`, `ProgramSettings.tsx` and `WebIDE.tsx`; this report and its documentation-index link. Earlier local handoff changes remain preserved.

Docker verification:

- Current client runtime build/typecheck passes. Existing 88 frontend tests and two DASH compatibility checks pass in a transient no-network container.
- Fourteen focused real-browser checks pass using intercepted synthetic login failures: visibility far below the page top, unchanged scroll/source values, absence of the old top-of-form error, persistence, dismissal, repeated failure, dark/light colors, mobile fit/navigation clearance, keyboard usability, route cleanup, Arabic RTL/labels and zero browser errors. No login request reaches the backend; no owner account or data is modified. Mobile/Arabic screenshots visually inspected.
- Initial build caught unreachable error comparisons after the new error branch; corrected before delivery. Browser checking caught a small mobile-dock overlap; spacing increased and affected checks repeated. The Arabic probe originally changed storage while navigating within the same SPA; corrected to exercise the actual language-switch control. Failed evidence is preserved with passing evidence under ignored `docker/browser/evidence/m9/error-feedback-*`.
- Guarded local refresh changed only client/Nginx. Backend, grading, PostgreSQL/Redis and independent DRM are unchanged. Final readiness is 200. Test/browser containers were automatically removed and ownership-label checks show none remaining. No networks/volumes or synthetic database fixtures were created for this package; no global prune.

Available at `http://localhost:8080`. All new work remains uncommitted. No schema, published quiz, grade, submission history, wallet, subscription, DRM or production/capacity policy changed.

## Admin coverage follow-up

The owner explicitly clarified that this includes errors while adding questions and other ADMIN actions. Existing course/lesson/package/user/recharge/quota/save/publish errors already use the shared error Notice. Added popup delivery for asynchronous FAILED test-preparation results, and ensured that retrying the same invalid question save redisplays a dismissed validation popup. Field-level validation remains inline as well.

Fresh client build/typecheck passes. The direct Docker Puppeteer/controller flow passes **78/78**, including four new checks for visible ADMIN question-validation errors, repeat after dismissal, rejected publication and asynchronous preparation failure. Preparation failure presentation is simulated by intercepting a status response only in the disposable synthetic browser; the underlying real preparation/grading checks still run and pass. Old formatting/purchase/subscription assertions now inspect the requested popup location rather than the removed inline messages.

The optional inspection CLI failed before fixtures with `Event stream closed`; bounded diagnostics are preserved. The explicit `--flow-only` runner option bypasses that unavailable tool while retaining the actual browser/controller flow and identical cleanup guards. This follow-up does not claim a passing CLI check. Initial affected-probe failures are retained. Final test containers/networks/volumes are zero and fixture JSON is removed. Only retained client/Nginx were refreshed; readiness remains 200 and backend/DRM/owner records remain unchanged. Changes to test runners and this follow-up remain uncommitted.
