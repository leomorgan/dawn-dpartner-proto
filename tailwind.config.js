/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pipeline/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        }
      },
      spacing: {
        '0': '0px',
        '1': '8px',
        '2': '16px',
        '3': '24px',
        '4': '32px',
        '5': '40px',
        '6': '48px',
      },
      borderRadius: {
        'r0': '0px',
        'r1': '4px',
        'r2': '8px',
        'r3': '12px',
      },
      boxShadow: {
        's0': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        's1': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        's2': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      }
    },
  },
  safelist: [
    // Dynamic classes to prevent JIT purging
    'text-xl', 'text-2xl', 'text-3xl',
    'bg-brand-500', 'bg-brand-600',
    'rounded-r0', 'rounded-r1', 'rounded-r2', 'rounded-r3',
    'shadow-s0', 'shadow-s1', 'shadow-s2',
  ],
  plugins: [],
};