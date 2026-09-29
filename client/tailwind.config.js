/** Tailwind v3 pinned toolchain (local build, no CDN).
 * Semantic tokens mirror reports-and-markdown-files/design.md provisional palette.
 * Colors stay centrally defined here so owner review revises one file.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: 'var(--color-primary)', hover: 'var(--color-primary-hover)', strong: 'var(--color-primary-strong)' },
        ink: 'var(--color-ink)',
        canvas: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        elevated: 'var(--color-elevated)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        focus: 'var(--color-focus)',
        success: { fg: 'var(--color-success-fg)', bg: 'var(--color-success-bg)' },
        pending: { fg: 'var(--color-pending-fg)', bg: 'var(--color-pending-bg)' },
        error: { fg: 'var(--color-error-fg)', bg: 'var(--color-error-bg)' },
      },
      fontFamily: {
        arabic: ['"Noto Sans Arabic"', '"Segoe UI"', 'Tahoma', 'Arial', 'sans-serif'],
        latin: ['Inter', '"Segoe UI"', 'Arial', 'sans-serif'],
      },
      borderRadius: { card: '12px', control: '8px' },
      boxShadow: {
        rest: '0 1px 2px rgb(20 45 78 / 0.06), 0 4px 16px rgb(20 45 78 / 0.06)',
      },
      maxWidth: { content: '1200px' },
    },
  },
  plugins: [],
};
