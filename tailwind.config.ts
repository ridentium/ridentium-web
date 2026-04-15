import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── RIDENTIUM Palette Ufficiale Brand ──────────────────────────────
        // Fonte: Immagine Coordinata, marzo 2026 (Emagraphic)
        //
        //  #F7F4EF  Crema avorio   — sfondo principale, superfici chiare
        //  #D2C6B6  Taupe caldo    — bordi, toni medi, testo secondario
        //  #665647  Bruno scuro    — sidebar, testo primario, accenti scuri
        //
        // Il gold (#C9A84C) viene mantenuto solo per CTA/accenti interattivi

        ivory:    { DEFAULT: '#F7F4EF', dark: '#EDE8DF' },   // crema avorio brand
        stone:    { DEFAULT: '#D2C6B6', light: '#E4DDD4', dark: '#8C7D6C' }, // taupe brand
        obsidian: { DEFAULT: '#665647', mid: '#574839', light: '#7A6858' },  // bruno brand
        gold:     { DEFAULT: '#C9A84C', light: '#E2C97E', dim: '#8C6F2C' },  // accento CTA
        cream:    '#F7F4EF',   // alias per ivory
        muted:    '#8C7D6C',   // testo secondario (tra taupe e bruno)
        alert:    '#C0392B',
        ok:       '#27AE60',
      },
      fontFamily: {
        sans:  ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
      },
      boxShadow: {
        luxury: '0 1px 3px rgba(102,86,71,0.12), 0 4px 16px rgba(102,86,71,0.08)',
        card:   '0 1px 3px rgba(102,86,71,0.07), 0 1px 2px rgba(102,86,71,0.05)',
      },
      borderRadius: {
        sm:      '3px',
        DEFAULT: '6px',
        md:      '8px',
        lg:      '12px',
      },
    },
  },
  plugins: [],
}

export default config
