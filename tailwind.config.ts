import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./pages/**/*.{js,ts,jsx,tsx,mdx}','./components/**/*.{js,ts,jsx,tsx,mdx}','./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: { colors: {
    ivory:    { DEFAULT: '#4A3B2C', dark: '#2C2018' },
    stone:    { DEFAULT: '#D2C6B6', light: '#E4DDD4', dark: '#A0907E' },
    obsidian: { DEFAULT: '#F2EDE4', mid: '#D2C6B6', light: '#7A6858' },
    gold:  { DEFAULT: '#C9A84C', light: '#E2C97E', dim: '#8C6F2C' },
    cream: '#F2EDE4', muted: '#A0907E', alert: '#E05545', ok: '#3DB87A',
  }, fontFamily: { sans: ['var(--font-inter)','system-ui','sans-serif'], serif: ['var(--font-cormorant)','Georgia','serif'] },
  boxShadow: { luxury: '0 2px 8px rgba(0,0,0,0.4)', card: '0 1px 4px rgba(0,0,0,0.35)' },
  borderRadius: { sm: '3px', DEFAULT: '6px', md: '8px', lg: '12px' },
  } }, plugins: [],
}
export default config