/** Tailwind v3 pinned toolchain (local build, no CDN).
 * Semantic tokens mirror the FAYQ identity (forest / lime / amber / cream /
 * charcoal). Colors stay centrally defined in styles.css so owner review
 * revises one file; this config only maps roles to those variables.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          pressed: 'var(--color-primary-pressed)',
          strong: 'var(--color-primary-strong)',
          ink: 'var(--color-primary-ink)',
        },
        forest: 'var(--fayq-forest)',
        lime: 'var(--fayq-lime)',
        amber: 'var(--fayq-amber)',
        cream: 'var(--fayq-cream)',
        charcoal: 'var(--fayq-charcoal)',
        ink: 'var(--color-ink)',
        canvas: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        elevated: 'var(--color-elevated)',
        interactive: 'var(--color-interactive)',
        muted: 'var(--color-muted)',
        border: { DEFAULT: 'var(--color-border)', strong: 'var(--color-border-strong)' },
        accent: { DEFAULT: 'var(--color-accent)', ink: 'var(--color-accent-ink)' },
        focus: 'var(--color-focus)',
        success: { fg: 'var(--color-success-fg)', bg: 'var(--color-success-bg)' },
        pending: { fg: 'var(--color-pending-fg)', bg: 'var(--color-pending-bg)' },
        error: { fg: 'var(--color-error-fg)', bg: 'var(--color-error-bg)' },
        info: { fg: 'var(--color-info-fg)', bg: 'var(--color-info-bg)' },
        player: { DEFAULT: 'var(--color-player)', text: 'var(--color-player-text)' },
        scrim: 'var(--color-scrim)',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'Inter', '"Segoe UI"', 'Arial', 'sans-serif'],
        arabic: ['"Noto Sans Arabic"', '"Segoe UI"', 'Tahoma', 'Arial', 'sans-serif'],
        latin: ['Inter', '"Segoe UI"', 'Arial', 'sans-serif'],
      },
      borderRadius: { card: '12px', control: '8px' },
      boxShadow: {
        rest: 'var(--shadow-rest)',
        lift: 'var(--shadow-lift)',
      },
      maxWidth: { content: '1200px' },
    },
  },
  plugins: [],
};
