/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#080c14',
        'bg-secondary': '#0a0f1e',
        'bg-surface': '#0d1626',
        'bg-card': '#0f1a2e',
        'border-dim': '#1a2a4a',
        'border-bright': '#1e3a6e',
        'accent': '#00d4ff',
        'accent-dim': '#0066cc',
        'accent-muted': 'rgba(0,212,255,0.15)',
        'zeus-green': '#00ff88',
        'zeus-red': '#ff3366',
        'zeus-yellow': '#ffcc00',
        'zeus-purple': '#a855f7',
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'fade-up': 'fade-up 0.3s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'ping-slow': 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
        'scan': 'scan 3s linear infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%,100%': { boxShadow: '0 0 8px rgba(0,212,255,0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(0,212,255,0.5), 0 0 40px rgba(0,212,255,0.2)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
    },
  },
  plugins: [],
};
