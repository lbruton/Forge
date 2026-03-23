export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forge: {
          obsidian: '#0F172A',
          charcoal: '#1E293B',
          graphite: '#334155',
          steel: '#475569',
          amber: '#F59E0B',
          'amber-bright': '#FBBF24',
          'amber-dark': '#D97706',
          ember: '#B45309',
          terminal: '#0A0F1A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      }
    }
  },
  plugins: [],
}
