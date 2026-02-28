import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#070A12',
          2: '#0B1020',
          3: '#0E1630'
        }
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.06), 0 12px 40px rgba(0,0,0,0.55)'
      }
    }
  },
  plugins: []
}

export default config
