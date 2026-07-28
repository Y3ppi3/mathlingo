// src/config/apiBase.ts
// Единый источник базового адреса бэкенда.
//
// Порядок разрешения:
//   1. Явный VITE_API_URL — для продакшена и особых случаев.
//   2. Авто-вывод из хоста, с которого открыта страница.
//   3. Локальный fallback.
//
// Пункт 2 — это и есть фикс доступа по локальной сети (LAN): когда страницу
// открывают с телефона по http://192.168.x.x:5173, API автоматически
// становится http://192.168.x.x:8000 — без правки конфигов под каждую машину.
// Раньше зашитый localhost:8000 на телефоне указывал на сам телефон, и
// запросы (а с ними и вход) молча не проходили.
function resolveApiBase(): string {
    const explicit = import.meta.env.VITE_API_URL?.trim();
    if (explicit) return explicit.replace(/\/+$/, '');

    if (typeof window !== 'undefined' && window.location?.hostname) {
        const { protocol, hostname } = window.location;
        return `${protocol}//${hostname}:8000`;
    }

    return 'http://localhost:8000';
}

export const API_BASE = resolveApiBase();
