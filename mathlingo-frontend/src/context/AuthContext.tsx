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
    const refreshAuth = async (): Promise<boolean> => {
        try {
            // Проверяем наличие данных пользователя в localStorage
            const hasUserData = localStorage.getItem('user_username') !== null &&
                localStorage.getItem('user_id') !== null;

            // Проверяем наличие токена в localStorage
            const token = localStorage.getItem(AUTH_TOKEN_KEY);

            // Если нет ни токена, ни данных пользователя - считаем неавторизованным
            if (!token && !hasUserData) {
                console.log("❌ Нет токена и данных пользователя, устанавливаем isAuthenticated=false");
                setIsAuthenticated(false);
                return false;
            }

            // Делаем запрос к API для проверки актуальности сессии
            const response = await fetch(`${API_URL}/api/me`, {
                method: "GET",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
            });

            if (response.ok) {
                // Получаем актуальные данные пользователя
                const userData = await response.json();

                // Обновляем localStorage
                localStorage.setItem('user_username', userData.username);
                localStorage.setItem('user_id', userData.id.toString());
                localStorage.setItem('user_email', userData.email);
                if (userData.avatarId !== undefined) {
                    localStorage.setItem('user_avatar_id', userData.avatarId?.toString() || '');
                }

                // Устанавливаем статус аутентификации
                setIsAuthenticated(true);

                // Событие для обновления данных пользователя в других компонентах
                window.dispatchEvent(new CustomEvent('userDataUpdated', {
                    detail: userData
                }));

                return true;
            } else {
                // В режиме разработки, если нет ответа от сервера,
                // но есть данные в localStorage - считаем авторизованным
                if (process.env.NODE_ENV === 'development' && hasUserData) {
                    console.log("⚠️ Сервер недоступен, но есть локальные данные, сохраняем авторизацию");
                    setIsAuthenticated(true);
                    return true;
                }

                // Иначе сбрасываем авторизацию
                localStorage.removeItem(AUTH_TOKEN_KEY);
                setIsAuthenticated(false);
                return false;
            }
        } catch (error) {
            console.error("❌ Ошибка проверки авторизации:", error);

            // В режиме разработки, если есть данные пользователя,
            // сохраняем авторизацию даже при ошибке
            if (process.env.NODE_ENV === 'development' &&
                localStorage.getItem('user_username') !== null) {
                console.log("⚠️ Ошибка проверки авторизации, но есть локальные данные");
                setIsAuthenticated(true);
                return true;
            }

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