export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef4ff',
          100: '#d9e4ff',
          200: '#b9ccfa',
          300: '#8aa9f2',
          400: '#5a7fe6',
          500: '#3b5bd8',
          600: '#2f49b8',
          700: '#273d96',
          800: '#1e3573',
          900: '#162754',
          950: '#0f1b3d',
        },
        gold: {
          50: '#fff9e8',
          100: '#ffefc2',
          200: '#ffdf8a',
          300: '#ffc94d',
          400: '#faad1b',
          500: '#db8b0b',
          600: '#b96e07',
          700: '#934f09',
          800: '#7a400e',
          900: '#67350f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 24px rgba(15, 27, 61, 0.08)',
        hover: '0 12px 40px rgba(15, 27, 61, 0.16)',
      },
    },
  },
  plugins: [],
}