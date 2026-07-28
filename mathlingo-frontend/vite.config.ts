import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // host: true — vite слушает на всех сетевых интерфейсах (0.0.0.0), а не
    // только на localhost. Это открывает дев-сервер для устройств в локальной
    // сети (телефон/планшет по http://<IP-компа>:5173). Бэкенд (:8000) уже
    // слушает 0.0.0.0 через uvicorn. Адрес API фронт выводит сам из хоста
    // страницы — см. src/config/apiBase.ts.
    host: true,
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    clearMocks: true,
  },
})
