# Whole-Site UI/UX Overhaul & Component Refactoring (Desktop, Tablet & Mobile) — 2026-11-23

## 1. Scope & Owner Direction
Owner-assigned whole-site UI/UX audit, responsive design overhaul across **Desktop (`1440×900`)**, **Tablet (`768×1024`)**, and **Mobile (`390×844`)** viewports, and modular component refactoring tailored for **15–18-year-old secondary students (`أولى وثانية ثانوي`)** in both Arabic (`ar`, RTL primary) and English (`en`, LTR secondary), across Dark and Light FAYQ themes.

Preserved invariants:
- Frontend-only scope (`client/src/`); `server/` and `education-drm-service/` remain untouched.
- Strictly two platform roles (`STUDENT` and `ADMIN`).
- Bilingual parity, cookie-only authentication, integer EGP piastres, visible `disabledReason` explanations (`aria-describedby`), and centered standalone form submit groups (`.form-actions`) with start-aligned form inputs and labels (`text-start`).

---

## 2. Delivered Work Packages (`WP-UI1` → `WP-UI6`)

### `WP-UI1`: CSS Refactor, Focus Hygiene & Adaptive Desktop/Tablet/Mobile Navigation Shell
- **`client/src/styles.css`**:
  - Removed ~450 lines of dead M8 prototype selectors (`.youth-hero*`, `.code-scene*`, `.build-story*`, `.project-window*`, `.benefit-strip*`, `.learning-steps*`, `.landing-faq*`, `.faq-grid`, `.landing-final*`, `.catalog-art*`, `.hero-grid::before`).
  - Eliminated sticky header translucency bleed by keeping `body` on solid `var(--color-bg)` and raising `.site-header` to `color-mix(in srgb, var(--color-bg) 95%, transparent)`.
  - Added `[tabindex='-1']:focus, [tabindex='-1']:focus-visible { outline: none; }` so programmatic focus on page headings (`<h1>`, `<main>`) never draws a 3px lime input box around titles, while interactive controls retain `:focus-visible`.
  - Fixed **Tablet (`768px–1023px`) Navigation**: moved the `.desktop-navigation` / `.mobile-dock` media query cutover from `1023px` to `767px` so Tablet (`>=768px`) keeps the top navigation bar visible and hides `.mobile-dock`.
  - Fixed `.mobile-dock` active icon circle top-border clipping on Mobile (`<=767px`).
- **`client/src/components/layout/Header.tsx`, `client/src/components/ui/Field.tsx`, `client/src/components/ui/Notice.tsx`**:
  - Unified English login CTA copy (`t.navLogin`), added `startAdornment`, `endAdornment`, `hintDir`, and `labelAside` support on `Field`, and refined `Notice` badge framing and contrast.

### `WP-UI2`: `HomePage.tsx` Refactor — Above-the-Fold Hero & Bilingual Alignment
- **`client/src/features/home/pages/HomePage.tsx`**:
  - Replaced fragile `[&_...]` arbitrary selector chains with clean semantic subcomponents (`HeroSection`, `BenefitsSection`, `StepsSection`, `FaqSection`, `ClosingCtaSection`, `FoundersSection`).
  - Restructured the Hero into a balanced 2-column grid (`lg:grid-cols-[1.15fr_0.95fr]`) with an inline 2-column Grade Quick-Selector (`أولى ثانوي` & `ثانية ثانوي`) alongside the framed `homeHeroImage`, ensuring headline, CTAs, artwork, and both grade buttons are 100% visible above the `900px` fold on Desktop and Tablet.
  - Fixed English LTR Founders header alignment (`text-start` instead of hardcoded `dir="ltr"` + `justify-end` / `text-end`) and localized Arabic founder role titles (`المؤسس وقائد التسويق والهوية الإبداعية` and `المؤسسان وقائدا التطوير التقني والمحتوى التعليمي`).

### `WP-UI3`: Public Catalog, Course/Package Cards & 2-Column Offer/Package Detail Pages
- **`client/src/features/catalog/components/CourseCard.tsx` & `CatalogFilterBar.tsx`**:
  - Extracted reusable `CourseCard` and fixed the broken `bg-bg/85` thumbnail badge class to `bg-canvas/95 text-ink border border-border-strong shadow-rest backdrop-blur-md` with distinct Subject and Teacher pill badges.
  - Built `CatalogFilterBar` with search icon + placeholder, 1-tap Grade Quick-Filter Pills (`كل الصفوف`, `أولى ثانوي`, `ثانية ثانوي`), 1-tap Subject chips, and a mobile collapsible `"تصفية إضافية / More filters"` disclosure (`<768px`) that keeps all 7 filter inputs mounted in the DOM while bringing course cards above the mobile fold.
- **`client/src/features/catalog/pages/PublicCatalogPage.tsx`, `OfferPage.tsx`, `client/src/features/academic/PackageCards.tsx`, `PackagePage.tsx`**:
  - Upgraded `OfferPage` and `PackagePage` to a 2-column Desktop/Tablet split (`lg:grid-cols-[1.35fr_0.85fr]`) with a sticky Enrollment & Price Action Card (`lg:sticky lg:top-24`).

### `WP-UI4`: Auth Forms, 1-Tap Student Account Workspace, Support & Guided 3-Step Financial Flows
- **`client/src/features/identity/pages/LoginPage.tsx`, `RegisterPage.tsx`, `components/StudentDetailsFields.tsx`**:
  - Start-aligned all labels, inputs, placeholders, and helper text (`text-start`) while keeping `.auth-form-header` and `<FormActions>` centered.
  - Arranged `#/register` paired fields in a responsive 2-column grid (`sm:grid-cols-2 max-w-2xl`), placed password show/hide controls inline, and fixed Arabic `#reg-password-hint` bidi punctuation (`dir={ar ? 'rtl' : 'ltr'}`).
- **`client/src/features/identity/pages/AccountWorkspace.tsx`, `AccountOverview.tsx`, `AccountProfile.tsx`, `HelpPages.tsx`**:
  - Replaced the hidden `<details>` dropdown in `AccountWorkspace` on Mobile/Tablet (`<1024px`) with an always-visible 1-tap horizontally scrollable pill strip (`data-testid="workspace-section-menu"`).
  - Elevated the `"تابع من حيث توقفت / Continue where you left off"` Resume Learning card to the top of `AccountOverview` for authenticated students and upgraded the anonymous sign-in CTA to `variant="primary"`.
  - Fixed contradictory empty-contact copy on `SupportPage` and arranged help topics into a 2-column grid (`md:grid-cols-2`).
- **`client/src/features/wallet/pages/WalletPage.tsx`, `RechargePage.tsx`, `client/src/features/purchase/pages/PurchasePage.tsx`, `PurchaseHistoryPage.tsx`**:
  - Added a 3-step visual manual recharge explanation strip on `WalletPage`, organized `RechargePage` into a 2-column desktop split with 3 numbered step cards (`١. المبلغ وطريقة التحويل`, `٢. بيانات عملية التحويل`, `٣. إرفاق صورة الإيصال`), and polished order review/receipt cards.

### `WP-UI5`: Student Learning Dashboard, Video Player Page & Notifications Inbox
- **`client/src/features/learning/components/Learning.tsx`, `pages/DashboardPage.tsx`, `pages/CourseLearningPage.tsx`, `client/src/features/notifications/pages/NotificationsPage.tsx`**:
  - Polished `SubscriptionCard` progress/expiry presentation (and fixed `text-canvas` → `text-primary-ink` contrast on primary action buttons), compacted the header above the 16:9 player on `CourseLearningPage`, and added a `border-s-4 border-s-primary` accent on unread notifications.

### `WP-UI6`: Admin Workspace, Catalog, Course Form, Recharge Triage & Assessment Authoring Refactor
- **`client/src/features/identity/pages/AdminWorkspace.tsx`, `client/src/features/academic/AdminSummaryPage.tsx`, `AdminPackagesPage.tsx`, `client/src/features/catalog/pages/AdminListPage.tsx`, `CourseForm.tsx`, `client/src/features/wallet/pages/AdminRechargePage.tsx`**:
  - Compacted `AdminWorkspace` segmented navigation header, added a structured toolbar and Subject/Teacher/Grade badges to `AdminListPage`, expanded `CourseForm` to `max-w-3xl` with side-by-side bilingual field pairs (`sm:grid-cols-2`), and upgraded `AdminRechargePage` with channel badges and a 2-column review dialog.
- **`client/src/features/assessments/AdminAssessmentPanel.tsx`**:
  - Decomposed the 1,340-line monolith into `client/src/features/assessments/components/types.ts`, `AssessmentListRow.tsx`, `ChoiceOptionsEditor.tsx`, and `CheckBuilder.tsx`, reducing `AdminAssessmentPanel.tsx` to 838 lines while preserving all `data-testid`, `data-admin-*`, and `inspectEditor` contracts.

---

## 3. Verification Evidence
- `npm --prefix client run typecheck`: **PASS** (0 errors)
- `npm --prefix client test`: **PASS** (`8/8` braces guard, `2/2` dashjs guard, **`46/46` Vitest files / `393/393` tests**)
- `npm --prefix client run build:cloudflare`: **PASS** (`client/dist` + `client/dist-ssr/entry-server.mjs` built cleanly)
- `npm --prefix server run typecheck` & `npm --prefix server run test:unit`: **PASS** (**`36/36` files / `634/634` tests**)
- `impeccable detect --json client/src`: **PASS** (`[]` — 0 findings)
- Independent browser visual verification across Desktop (`1440×900`), Tablet (`768×1024`), and Mobile (`390×844`) in Arabic RTL and English LTR, Dark and Light themes: **10/10 gates passed**.
