/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Nunito', 'system-ui', 'sans-serif'],
        caps: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        brand: '0 8px 30px -8px rgba(6, 78, 59, 0.25)',
        'brand-lg': '0 12px 40px -10px rgba(6, 78, 59, 0.3)',
      },
    },
  },
  plugins: [],
};
