/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#f8fafc',
          dim: '#f1f5f9',
          bright: '#ffffff',
          container: {
            lowest: '#ffffff',
            low: '#f8fafc',
            DEFAULT: '#f1f5f9',
            high: '#e2e8f0',
            highest: '#cbd5e1',
          },
        },
        'on-surface': '#0f172a',
        'on-surface-variant': '#64748b',
        outline: '#94a3b8',
        'outline-variant': '#e2e8f0',
        // shadcn/ui semantic tokens — CSS-variable driven (see index.css).
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // Guardian Portal primary — neutral slate. Drama comes from status
        // colors (SOS red, safe green) reading clearly against a calm
        // backdrop, not from a colorful brand primary competing with them.
        primary: {
          DEFAULT: '#0f172a',  // slate-900
          dark:    '#020617',  // slate-950
          light:   '#f1f5f9',  // slate-100
          foreground: '#ffffff',
        },
        // Safety colors
        sos: {
          DEFAULT: '#ef4444',   // red-500
          light:   '#fee2e2',   // red-50
          dark:    '#dc2626',   // red-600
        },
        safe:    '#22c55e',     // green-500
        warning: '#f59e0b',     // amber-500
        // TSI badge colors
        tsi: {
          low:      '#15803d', // green-700
          moderate: '#a16207', // yellow-700
          high:     '#c2410c', // orange-700
          extreme:  '#b91c1c', // red-700
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        full: '9999px',
      },
      animation: {
        'sos-pulse': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'sos-ping':  'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
        'fade-in':   'fadeIn 0.3s ease-out',
        'slide-up':  'slideUp 0.3s ease-out',
        'scale-in':  'scaleIn 0.2s ease-out',
        'shimmer':   'shimmer 1.5s infinite',
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: 0, transform: 'scale(0.95)' }, to: { opacity: 1, transform: 'scale(1)' } },
        pulseRing: {
          '0%':   { transform: 'scale(0.8)', opacity: '0.5' },
          '80%, 100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },
      backgroundImage: {
        'shimmer-gradient': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
