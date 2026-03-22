/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'checkerboard': 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
      },
      backgroundSize: {
        'checkerboard': '20px 20px',
      },
      backgroundPosition: {
        'checkerboard': '0 0, 0 10px, 10px -10px, -10px 0px',
      },
    },
  },
  plugins: [],
}
