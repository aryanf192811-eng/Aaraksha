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
          DEFAULT: '#f8faf9',
          dim: '#f1f5f3',
          bright: '#ffffff',
          container: {
            lowest: '#ffffff',
            low: '#f8faf9',
            DEFAULT: '#f1f5f3',
            high: '#e2e8e5',
            highest: '#cbd5d1',
          },
        },
        'on-surface': '#0f1f1c',
        'on-surface-variant': '#5b6b66',
        outline: '#8a9a95',
        'outline-variant': '#dde5e2',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // Volunteer Portal primary — teal/green, distinct from tourist's
        // amber, govt's slate, and guardian's own neutral scheme, so the
        // app visually reads as its own persona (the citizen responder,
        // not a traveler and not an official).
        primary: {
          DEFAULT: '#0f766e',  // teal-700
          dark:    '#134e4a',  // teal-900
          light:   '#f0fdfa',  // teal-50
          foreground: '#ffffff',
        },
        sos: { DEFAULT: '#ef4444', light: '#fee2e2', dark: '#dc2626' },
        safe:    '#22c55e',
        warning: '#f59e0b',
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
        'fade-in':  'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
