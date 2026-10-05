# Login/register centering — 2026-10-05

Owner requested centered forms in both Arabic and English. Browser inspection showed the 640px cards already centered, while their contents inherited direction-dependent `start` alignment. Login and registration now use a scoped `auth-form-card` class: headings, labels, hints and input/select text align centrally; the student-details legend uses automatic inline margins. Cards have explicit full available width capped at 640px. RTL/LTR and identifier input directions remain intact. Other forms and authentication behavior are unchanged.

Docker frontend production build/typecheck passed. A transient Chromium container verified eight combinations: login/register × Arabic/English × 1440px/390px widths. Card centers, heading/field alignment and legend centers passed; no horizontal overflow or browser exceptions. No credentials, registrations or other persisted test records were created. Browser container automatically removed.

The retained preview ownership guard passed. Only client and Nginx were recreated; localhost:8080 serves the new UI. Previous client alias: `fayq-platform-client:before-auth-center-20261005`. New image: `fayq-auth-centered-client:20261005` (`ce31dbae0a557ae404748c14cadc940511378eb9cb94f74e86ddd5227e70ca22`). Backend, database and DRM were not changed. No commit/push or deployment.
