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
        // RIDENTIUM brand palette — quiet luxury
        // Source: brand identity by Emagraphic (Feb 2026)
        ivory:   { DEFAULT: '#F5F0E8', dark: '#E8E0D0' },
        stone:   { DEFAULT: '#8C7B6B', light: '#A89888', dark: '#665647' },
        obsidian:{ DEFAULT: '#18130E', mid: '#231A13', light: '#332518' },
        gold:    { DEFAULT: '#D2C6B6', light: '#E8E0D4', dim: '#9E8E7E' },
        cream:   '#F7F4EF',
        muted:   '#6B6058',
        alert:   '#C0392B',
        ok:      '#27AE60',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
      },
      boxShadow: {
        'luxury': '0 1px 3px rgba(0,0,0,0.5), 0 4px 20px rgba(0,0,0,0.3)',
        'card': '0 1px 2px rgba(0,0,0,0.4)',
      },
      borderRadius: {
        'sm': '3px',
        DEFAULT: '6px',
        'md': '8px',
        'lg': '12px',
      },
    },
  },
  plugins: [],
}

export default config
