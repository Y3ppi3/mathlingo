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
        // Идентичность MathLingo — фирменный indigo/violet-градиент.
        brand: {
          DEFAULT: '#6366F1', // indigo-500
          light: '#818CF8',   // indigo-400
          dark: '#4F46E5',    // indigo-600 (hover)
          deep: '#4338CA',    // indigo-700 (нижняя «губа» 3D-кнопки)
          accent: '#8B5CF6',  // violet-500
        },
        // Палитра в духе Duolingo (тёплая, дружелюбная, «игровая»). Берём
        // структуру/сочность, но применяем спокойно — без давящих акцентов.
        // Пары *-shade — для нижней кромки объёмных кнопок и активных состояний.
        feather: { DEFAULT: '#58CC02', shade: '#46A302', light: '#89E219' }, // успех/верно
        macaw:   { DEFAULT: '#1CB0F6', shade: '#1899D6', light: '#84D8FF' }, // инфо/ссылки
        bee:     { DEFAULT: '#FFC800', shade: '#E6A400' },                   // очки/награды
        fox:     { DEFAULT: '#FF9600', shade: '#E08600' },                   // серия/огонёк
        cardinal:{ DEFAULT: '#FF4B4B', shade: '#EA2B2B' },                   // мягкая ошибка
        // Нейтральные (имена как у Duolingo — читаются осмысленно в разметке).
        swan:  '#E5E5E5',
        polar: '#F7F7F7',
        hare:  '#AFAFAF',
        wolf:  '#777777',
        eel:   '#4B4B4B',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        // Nunito — округлый дружелюбный гротеск (подключается в index.html);
        // если не загрузился, откатываемся к системным с тем же настроением.
        sans: ['Nunito', 'Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        // Мягкие «поднятые» карточки вместо жёстких теней.
        card: '0 2px 0 0 rgba(0,0,0,0.06)',
        'card-hover': '0 6px 16px -4px rgba(99,102,241,0.25)',
      },
      keyframes: {
        buttonPulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        buttonWiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        // «Впрыгивание» карточек/бейджей — мягкий overshoot, без резкости.
        popIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '60%': { transform: 'scale(1.02)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        // Плавное появление снизу — для секций/списков.
        floatUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        // Лёгкое парение маскота/иконок.
        bob: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'button-pulse': 'buttonPulse 1s ease-in-out infinite',
        'button-wiggle': 'buttonWiggle 0.5s ease-in-out',
        'pop-in': 'popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'float-up': 'floatUp 0.4s ease-out both',
        'bob': 'bob 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
