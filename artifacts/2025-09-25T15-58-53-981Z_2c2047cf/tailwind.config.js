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
      "brand": {
            "100": "#333333",
            "200": "#ffffff",
            "300": "#f8fafc",
            "400": "#1a202c"
      }
},
      spacing: {
      "0": "0px",
      "1": "8px",
      "2": "16px",
      "3": "24px",
      "4": "32px",
      "5": "40px"
},
      borderRadius: {
      "r0": "12px",
      "r1": "50%",
      "r2": "8px"
},
      boxShadow: {
      "s0": "rgba(0, 0, 0, 0.1) 0px 1px 3px 0px",
      "s1": "rgba(66, 153, 225, 0.39) 0px 4px 14px 0px"
},
      fontFamily: {
        primary: [
        "-apple-system, system-ui, Segoe UI, Roboto, sans-serif",
        "Arial"
],
      },
    },
  },
  safelist: [
    'bg-brand-100', 'bg-brand-200', 'bg-brand-300', 'bg-brand-400',
    'rounded-r0', 'rounded-r1', 'rounded-r2',
    'shadow-s0', 'shadow-s1',
  ],
  plugins: [],
};