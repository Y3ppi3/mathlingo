// src/context/AuthContext.tsx (улучшенный)
import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearLocalUserData, saveLocalUserData } from "../utils/LocalUserStorage";

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
            // Проверяем авторизацию только через API
            const response = await fetch(`${API_URL}/api/me`, {
                method: "GET",
                credentials: "include", // Отправляем куки с токеном
                headers: { "Content-Type": "application/json" },
            });

            if (response.ok) {
                // Получаем данные пользователя
                const userData = await response.json();

                // Никаких токенов в localStorage!
                // localStorage.removeItem(AUTH_TOKEN_KEY);

                // Устанавливаем состояние авторизации
                setIsAuthenticated(true);

                // Отправляем событие для обновления данных пользователя
                window.dispatchEvent(new CustomEvent('userDataUpdated', {
                    detail: userData
                }));

                return true;
            } else {
                // Если запрос не успешен, считаем пользователя не авторизованным
                setIsAuthenticated(false);
                return false;
            }
        } catch (error) {
            console.error("Ошибка проверки авторизации:", error);
            setIsAuthenticated(false);
            return false;
        }
    };

    // Функция входа пользователя
    const login = async (userData?: UserData): Promise<void> => {
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

            // Отправляем запрос на сервер (если не в режиме разработки)
            if (process.env.NODE_ENV !== 'development') {
                await fetch(`${API_URL}/api/logout/`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                });
            } else {
                console.log('Выход из системы в режиме разработки (без API-запроса)');
            }

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