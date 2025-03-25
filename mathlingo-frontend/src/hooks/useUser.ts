// src/hooks/useUser.ts
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getLocalUserData, updateLocalUserData } from '../utils/LocalUserStorage';

interface User {
    id: number;
    username: string;
    email: string;
    avatarId?: number;
}

export function useUser() {
    const { isAuthenticated } = useAuth();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Получаем URL аватарки по ID
    const getAvatarUrl = (avatarId?: number) => {
        return avatarId ? `/avatars/${avatarId}.png` : undefined;
    };

    useEffect(() => {
        const fetchUser = async () => {
            if (!isAuthenticated) {
                setUser(null);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const API_URL = import.meta.env.VITE_API_URL;

                // Проверяем локальное хранилище в режиме разработки
                if (process.env.NODE_ENV === 'development') {
                    const localUserData = getLocalUserData();
                    if (localUserData) {
                        console.log('Данные пользователя загружены из локального хранилища:', localUserData);
                        setUser(localUserData);
                        setError(null);
                        setLoading(false);
                        return;
                    }
                }

                // Если локальных данных нет или мы не в режиме разработки, запрашиваем с сервера
                try {
                    const response = await fetch(`${API_URL}/api/me`, {
                        method: "GET",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                    });

                    if (response.ok) {
                        const userData = await response.json();
                        setUser(userData);
                        setError(null);
                    } else {
                        // Попытка использовать временные тестовые данные в режиме разработки
                        if (process.env.NODE_ENV === 'development') {
                            console.log('Используем тестовые данные пользователя');
                            const testUser = {
                                id: 1,
                                username: "Тестовый пользователь",
                                email: "test@example.com",
                                avatarId: 1
                            };
                            setUser(testUser);
                            // Сохраняем в локальное хранилище
                            updateLocalUserData(testUser);
                            setError(null);
                        } else {
                            setUser(null);
                            setError('Не удалось загрузить данные пользователя');
                        }
                    }
                } catch (err) {
                    // Если не можем подключиться к серверу в режиме разработки, создаем тестового пользователя
                    if (process.env.NODE_ENV === 'development') {
                        console.log('Не удалось подключиться к серверу, используем тестовые данные');
                        const testUser = {
                            id: 1,
                            username: "Тестовый пользователь",
                            email: "test@example.com",
                            avatarId: 1
                        };
                        setUser(testUser);
                        // Сохраняем в локальное хранилище
                        updateLocalUserData(testUser);
                        setError(null);
                    } else {
                        setUser(null);
                        setError('Произошла ошибка при загрузке данных пользователя');
                        console.error(err);
                    }
                }
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [isAuthenticated]);

    // Функция для обновления данных пользователя
    const updateUserProfile = async (data: {username?: string, avatarId?: number}) => {
        if (!user) {
            throw new Error("Пользователь не авторизован");
        }

        try {
            const API_URL = import.meta.env.VITE_API_URL;

            console.log("Отправка обновления профиля:", data);

            // Для тестирования, добавим задержку, чтобы имитировать запрос к серверу
            // и сразу обновим локальные данные
            if (process.env.NODE_ENV === 'development') {
                await new Promise(resolve => setTimeout(resolve, 500));

                // В режиме разработки обновляем данные без фактического API запроса
                // Это временное решение пока backend не готов
                const updatedUser = updateLocalUserData(data);
                console.log("Локальное обновление пользователя:", updatedUser);
                setUser(updatedUser);

                return { success: true };
            }

            // Реальный API запрос (будет использоваться, когда backend будет готов)
            const response = await fetch(`${API_URL}/api/me/update`, {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || "Не удалось обновить профиль");
            }

            // Принудительно обновляем пользователя из серверного ответа или делаем новый запрос
            try {
                const userData = await response.json();
                setUser(userData);
            } catch (e) {
                // Если не удалось получить данные из ответа, делаем новый запрос для получения обновленных данных
                const userResponse = await fetch(`${API_URL}/api/me`, {
                    method: "GET",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                });

                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    setUser(userData);
                }
            }

            return { success: true };
        } catch (err) {
            console.error("Ошибка при обновлении профиля:", err);
            throw err;
        }
    };

    return {
        user,
        loading,
        error,
        getAvatarUrl,
        updateUserProfile
    };
}