import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./pages/**/*.{js,ts,jsx,tsx,mdx}','./components/**/*.{js,ts,jsx,tsx,mdx}','./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: { colors: {
    // ── Palette A — Light Luxury Classic (Loro Piana / Brunello Cucinelli) ──
    ivory:    { DEFAULT: '#F7F4EF', dark: '#EDE9E2' },   // main bg · sidebar bg
    stone:    { DEFAULT: '#9E8E7E', light: '#C4B8A8', dark: '#665647' },  // muted text · borders
    obsidian: { DEFAULT: '#3D2B1F', mid: '#665647', light: '#9E8E7E' },   // text hierarchy
    gold:     { DEFAULT: '#665647', light: '#7A6858', dim: '#9E8E7E' },   // accent = marrone
    cream:    '#FDFCFA',  // card surfaces
    muted:    '#9E8E7E',
    alert:    '#B91C1C',
    ok:       '#15803D',
  }, fontFamily: { sans: ['var(--font-inter)','system-ui','sans-serif'], serif: ['var(--font-cormorant)','Georgia','serif'] },
  boxShadow: { luxury: '0 2px 12px rgba(61,43,31,0.06)', card: '0 1px 4px rgba(61,43,31,0.05)' },
  borderRadius: { sm: '3px', DEFAULT: '6px', md: '8px', lg: '12px' },
  } }, plugins: [],
}
export default config