# Education Platform — Design v1

Owner academic clarification, 2026-10-01: [D27's academic catalog/access contract](m8-school-catalog-contract.md) governs subsequent M8 discovery and course editing. Lead with first/second secondary selection; first secondary has two terms; each teaching month is a course, revisions are distinct and three-month packages contain three specific courses. ADMIN-selectable access is duration-based or until term/year end; never label package membership as an automatic 90-day duration. Earlier generic demo courses are historical visual examples.

Status: the owner approved the FAYQ identity and supplied brand board on 2026-09-30. Earlier Stitch layouts remain historical references; the FAYQ system below governs current visual implementation. This is a UI specification, not a backend contract.

Owner clarification, 2026-10-01: the target audience is ages **15–18**. The owner requests a whole-site redesign, a floating mobile bottom dock like the supplied navigation reference, the FAYQ logo from the supplied board, and realistic dummy content for isolated testing/landing review. [The M8 redesign brief](m8-design/website-redesign-brief.md) specifies the new page structures and navigation direction while retaining the FAYQ brand and approved business contracts. Its [prototype](m8-design/preview.html) is review material, not implemented application behavior. This later direction governs the M8 redesign over older layout examples below; it does not approve decorative features from the board.

## FAYQ owner-approved direction (2026-09-30)

- Product name: `FAYQ` in both languages.
- English slogan: `Learn It. Code It. Get It.`
- Arabic slogan: `تعلمها. برمجها. حققها.`
- Palette: Forest `#0F1F12`, Lime `#C9F24D`, Amber `#F7B500`, Cream `#F8F7EE`, Charcoal `#2E2E2E`.
- Latin display face: Plus Jakarta Sans; Latin body/UI: Inter; Arabic: Noto Sans Arabic.
- Personality: young, modern, supportive, motivating and trustworthy.

The supplied brand board is visual direction, not a production background and not authorization for invented AI-assistant, certification, testimonial, rating or live-class features. Text remains accessible HTML. Dark remains the default with a complete warm-cream light theme. Lime and amber filled controls use forest/dark text.

## Project
Stitch project: Education Platform — Arabic-first UI v1
Project ID: 12072480276288747342
Review URL: https://stitch.withgoogle.com/projects/12072480276288747342

## Product and tone
An Egyptian recorded-programming-course platform. Exactly student and admin roles. Arabic is primary, English secondary. Both content translations are mandatory. Use the approved product name `FAYQ`; the former neutral working name is retired from user-visible UI.
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

## Current theme and visual direction

Dark mode is the default experience. Keep an accessible light alternative and
an explicit theme control; persist only the non-sensitive UI preference (never
auth/session data) and apply it before first paint to avoid a theme flash.

Use a calm, modern developer-learning aesthetic: deep forest rather than pure
black, lime actions, restrained amber highlights, layered surfaces,
strong typography and generous spacing. Avoid neon gradients, excessive glow,
glass effects that reduce legibility, decorative dashboard clutter and color-
only status communication.

Dark semantic palette:

| Token | Value | Usage |
| --- | --- | --- |
| Canvas | `#0B140E` | Main application background |
| Surface | `#12241A` | Cards, forms and sidebars |
| Elevated | `#1A3123` | Dialogs, menus and selected panels |
| Primary | `#C9F24D` | Primary actions and selected navigation |
| Primary hover | `#B7E244` | Hover/focus emphasis |
| Text | `#F8F7EE` | Primary text and headings |
| Muted text | `#B7C2B0` | Supporting copy |
| Border | `#2C4232` | Inputs, separators and card edges |
| Accent | `#F7B500` | Small learning/payment highlights |
| Focus | `#C9F24D` | Keyboard focus ring |
| Success | `#8FE3A8` on `#0E2A1A` | Approved/active |
| Pending | `#FCD34D` on `#3B2F0B` | Awaiting review |
| Error | `#FDA4AF` on `#4C1822` | Failed/rejected/expired |

The light theme is a first-class FAYQ experience, not a simple inversion. It
uses a warm `#F5F3E8` canvas, `#FFFEF9` surfaces, forest `#0F1F12` text,
dark-green `#365314` text accents, lime-filled actions with forest text, and
warm neutral borders. Lime must not be used for normal text on cream or white;
reserve it for filled actions, focus emphasis, decorative rules and dark
surfaces.
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

## Owner clarification — optional course expiry (2026-10-01)

The owner explicitly clarified that a course may remain accessible after purchase without any expiry, until permanent removal by ADMIN. This supersedes the earlier mandatory-duration wording for M8 standalone offers. ADMIN chooses DURATION, TERM_END, YEAR_END or UNTIL_REMOVAL explicitly. UNTIL_REMOVAL stores a null expiry, not a fabricated distant date. Existing paid terms are immutable; later offer changes apply only to new purchases. Indefinite access dominates finite grants, produces no subscription-expiry notification and must not trigger expiry-based playback termination. Publication/archive/deletion protection and the external DRM API-only boundary still apply. Packages retain the previously approved one shared ADMIN-set deadline.

The owner also confirmed: SECOND_SECONDARY has terms 1 and 2; packages may contain unpublished monthly courses with clear presale labels and no viewing before publication; overlapping ownership warns without blocking package purchase; repeat standalone purchases with a fixed deadline are permitted only when they add access. Existing indefinite access prevents redundant standalone payment. These answers resolve the corresponding pending owner questions; historical proposals remain historical.

Acceptance: nullable-expiry migration preserves finite records; guarded offer creation/edit, one debit and idempotent replay; immutable indefinite purchase snapshot; indefinite entitlement despite expired finite rows; no expiry notice or termination; unpublished package purchase without content leakage; fixed-deadline extension/no-extension cases; bilingual admin/student access labels.
