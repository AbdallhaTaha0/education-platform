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
        primary: { DEFAULT: '#0F766E', hover: '#115E59' },
        ink: '#142D4E',
        canvas: '#F7F9FC',
        surface: '#FFFFFF',
        muted: '#526176',
        border: '#DCE3EC',
        accent: '#F2B84B',
        success: { fg: '#166534', bg: '#DCFCE7' },
        pending: { fg: '#92400E', bg: '#FEF3C7' },
        error: { fg: '#B91C1C', bg: '#FEE2E2' },
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
