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
        // ── Palette brand RIDENTIUM (da immagine coordinata Emagraphic) ──────
        //
        //  Crema avorio originale:  #F7F4EF  (usato per le card)
        //  Taupe caldo:             #D2C6B6  (bordi, toni medi)
        //  Bruno scuro:             #665647  (sidebar, testo primario)
        //
        // Aggiunte per accessibilità e leggibilità:
        //  Greige (body):           #E5DDD2  — meno abbagliante del puro avorio
        //  Testo scuro:             #3D2F24  — quasi-espresso, contrasto elevato
        //  Testo medio:             #7A6858  — secondario leggibile

        ivory:    {
          DEFAULT: '#F7F4EF',   // card background (brand cream)
          dark:    '#E5DDD2',   // body background (greige caldo, non abbaglia)
        },
        stone:    {
          DEFAULT: '#D2C6B6',   // brand taupe
          light:   '#E4DDD4',
          dark:    '#7A6858',   // testo secondario leggibile
        },
        obsidian: {
          DEFAULT: '#3D2F24',   // testo primario (quasi-espresso, molto leggibile)
          mid:     '#665647',   // brand brown (sidebar, accenti)
          light:   '#7A6858',   // testo secondario
        },
        gold:     { DEFAULT: '#C9A84C', light: '#E2C97E', dim: '#8C6F2C' },
        cream:    '#F7F4EF',
        muted:    '#7A6858',
        alert:    '#C0392B',
        ok:       '#27AE60',
      },
      fontFamily: {
        sans:  ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
      },
      boxShadow: {
        luxury: '0 1px 3px rgba(61,47,36,0.10), 0 4px 16px rgba(61,47,36,0.06)',
        card:   '0 1px 3px rgba(61,47,36,0.08), 0 1px 2px rgba(61,47,36,0.04)',
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
