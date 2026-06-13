import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#04050e',
          secondary: '#0c0f24',
          tertiary: '#111428',
        },
        txt: {
          DEFAULT: '#e2e8f0',
          dim: '#94a3b8',
          faint: '#64748b',
        },
        accent: {
          lavender: '#a78bfa',
          sky: '#38bdf8',
          mint: '#34d399',
          rose: '#fb7185',
          amber: '#fbbf24',
          teal: '#2dd4bf',
        },
        border: {
          DEFAULT: '#1e293b',
          light: '#334155',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(56, 189, 248, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(167, 139, 250, 0.5)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      },
      boxShadow: {
        'glow-lg': '0 0 40px rgba(56, 189, 248, 0.2)',
        'glow-xl': '0 0 80px rgba(167, 139, 250, 0.15)',
        'inner-glow': 'inset 0 0 40px rgba(56, 189, 248, 0.1)',
      },
    },
  },
  plugins: [],
};

export default config;