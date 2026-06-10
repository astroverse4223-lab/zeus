export const THEMES = {
  zeus: {
    name: 'Zeus',
    subtitle: 'Cyan · Navy',
    description: 'The original',
    swatches: ['#00d4ff', '#0066cc', '#080c14'],
    vars: {
      '--c-bg':        '#080c14',
      '--c-surface':   '#0a0f1e',
      '--c-card':      '#0d1626',
      '--c-border':    '#1a2a4a',
      '--c-border-hi': '#1e3a6e',
      '--c-accent':    '#00d4ff',
      '--c-accent2':   '#0066cc',
      '--c-glow':      'rgba(0,212,255,0.15)',
      '--c-glow-hi':   'rgba(0,212,255,0.35)',
      '--c-grid':      'rgba(0,212,255,0.025)',
    },
  },

  matrix: {
    name: 'Matrix',
    subtitle: 'Green · Black',
    description: 'Hacker mode',
    swatches: ['#00ff41', '#00cc33', '#020a02'],
    vars: {
      '--c-bg':        '#020a02',
      '--c-surface':   '#050f05',
      '--c-card':      '#071407',
      '--c-border':    '#0a2a0a',
      '--c-border-hi': '#0f3f0f',
      '--c-accent':    '#00ff41',
      '--c-accent2':   '#00cc33',
      '--c-glow':      'rgba(0,255,65,0.15)',
      '--c-glow-hi':   'rgba(0,255,65,0.35)',
      '--c-grid':      'rgba(0,255,65,0.025)',
    },
  },

  crimson: {
    name: 'Crimson',
    subtitle: 'Red · Dark',
    description: 'Aggressive power',
    swatches: ['#ff3366', '#cc0033', '#100508'],
    vars: {
      '--c-bg':        '#100508',
      '--c-surface':   '#180a10',
      '--c-card':      '#1e0d15',
      '--c-border':    '#3a1020',
      '--c-border-hi': '#5a1830',
      '--c-accent':    '#ff3366',
      '--c-accent2':   '#cc0033',
      '--c-glow':      'rgba(255,51,102,0.15)',
      '--c-glow-hi':   'rgba(255,51,102,0.35)',
      '--c-grid':      'rgba(255,51,102,0.025)',
    },
  },

  aurora: {
    name: 'Aurora',
    subtitle: 'Purple · Midnight',
    description: 'Ethereal glow',
    swatches: ['#c084fc', '#7c3aed', '#08050f'],
    vars: {
      '--c-bg':        '#08050f',
      '--c-surface':   '#0e0818',
      '--c-card':      '#130c22',
      '--c-border':    '#2a1545',
      '--c-border-hi': '#3d1f6e',
      '--c-accent':    '#c084fc',
      '--c-accent2':   '#7c3aed',
      '--c-glow':      'rgba(192,132,252,0.15)',
      '--c-glow-hi':   'rgba(192,132,252,0.35)',
      '--c-grid':      'rgba(192,132,252,0.025)',
    },
  },

  phantom: {
    name: 'Phantom',
    subtitle: 'Silver · Black',
    description: 'Stealth minimal',
    swatches: ['#e2e8f0', '#94a3b8', '#050505'],
    vars: {
      '--c-bg':        '#050505',
      '--c-surface':   '#0a0a0a',
      '--c-card':      '#101010',
      '--c-border':    '#1f1f1f',
      '--c-border-hi': '#2e2e2e',
      '--c-accent':    '#e2e8f0',
      '--c-accent2':   '#94a3b8',
      '--c-glow':      'rgba(226,232,240,0.1)',
      '--c-glow-hi':   'rgba(226,232,240,0.25)',
      '--c-grid':      'rgba(226,232,240,0.02)',
    },
  },

  solar: {
    name: 'Solar',
    subtitle: 'Amber · Dark',
    description: 'Warm power',
    swatches: ['#fbbf24', '#d97706', '#0a0800'],
    vars: {
      '--c-bg':        '#0a0800',
      '--c-surface':   '#100e02',
      '--c-card':      '#181404',
      '--c-border':    '#2a2008',
      '--c-border-hi': '#3d3010',
      '--c-accent':    '#fbbf24',
      '--c-accent2':   '#d97706',
      '--c-glow':      'rgba(251,191,36,0.15)',
      '--c-glow-hi':   'rgba(251,191,36,0.35)',
      '--c-grid':      'rgba(251,191,36,0.025)',
    },
  },

  neon: {
    name: 'Neon',
    subtitle: 'Magenta · Black',
    description: 'Cyberpunk',
    swatches: ['#ff00ff', '#cc00cc', '#030305'],
    vars: {
      '--c-bg':        '#030305',
      '--c-surface':   '#060609',
      '--c-card':      '#0a0a10',
      '--c-border':    '#1a0a2a',
      '--c-border-hi': '#2a0f3f',
      '--c-accent':    '#ff00ff',
      '--c-accent2':   '#cc00cc',
      '--c-glow':      'rgba(255,0,255,0.15)',
      '--c-glow-hi':   'rgba(255,0,255,0.35)',
      '--c-grid':      'rgba(255,0,255,0.025)',
    },
  },

  ice: {
    name: 'Ice',
    subtitle: 'Sky Blue · Deep Dark',
    description: 'Crystal cold',
    swatches: ['#67e8f9', '#0ea5e9', '#040d14'],
    vars: {
      '--c-bg':        '#040d14',
      '--c-surface':   '#071422',
      '--c-card':      '#0a1c30',
      '--c-border':    '#102a40',
      '--c-border-hi': '#154060',
      '--c-accent':    '#67e8f9',
      '--c-accent2':   '#0ea5e9',
      '--c-glow':      'rgba(103,232,249,0.15)',
      '--c-glow-hi':   'rgba(103,232,249,0.35)',
      '--c-grid':      'rgba(103,232,249,0.025)',
    },
  },
};

export function applyTheme(name) {
  const theme = THEMES[name] || THEMES.zeus;
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

export const THEME_NAMES = Object.keys(THEMES);
