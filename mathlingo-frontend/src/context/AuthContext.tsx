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

    // Проверка аутентификации при загрузке компонента
    useEffect(() => {
        const checkAuth = async () => {
            const result = await refreshAuth();
            console.log(`Проверка аутентификации: ${result ? 'авторизован' : 'не авторизован'}`);
        };

        checkAuth();
    }, []);

    // Функция обновления статуса аутентификации
    const refreshAuth = async (): Promise<boolean> => {
        try {
            // Проверяем наличие токена в localStorage для оптимизации запросов
            const token = localStorage.getItem(AUTH_TOKEN_KEY);

            // Если в режиме разработки и нет токена, считаем неавторизованным
            if (process.env.NODE_ENV === 'development' && !token) {
                setIsAuthenticated(false);
                return false;
            }

            const response = await fetch(`${API_URL}/api/me`, {
                method: "GET",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
            });

            if (response.ok) {
                // Получаем информацию о пользователе
                const userData = await response.json();

                // В режиме разработки сохраняем данные в localStorage
                if (process.env.NODE_ENV === 'development') {
                    saveLocalUserData(userData);
                }

                // Сохраняем токен для оптимизации запросов
                if (token) {
                    localStorage.setItem(AUTH_TOKEN_KEY, token);
                }

                setIsAuthenticated(true);
                return true;
            } else {
                // Если запрос не успешен, удаляем токен и считаем неавторизованным
                localStorage.removeItem(AUTH_TOKEN_KEY);
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