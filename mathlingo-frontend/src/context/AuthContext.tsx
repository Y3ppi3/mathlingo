// src/context/AuthContext.tsx (улучшенный)
import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearLocalUserData, saveLocalUserData } from "../utils/LocalUserStorage";
import { api } from "../api/studentApi";

// Интерфейс для данных пользователя
interface UserData {
    id: number;
    username: string;
    email: string;
    avatarId?: number;
}

// Интерфейс для контекста аутентификации
interface AuthContextType {
    isAuthenticated: boolean | null;
    login: (userData?: UserData) => Promise<void>;
    logout: () => Promise<void>;
    refreshAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Получаем базовый URL API из переменной окружения
const API_URL = import.meta.env.VITE_API_URL;

// Ключ для хранения токена в localStorage
const AUTH_TOKEN_KEY = 'mathlingo_auth_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const checkAuth = async () => {
            // Сначала проверяем localStorage на наличие данных пользователя
            // для быстрого восстановления состояния
            const hasUserData = localStorage.getItem('user_username') !== null &&
                localStorage.getItem('user_id') !== null;

            if (hasUserData) {
                // Если есть данные пользователя, считаем его авторизованным
                // без лишнего запроса к API
                console.log("✅ Найдены локальные данные пользователя, устанавливаем isAuthenticated=true");
                setIsAuthenticated(true);
            }

            // Всё равно запускаем полную проверку для синхронизации с сервером
            const result = await refreshAuth();
            console.log(`Проверка аутентификации: ${result ? 'авторизован' : 'не авторизован'}`);
        };

        checkAuth();
    }, []);

    // Функция обновления статуса аутентификации
    // Изменить логику проверки авторизации и получения данных пользователя

    const refreshAuth = async (): Promise<boolean> => {
        try {
            // Через общий axios-инстанс (не raw fetch) — его перехватчик в
            // api/studentApi.ts читает заголовок X-CSRF-Token из ответа и
            // сохраняет его для последующих мутирующих запросов (submit-
            // answer, submit-attempt и т.д.). Raw fetch() этот заголовок
            // просто отбрасывал: токен на сервере выпускался на каждый
            // /api/me, но фронтенд его никогда не читал — из-за этого
            // ПЕРВЫЙ мутирующий запрос в сессии (например, первая же
            // сыгранная игра) молча падал с 403 "CSRF-токен отсутствует",
            // проглоченным в .catch(console.error) вызывающих компонентов.
            const response = await api.get("/api/me");
            const userData = response.data;

            setIsAuthenticated(true);
            window.dispatchEvent(new CustomEvent('userDataUpdated', {
                detail: userData
            }));
            return true;
        } catch {
            // 401 (не авторизован) и сетевые ошибки — тот же исход, что и
            // раньше при response.ok === false: считаем пользователя не
            // авторизованным.
            setIsAuthenticated(false);
            return false;
        }
    };

    // Функция входа пользователя
    const login = async (userData?: UserData): Promise<void> => {
        // Login.tsx логинится через raw fetch (не через общий axios-инстанс
        // api), а /api/login/ в любом случае не выдаёт CSRF-токен — это
        // делает только GET /api/me. Без этого вызова токен подхватывался
        // бы только на первом мутирующем запросе (submit-attempt) через
        // retry в studentApi.ts — рабочий, но лишний лишний круг с 403 в
        // логах сразу после входа.
        api.get('/api/me').catch(() => {});

        return new Promise<void>((resolve) => {
            setIsAuthenticated(true);

            // Если предоставлены данные пользователя, сохраняем их
            if (userData && process.env.NODE_ENV === 'development') {
                console.log('Сохранение данных пользователя при входе:', userData);
                saveLocalUserData(userData);

                // Сохраняем токен (временное решение для разработки)
                localStorage.setItem(AUTH_TOKEN_KEY, 'dev_token');
            }

            // Используем setTimeout, чтобы дать состоянию обновиться перед навигацией
            setTimeout(() => {
                resolve();
            }, 100);
        });
    };

    // Функция выхода пользователя
    const logout = async (): Promise<void> => {
        try {
            // Очищаем локальное хранилище
            clearLocalUserData();
            localStorage.removeItem(AUTH_TOKEN_KEY);

            // Запрос на сервер обязателен в любом окружении — httpOnly
            // cookie "token" может удалить только бэкенд (JS её не видит).
            // Раньше в dev-режиме этот вызов пропускался, из-за чего
            // реальная сессия на сервере не завершалась: после "выхода"
            // куки оставались валидными, и следующая полная перезагрузка
            // страницы снова аутентифицировала пользователя (найдено как
            // баг — https://.../404 после logout вело в /profile).
            await fetch(`${API_URL}/api/logout/`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
            });

            setIsAuthenticated(false);
            navigate("/login");
        } catch (error) {
            console.error("Ошибка при выходе:", error);

            // Даже при ошибке, считаем пользователя вышедшим
            clearLocalUserData();
            localStorage.removeItem(AUTH_TOKEN_KEY);
            setIsAuthenticated(false);
            navigate("/login");
        }
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout, refreshAuth }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}