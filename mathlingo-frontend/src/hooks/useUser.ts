// src/hooks/useUser.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
// Импортируем функции из исправленного LocalUserStorage
import {
    getLocalUserData,
    updateLocalUserData,
    USER_EVENTS
} from '../utils/LocalUserStorage';

interface User {
    id: number;
    username: string;
    email: string;
    avatarId?: number;
}

// Вспомогательная функция для повторных попыток запроса
const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
    let lastError: Error | unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 секунд таймаут

            const fetchOptions = {
                ...options,
                signal: controller.signal
            };

            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            return response;
        } catch (err) {
            console.warn(`Попытка ${attempt}/${maxRetries} не удалась:`, err);
            lastError = err;

            if (attempt < maxRetries) {
                // Экспоненциальная задержка между попытками
                const delayMs = 1000 * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    throw lastError || new Error('Все попытки запроса не удались');
};

export function useUser() {
    const { isAuthenticated } = useAuth();
    const [user, setUser] = useState<User | null>(getLocalUserData()); // Инициализируем сразу из хранилища
    const [loading, setLoading] = useState<boolean>(false);  // Начинаем с false если уже есть данные
    const [error, setError] = useState<string | null>(null);
    const [forceUpdate, setForceUpdate] = useState<number>(0);

    // Используем ref для отслеживания активных запросов
    const activeRequestRef = useRef<AbortController | null>(null);
    const isMountedRef = useRef<boolean>(true);

    // Функция получения данных пользователя
    const fetchUser = useCallback(async () => {
        if (!isAuthenticated) {
            setUser(null);
            setLoading(false);
            return null;
        }

        // Отменяем предыдущий запрос, если он есть
        if (activeRequestRef.current) {
            activeRequestRef.current.abort();
            activeRequestRef.current = null;
        }

        try {
            setLoading(true);
            const API_URL = import.meta.env.VITE_API_URL;

            // Сначала проверяем localStorage
            const localUserData = getLocalUserData();
            if (localUserData) {
                console.log('✅ Данные пользователя загружены из localStorage:', localUserData);
                setUser(localUserData);
                setError(null);
                setLoading(false);
                return localUserData;
            }

            // Создаем новый контроллер для запроса
            const controller = new AbortController();
            activeRequestRef.current = controller;

            try {
                // Используем функцию fetchWithRetry для надежности
                const response = await fetchWithRetry(`${API_URL}/api/me`, {
                    method: "GET",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    signal: controller.signal
                });

                // Проверяем, что компонент все еще смонтирован
                if (!isMountedRef.current) return null;

                if (response.ok) {
                    const userData = await response.json();
                    console.log('✅ Получены данные пользователя от сервера:', userData);

                    if (!isMountedRef.current) return null;

                    // Сохраняем полученные данные через updateLocalUserData
                    updateLocalUserData(userData);
                    setUser(userData);
                    setError(null);
                    return userData;
                } else {
                    // Проверка режима разработки...
                    if (process.env.NODE_ENV === 'development') {
                        console.log('⚠️ Сервер недоступен, используем тестовые данные');
                        const testUser = {
                            id: 1,
                            username: "Тестовый пользователь",
                            email: "test@example.com",
                            avatarId: 1
                        };

                        if (!isMountedRef.current) return null;

                        updateLocalUserData(testUser);
                        setUser(testUser);
                        setError(null);
                        return testUser;
                    } else {
                        setUser(null);
                        setError('Не удалось загрузить данные пользователя');
                        return null;
                    }
                }
            } catch (err: any) {
                // Если запрос был отменен, не обрабатываем ошибку
                if (err.name === 'AbortError') {
                    console.log('Запрос был отменен');
                    return null;
                }

                console.error('❌ Ошибка API:', err);

                if (!isMountedRef.current) return null;

                // Аналогично в случае ошибки в режиме разработки
                if (process.env.NODE_ENV === 'development') {
                    const testUser = {
                        id: 1,
                        username: "Тестовый пользователь",
                        email: "test@example.com",
                        avatarId: 1
                    };
                    updateLocalUserData(testUser);
                    setUser(testUser);
                    setError(null);
                    return testUser;
                } else {
                    setError('Произошла ошибка при загрузке данных пользователя');
                    return null;
                }
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
            activeRequestRef.current = null;
        }
    }, [isAuthenticated, forceUpdate]);

    // Функция обновления данных пользователя с дебаунсом
    const updateDebounceTimer = useRef<NodeJS.Timeout | null>(null);

    const updateUserProfile = useCallback(async (data: {username?: string, avatarId?: number | null}) => {
        if (!user) {
            throw new Error("Пользователь не авторизован");
        }

        // Отменяем предыдущий таймер, если он есть
        if (updateDebounceTimer.current) {
            clearTimeout(updateDebounceTimer.current);
            updateDebounceTimer.current = null;
        }

        return new Promise((resolve, reject) => {
            // Устанавливаем небольшую задержку перед отправкой (дебаунс)
            updateDebounceTimer.current = setTimeout(async () => {
                // Отменяем предыдущий запрос, если он есть
                if (activeRequestRef.current) {
                    activeRequestRef.current.abort();
                }

                const controller = new AbortController();
                activeRequestRef.current = controller;

                try {
                    console.log("📝 Отправка обновления профиля:", data);
                    const API_URL = import.meta.env.VITE_API_URL;

                    const response = await fetchWithRetry(`${API_URL}/api/me/update`, {
                        method: "PUT",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(data),
                        signal: controller.signal
                    });

                    if (!isMountedRef.current) {
                        resolve({ success: false, canceled: true });
                        return;
                    }

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || "Не удалось обновить профиль");
                    }

                    // Получаем обновленные данные из ответа
                    const updatedUserData = await response.json();
                    console.log('✅ Получены обновленные данные:', updatedUserData);

                    if (!isMountedRef.current) {
                        resolve({ success: false, canceled: true });
                        return;
                    }

                    // Обновляем данные через updateLocalUserData
                    updateLocalUserData(updatedUserData);

                    // Обновляем состояние компонента
                    setUser(updatedUserData);

                    // Принудительно запускаем обновление компонентов
                    setForceUpdate(prev => prev + 1);

                    resolve({ success: true, data: updatedUserData });
                } catch (err: any) {
                    if (err.name === 'AbortError') {
                        console.log('Запрос был отменен');
                        resolve({ success: false, canceled: true });
                        return;
                    }

                    console.error("❌ Ошибка при обновлении профиля:", err);
                    reject(err);
                } finally {
                    activeRequestRef.current = null;
                    updateDebounceTimer.current = null;
                }
            }, 300); // 300мс дебаунс
        });
    }, [user]);

    // Слушаем события обновления данных пользователя
    useEffect(() => {
        const handleUserDataUpdate = (event: Event) => {
            const customEvent = event as CustomEvent<User>;
            setUser(customEvent.detail);
        };

        window.addEventListener(USER_EVENTS.DATA_UPDATED, handleUserDataUpdate);

        return () => {
            window.removeEventListener(USER_EVENTS.DATA_UPDATED, handleUserDataUpdate);
        };
    }, []);

    // Загружаем данные при монтировании
    useEffect(() => {
        isMountedRef.current = true;

        // Если у нас нет данных пользователя и пользователь авторизован, загружаем их
        if (!user && isAuthenticated) {
            fetchUser();
        }

        return () => {
            isMountedRef.current = false;

            // Отменяем активные запросы при размонтировании
            if (activeRequestRef.current) {
                activeRequestRef.current.abort();
                activeRequestRef.current = null;
            }

            // Очищаем таймер дебаунса
            if (updateDebounceTimer.current) {
                clearTimeout(updateDebounceTimer.current);
                updateDebounceTimer.current = null;
            }
        };
    }, [fetchUser, isAuthenticated, user]);

    // Доступный извне метод для принудительного обновления данных
    const refreshUserData = useCallback(async () => {
        const userData = await fetchUser();
        if (userData) {
            setForceUpdate(prev => prev + 1);
        }
        return userData;
    }, [fetchUser]);

    return {
        user,
        loading,
        error,
        getAvatarUrl: (avatarId?: number) => avatarId ? `/avatars/${avatarId}.png` : undefined,
        updateUserProfile,
        refreshUserData
    };
}