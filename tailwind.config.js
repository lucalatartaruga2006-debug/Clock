/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        horror: ['"Creepster"', 'cursive'],
        clock: ['"Share Tech Mono"', 'monospace'],
      },
      colors: { ink: '#0a0a0f', blood: '#7a0e0e', bone: '#e8e2d0', rust: '#8a4a1a', gold: '#d4a017', luck: '#3a8a5a', divine: '#e8d44a' },
      animation: {
        flicker: 'flicker 0.15s infinite',
        breathe: 'breathe 3s ease-in-out infinite',
        vibrate: 'vibrate 0.08s linear infinite',
      },
      keyframes: {
        flicker: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.2' } },
        breathe: { '0%,100%': { opacity: '0.85' }, '50%': { opacity: '1' } },
        vibrate: {
          '0%': { transform: 'translate(0,0)' },
          '25%': { transform: 'translate(-2px,1px)' },
          '50%': { transform: 'translate(2px,-1px)' },
          '75%': { transform: 'translate(-1px,-1px)' },
          '100%': { transform: 'translate(1px,1px)' },
        },
      },
    },
  },
  plugins: [],
}
