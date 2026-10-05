# Recharge field explanations — 2026-10-05

Owner requested clear explanations for recharge inputs, especially transfer reference.

Owner subsequently clarified: each explanation should contain only two or three words. All seven Arabic/English hints are now shortened accordingly, e.g. reference: «رقم العملية بالإيصال» / “Receipt transaction ID”. Hint associations and existing validation remain. Docker build/diff checks pass; frontend/proxy updated. Previous build preserved as `fayq-platform-client:before-short-recharge-help-20261005`.

The form now labels reference as the transaction ID and explains its source in successful transaction details/receipt. Arabic and English help covers actual transferred EGP amount, transfer method, sender name/phone, actual transfer date and readable proof (existing JPG/PNG/PDF, 5 MB limit). The hints distinguish sender/receiver and transaction reference/phone without changing required fields or payment policy. Inputs reference hint IDs through `aria-describedby`; proof errors remain associated and marked invalid.

Docker frontend TypeScript/Vite build and diff checks passed. This copy/accessibility change does not alter financial handlers; no new synthetic financial test or retained recharge was created. Updated only retained client/proxy; existing data, receiving settings, backend, grading, materials and DRM are preserved. No schema change, commit/push or production release.

Previous client image: `fayq-platform-client:before-recharge-help-20261005`. Rollback: retag to `fayq-platform-client:0.9.0-m9`, verify retained preview guards, then recreate only client/proxy with the existing Compose configuration. Keep all volumes.
