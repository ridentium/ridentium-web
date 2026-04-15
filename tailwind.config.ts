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
        // Palette brand RIDENTIUM (Emagraphic, marzo 2026)
        // #F7F4EF crema avorio  #D2C6B6 taupe  #665647 bruno
        // Modifiche per accessibilità: testo primario portato a quasi-nero caldo
        ivory:    { DEFAULT: '#F7F4EF', dark: '#E5DDD2' },
        stone:    { DEFAULT: '#D2C6B6', light: '#E4DDD4', dark: '#8C7D6C' },
        obsidian: {
          DEFAULT: '#1E1408',   // quasi-nero caldo — testo primario (ratio 14:1 su ivory)
          mid:     '#3D2F24',   // espresso — testo corpo (ratio 9:1)
          light:   '#665647',   // brand brown — testo secondario (ratio 5:1)
        },
        gold:  { DEFAULT: '#C9A84C', light: '#E2C97E', dim: '#8C6F2C' },
        cream: '#F7F4EF',
        muted: '#7A6858',
        alert: '#C0392B',
        ok:    '#27AE60',
      },
      fontFamily: {
        sans:  ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
      },
      boxShadow: {
        luxury: '0 1px 3px rgba(30,20,8,0.12), 0 4px 16px rgba(30,20,8,0.07)',
        card:   '0 1px 4px rgba(30,20,8,0.09), 0 1px 2px rgba(30,20,8,0.05)',
      },
      borderRadius: {
        sm: '3px', DEFAULT: '6px', md: '8px', lg: '12px',
      },
    },
  },
  plugins: [],
}

export default config