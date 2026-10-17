import type { Config } from 'tailwindcss';

/**
 * Tokens taken from the easytrip mark itself: the navy of the wordmark, the
 * blue at the top of the pin and the green of the road as it opens out.
 *
 * Navy is the only interactive colour. Sky and grass are states a vehicle can
 * be in, so they appear where a state is being reported and nowhere else.
 * Neutrals are cooled towards the blue so nothing on screen reads grey-beige.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surface ladder: the page, the panels on it, the recesses in them.
        canvas: '#F1F5F9',
        surface: '#FFFFFF',
        sunken: '#E8EEF5',
        navy: {
          DEFAULT: '#0E2748',
          soft: '#1B3A63',
          deep: '#081A33',
        },
        ink: '#14243A',
        muted: '#5B6F87',
        faint: '#8E9FB3',
        line: {
          DEFAULT: '#DFE6EE',
          strong: '#C9D4E0',
        },
        sky: {
          DEFAULT: '#0B8BEE',
          soft: '#E6F2FD',
          deep: '#0A6FD0',
        },
        grass: {
          DEFAULT: '#16A02E',
          soft: '#E6F5E9',
          deep: '#0F7D23',
        },
        status: {
          available: '#16A02E',
          assigned: '#0B8BEE',
          reserved: '#7A5AF8',
          maintenance: '#B36F00',
          damaged: '#C4502A',
          accident: '#D0342C',
          inactive: '#5F7288',
        },
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        xs: ['0.75rem', { lineHeight: '1.05rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg: ['1.0625rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em' }],
        xl: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.02em' }],
        '2xl': ['1.75rem', { lineHeight: '2.1rem', letterSpacing: '-0.025em' }],
        '3xl': ['2.5rem', { lineHeight: '2.75rem', letterSpacing: '-0.03em' }],
        '4xl': ['3.25rem', { lineHeight: '3.4rem', letterSpacing: '-0.035em' }],
      },
      // One shape system: controls 8px, panels 12px, sheets 16px, chips 6px.
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        // Panels sit flat; a hover lifts by a hair; only overlays float.
        lift: '0 1px 0 rgba(14, 39, 72, 0.04), 0 2px 6px -2px rgba(14, 39, 72, 0.12)',
        pop: '0 0 0 1px rgba(14, 39, 72, 0.06), 0 14px 36px -12px rgba(14, 39, 72, 0.32)',
        ring: '0 0 0 1px rgba(14, 39, 72, 0.08)',
      },
      backgroundImage: {
        road: 'linear-gradient(100deg, #0B8BEE 0%, #1493C8 45%, #16A02E 100%)',
      },
      maxWidth: {
        prose: '64ch',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.18s ease-out',
        'accordion-up': 'accordion-up 0.18s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
