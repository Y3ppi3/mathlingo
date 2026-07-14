/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class', // Можно переключать тему через класс .dark
  theme: {
    extend: {
      colors: {
        // Синхронизировано с фактически используемым градиентом
        // (indigo-500 -> violet-500) на Login/Register/Dashboard — раньше
        // здесь были другие значения, которые нигде не применялись (R4).
        brand: {
          DEFAULT: '#6366F1', // indigo-500
          light: '#818CF8',   // indigo-400
          dark: '#4F46E5',    // indigo-600 (hover)
          accent: '#8B5CF6',  // violet-500
        }
      },
      // Добавляем кастомные keyframes для анимаций
      keyframes: {
        // Анимация пульсации: кнопка слегка увеличивается и возвращается к исходному размеру
        buttonPulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        // Анимация покачивания: кнопка слегка покачивается влево-вправо
        buttonWiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
      // Определяем имена анимаций с указанием продолжительности и easing-функций
      animation: {
        'button-pulse': 'buttonPulse 1s ease-in-out infinite',
        'button-wiggle': 'buttonWiggle 0.5s ease-in-out',
      },
    },
  },
  plugins: [],
};