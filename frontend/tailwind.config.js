/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A1128',
        card: '#16203A',
        primary: '#00E5FF',
        textMain: '#F3F4F6'
      }
    },
  },
  plugins: [],
}
