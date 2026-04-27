import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FAF6F1',
          100: '#F2E9DC',
          200: '#E3CEB4',
          300: '#CEAE87',
          400: '#B88E60',
          500: '#9B6F42',
          600: '#7D5632',
          700: '#5E3F24',
          800: '#3E2917',
          900: '#1F140B',
        },
        neutral: {
          50: '#F8F9FA',
          100: '#F1F3F5',
          200: '#E9ECEF',
          300: '#CED4DA',
          400: '#ADB5BD',
          500: '#6C757D',
          600: '#495057',
          700: '#343A40',
          800: '#212529',
          900: '#0D0F12',
        },
        success: {
          50: '#F0FBF4',
          500: '#22863A',
          700: '#145A25',
        },
        warning: {
          50: '#FFFBEA',
          500: '#D97706',
          700: '#92400E',
        },
        danger: {
          50: '#FFF5F5',
          500: '#DC2626',
          700: '#991B1B',
        },
        info: {
          50: '#EFF6FF',
          500: '#2563EB',
          700: '#1D4ED8',
        },
      },
      fontFamily: {
        heading: [
          '"Plus Jakarta Sans"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        body: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        // Override Tailwind default sans with Inter
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 1px 2px rgba(20, 14, 8, 0.06)',
        md: '0 4px 8px rgba(20, 14, 8, 0.08), 0 1px 3px rgba(20, 14, 8, 0.05)',
        lg: '0 12px 24px rgba(20, 14, 8, 0.10), 0 4px 8px rgba(20, 14, 8, 0.06)',
        'focus-brand': '0 0 0 3px rgba(125, 86, 50, 0.35)',
        'focus-danger': '0 0 0 3px rgba(220, 38, 38, 0.30)',
      },
      transitionDuration: {
        fast: '100ms',
        base: '150ms',
        slow: '250ms',
      },
      maxWidth: {
        narrow: '640px',
        content: '960px',
        wide: '1280px',
      },
    },
  },
  plugins: [],
};

export default config;
