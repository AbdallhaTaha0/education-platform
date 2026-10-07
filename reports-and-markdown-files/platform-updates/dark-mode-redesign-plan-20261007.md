# Dark-mode redesign plan — 2026-10-07

Owner requested a plan because dark-mode colors blend together, then chose **charcoal backgrounds with FAYQ lime accents**. Planning only: no application changes, Docker rebuild, preview update or commit/push in this task. This direction supersedes forest-tinted backgrounds for the proposed dark redesign; the FAYQ logo, lime/amber identity, typography and complete light alternative remain.

## What the source review shows

- `client/src/styles.css` currently uses canvas `#0B140E`, surface `#12241A`, elevated `#1A3123`, interactive `#223A2B`: similar forest shades across almost everything.
- Cards, inputs, secondary buttons, tab panels and several navigation surfaces reuse `surface`. An input on a surface card has identical fill, making its boundary depend on a faint border.
- Current surface/canvas contrast is about 1.15:1; normal border/surface is about 1.49:1; sampled muted text/surface is about 8.78:1. These are calculations from declared solid colors, not a live whole-site accessibility audit. Decorative surfaces do not have a universal 3:1 requirement, but essential control boundaries/state indicators must be distinguishable.
- The roster uses the same elevated fill for selection and hover, though selection also has a lime edge. Shared control styles rely partly on opacity for disabled states. Fixing base colors alone will not establish a consistent interaction hierarchy.

## Proposed palette and hierarchy

Starting values to verify on actual rendered components; these are not a completed contrast certification.

| Role | Proposed value | Use |
|---|---|---|
| Canvas | `#101318` | Page background |
| Surface | `#1B2028` | Cards, sidebar, grouped content |
| Elevated | `#29313D` | Dialogs, menus, raised panels |
| Field | `#11151B` | Inputs and search inside cards |
| Hover | `#343E4B` | Brief pointer feedback |
| Selected | `#303A24` | Restrained lime-tinted selection plus edge/check marker |
| Subtle border | `#3B4553` | Decorative dividers and card edges |
| Control border | `#747B86` | Essential field/control boundaries |
| Main text | `#F4F6F8` | Headings and body |
| Secondary text | `#B5BDC8` | Labels, explanations and metadata |
| Primary action | `#C9F24D` | Save, subscribe, Run, send; dark label |
| Primary label | `#0F1F12` | Text/icons on lime |

Only one visual role per layer: page → card → darker field; card → brighter overlay. Avoid many nested card borders. Use spacing, headings and dividers where a new panel adds no meaning. Do not compensate with heavy shadows/glow.

Lime emphasizes the main task and active markers; secondary actions use charcoal with a visible outline, supporting text stays neutral. Green success, amber pending, red error and a proposed blue informational treatment remain distinct and always include labels/icons. Final status values and all hover/pressed/focus pairs require measurement. Disabled controls get explicit muted fills/labels without looking enabled; do not dim an entire content group through opacity.

## Implementation sequence

1. **Baseline and theme map.** Capture representative current ADMIN and STUDENT screens in Arabic/English on desktop/mobile. Inventory semantic token usage, hardcoded colors, translucent fills and nested same-color surfaces. Include native select/autofill, popovers, confirmation/error dialogs and loading/empty states. Record measured computed colors, not assumptions from comments.
2. **Central tokens.** Define charcoal layers and dedicated field, hover, selected, control-border and disabled roles in `styles.css`; map them in `tailwind.config.js`. Supply explicit light-theme counterparts for any new roles so shared components do not inherit dark values. Retain the current theme preference and before-first-paint behavior.
3. **Shared components.** Apply the hierarchy to buttons, fields, cards, SectionTabs, navigation/sidebar/mobile dock, tables/rows, badges, notices, menus and dialogs. Differentiate default/hover/selected/focus/disabled states. Focus remains an obvious ring with sufficient contrast and separation. Essential controls must be identifiable without relying on hover.
4. **Page pass.** First ADMIN course editing, student rosters/reports and student dashboard/course learning; then catalog, checkout/free enrollment, wallet/recharge, account/auth/support, assessments and all IDE modes. Verify code syntax, editor/console backgrounds, selection and output states separately. Player overlay/control contrast remains appropriate over video frames and fullscreen; changing the site palette must not weaken watermark/control visibility.
5. **Verification and review.** Run affected Docker checks and full TypeScript/browser/SSR build. Use Chromium for desktop and mobile, Arabic RTL and English LTR, dark mode and light regression checks. Present before/after captures for the same content and routes. Update the owner local preview after the planned implementation is authorized and verified; no production deployment follows from this plan.

## Acceptance criteria

- A user can distinguish page/card/field/overlay layers and locate the primary action at a glance. Nested surfaces are purposeful and remain clear without shadows.
- Normal text, placeholders and supporting text meet at least 4.5:1; qualifying large text meets 3:1. Essential control boundaries, meaningful icons and state indicators meet 3:1 against adjacent colors, with compliant applicable exceptions assessed explicitly. Decorative card edges need not all be bright. Sources: [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- Hover and selected states are visually distinct; selected/current status also has a marker or label. Focus is keyboard-visible, not clipped or obscured. Disabled controls remain legible and distinguishable, despite their WCAG contrast exemption.
- Status, navigation and actions remain understandable in grayscale. Lime is restrained and does not dominate every surface.
- No invisible dropdown/autofill text, unreadable IDE selections, theme flash, horizontal overflow or mobile action clipping. Existing controls retain their accessible names, keyboard operation and usable tap targets.
- Light mode and business behavior remain correct. No changes to permissions, payments, reports, view counts, course access or external DRM integration are required.

## Deliverables and boundaries

Central palette and component state specification; consistent shared styles; verified route coverage; before/after images; measured contrast evidence; Docker test/build/browser results and a change report. Update `design.md` during authorized implementation to reflect the selected charcoal direction and retire conflicting historical visual rules.

Verification stacks must be separately named. Inspect exact labels, every mount, network endpoints and volume ownership before removing only owned disposable resources after success/failure/stop. Preserve local preview/database/cache, external DRM, reusable images and saved evidence. No global prune.
