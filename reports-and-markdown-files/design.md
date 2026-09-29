# Education Platform — Design v1

Status: initial Stitch concept plus the owner's M4 dark-theme clarification. Branding remains provisional. This is a UI design specification, not production React code or completed backend integration.

## Project
Stitch project: Education Platform — Arabic-first UI v1
Project ID: 12072480276288747342
Review URL: https://stitch.withgoogle.com/projects/12072480276288747342

## Product and tone
An Egyptian recorded-programming-course platform. Exactly student and admin roles. Arabic is primary, English secondary. Both content translations are mandatory. Use the neutral working name "منصة التعلم" / "Learning Platform"; this is placeholder branding, not a chosen business name.
Create a focused, warm, credible learning experience: generous whitespace, strong typography, clear next actions, purposeful code illustrations. Avoid childish school graphics, neon gradients, invented ratings/testimonials, fake certifications or exaggerated user statistics.

## Provisional visual tokens
| Token | Value | Usage |
| --- | --- | --- |
| Primary | #0F766E | Main actions, selected navigation |
| Primary hover | #115E59 | Hover/pressed |
| Ink/navy | #142D4E | Headlines, navigation, player surround |
| Background | #F7F9FC | App canvas |
| Surface | #FFFFFF | Cards, forms, panels |
| Muted text | #526176 | Supporting copy |
| Border | #DCE3EC | Inputs, dividers |
| Accent | #F2B84B | Small learning accents, never white text background |
| Success | #166534 on #DCFCE7 | Approved/active |
| Pending | #92400E on #FEF3C7 | Awaiting review |
| Error | #B91C1C on #FEE2E2 | Failed/rejected/expired |
Use semantic tokens so owner color changes apply globally. Never rely on color alone for state. Contrast must be verified on final export, not assumed.

## M4 theme and visual direction

Dark mode is the default experience. Keep an accessible light alternative and
an explicit theme control; persist only the non-sensitive UI preference (never
auth/session data) and apply it before first paint to avoid a theme flash.

Use a calm, modern developer-learning aesthetic: deep navy rather than pure
black, crisp teal actions, restrained amber highlights, layered surfaces,
strong typography and generous spacing. Avoid neon gradients, excessive glow,
glass effects that reduce legibility, decorative dashboard clutter and color-
only status communication.

Dark semantic palette:

| Token | Value | Usage |
| --- | --- | --- |
| Canvas | `#08111F` | Main application background |
| Surface | `#0F1B2D` | Cards, forms and sidebars |
| Elevated | `#16243A` | Dialogs, menus and selected panels |
| Primary | `#2DD4BF` | Primary actions and selected navigation |
| Primary hover | `#5EEAD4` | Hover/focus emphasis |
| Text | `#F8FAFC` | Primary text and headings |
| Muted text | `#A8B3C7` | Supporting copy |
| Border | `#2A3A52` | Inputs, separators and card edges |
| Accent | `#FBBF24` | Small learning/payment highlights |
| Focus | `#67E8F9` | Keyboard focus ring |
| Success | `#6EE7B7` on `#0B3B2E` | Approved/active |
| Pending | `#FCD34D` on `#3B2F0B` | Awaiting review |
| Error | `#FDA4AF` on `#4C1822` | Failed/rejected/expired |

The light theme uses the existing semantic roles with a softer `#F4F7FB`
canvas, white surfaces, `#0F172A` text, teal primary actions and slate borders.
Both themes must meet WCAG AA contrast for normal text and controls. Define
theme values once as CSS variables consumed by Tailwind semantic utilities;
do not scatter raw palette classes through feature pages.

## Typography and bilingual layout
Arabic font: Noto Sans Arabic or equivalent readable Arabic family; Latin: Inter. Arabic body 16px with 1.75 line height; Latin body 16px/1.5. Headings 32–48px desktop and 26–32px mobile. Labels 14px minimum where possible. No letter spacing on Arabic.
Arabic pages use lang=ar and RTL, right-aligned content and a right sidebar. English pages use lang=en and LTR with mirrored navigation. Keep code snippets, email addresses and references LTR inside Arabic layouts. Explicit language switch العربية / English.
Money is labeled EGP or ج.م; no dollars. Dates and prices are sample content, not approved prices/duration policy.

## Layout and components
Desktop canvas around 1440px, maximum main content 1200px; 12-column grid, 24px gaps. Mobile 390px, 16px gutters, single column, at least 44px tap targets.
Spacing scale 4/8/12/16/24/32/48/64px. Cards 12px radius, fields/buttons 8px, thin borders and restrained shadows. Primary actions solid teal with white text. Secondary actions white with teal border/text.
Shared components: bilingual header, student/admin sidebars, course offer card, duration badge, wallet summary, status badge, labeled field, upload area, progress bar, lesson row, data table and confirmation dialog.
Code-themed course artwork; no video-security infrastructure jargon in student screens. Only show loading/empty/error/success states relevant to the task.

## Requested v1 screen coverage
1. Arabic desktop public course discovery: concise hero, search, programming-topic filters, course offers and clear prices/durations. Do not show protected lesson/segment lists before subscription.
2. Arabic course offer and wallet purchase review: example 600 EGP / 90 days clearly illustrative; access starts at purchase. Zero balance routes to wallet recharge. No recurring billing.
3. Arabic student dashboard: continue course, active subscription expiry, course progress and renewal-required example. No live class schedule.
4. Arabic wallet/recharge: balance, manual transfer instructions placeholder, amount/reference/proof submission, pending review history. Submission does not credit money. Admin approval only credits wallet, not automatic purchase.
5. Arabic subscribed lesson player: 16:9 player, subtle masked watermark illustration, protected lesson list, progress and expiry information. Expired state stops playback and offers renewal. No claim that watermark prevents screen capture.
6. Arabic admin recharge review: pending requests, proof preview, verified receipt confirmation, approve/reject and audit summary. Demo identities/receipts only.
7. Arabic admin course editor: required Arabic/English title/description tabs, price and fixed duration, lesson ordering, original-video upload and processing/ready status. External DRM is API-only; design adds no new role.
8. English desktop counterpart for course discovery.
9. Arabic mobile course discovery.
10. Arabic mobile wallet/recharge.

## Interaction rules
Student: choose offer -> insufficient funds -> submit recharge -> pending verification -> admin approval -> wallet credited -> explicit purchase -> active course -> lessons -> expiry/renewal required.
Admin: verify actual transfer receipt independently -> approve request once -> audit credit. Proof alone must never imply automatic credit.
Course metadata and purchased terms must be clear. Production plan duration is an integer number of days; sample numbers remain illustrative. No credit-card checkout, automatic payment gateway, instructor role, live teaching or certificates.
Video originals are handled through external DRM; platform stores identifiers/readiness. DRM/R2/security internals are not exposed as student UI choices.
Authentication screens use the confirmed policy: registration collects both email and phone; login accepts either identifier plus password. Public registration never offers a role selector. Password recovery and identifier-verification screens remain deferred until a delivery channel is approved.
Pending/rejected empty/error states should be documented even where only the primary screen is rendered.

## Engineering handoff
Use the reviewed Stitch designs as visual references for the existing React/TypeScript frontend. Do not replace the architecture, add backend features from decorative UI, modify DRM, or treat generated HTML as production integration.
Platform authentication uses protected cookies; the mockup does not establish authentication or payment behavior.
Preserve accessible labels, keyboard focus, logical tab order, reduced-motion support and responsive behavior. Verify Arabic shaping, mixed-direction strings and contrast after export.
The owner will review and tune colors inside Stitch before final visual implementation. After their edits, re-read the Stitch design system and synchronize this file rather than overwriting their choices.

## Review checklist
- Clear manual recharge/purchase distinction and visible pending status.
- No lesson-list leak before subscription.
- Subscription expiry is visible; expired player is blocked.
- Arabic primary, English counterpart and mobile adaptation are coherent.
- Admin bilingual requirements and review controls are understandable.
- Placeholder data, brand and palette remain editable.
- Designs are a first visual pass; production functionality and runtime/accessibility tests are not claimed.
