/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Matches the Stitch design system: Inter (900 weight) for display/
        // headline roles, native system-ui stack for body copy — both for
        // performance and because it's the "familiar on mobile" choice
        // called out in the design system's typography rationale.
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        // One family for everything, varying only weight/size — matching
        // how SF Pro is actually used on iOS (Apple never pairs a second
        // display face against it). An earlier pass paired Plus Jakarta
        // Sans for headlines against Inter for body; reverted, since
        // mixing two grotesks is exactly what reads as "not quite Apple."
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Material-style surface/container scale from the Stitch design
        // system — kept neutral (slate-based) rather than importing its
        // auto-generated blue-tinted M3 hex noise, so it reads consistently
        // with the existing amber/slate brand instead of introducing a
        // second, competing neutral palette.
        surface: {
          DEFAULT: '#f8fafc',       // slate-50 — page canvas
          dim: '#f1f5f9',           // slate-100
          bright: '#ffffff',
          container: {
            lowest: '#ffffff',
            low: '#f8fafc',         // slate-50
            DEFAULT: '#f1f5f9',     // slate-100
            high: '#e2e8f0',        // slate-200
            highest: '#cbd5e1',     // slate-300
          },
        },
        'on-surface': '#0f172a',         // slate-900
        'on-surface-variant': '#64748b', // slate-500
        outline: '#94a3b8',              // slate-400
        'outline-variant': '#e2e8f0',    // slate-200
        // shadcn/ui semantic tokens — CSS-variable driven (see index.css).
        // Kept separate from our brand `primary` below, which stays a
        // literal hex rather than a themeable variable.
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

        // Tourist PWA primary — amber
        primary: {
          DEFAULT: '#f59e0b',  // amber-500
          dark:    '#d97706',  // amber-600
          light:   '#fef3c7', // amber-100
          foreground: '#1c1917',
        },
        // Safety colors
        sos: {
          DEFAULT: '#ef4444',   // red-500
          light:   '#fee2e2',   // red-50
          dark:    '#dc2626',   // red-600
        },
        safe:    '#22c55e',     // green-500
        warning: '#f59e0b',     // amber-500
        // Second brand accent — trust/civic-safety moments (route lines,
        // "explore" tags, the safety panel) get their own hue so they read
        // as distinct from the amber "discovery/inspiration" moments
        // instead of competing for the same color's attention.
        trust: {
          DEFAULT: '#0d9488', // teal-600
          dark:    '#115e59', // teal-800
          light:   '#ccfbf1', // teal-100
        },
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
        'float':     'float 7s ease-in-out infinite',
        'float-slow':'float 11s ease-in-out infinite',
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        'pulse-ring-delayed': 'pulseRing 2s cubic-bezier(0.215, 0.61, 0.355, 1) 1s infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        pulseRing: {
          '0%':   { transform: 'scale(0.8)', opacity: '0.6' },
          '80%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: 0, transform: 'scale(0.95)' }, to: { opacity: 1, transform: 'scale(1)' } },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%':      { transform: 'translate3d(0, -14px, 0)' },
        },
      },
      backgroundImage: {
        'shimmer-gradient': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
      },
      boxShadow: {
        glass:      '0 8px 32px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.5)',
        'glass-lg': '0 24px 64px -12px rgba(15, 23, 42, 0.18), inset 0 1px 0 rgba(255,255,255,0.4)',
        'glow-amber': '0 8px 40px -8px rgba(245, 158, 11, 0.45)',
        'glow-teal': '0 8px 40px -8px rgba(13, 148, 136, 0.45)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
