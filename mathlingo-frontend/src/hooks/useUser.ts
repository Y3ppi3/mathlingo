// src/hooks/useUser.ts - улучшенная версия
import { useState, useEffect, useCallback } from 'react';
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

    // Функция получения данных пользователя, которая будет вызываться при
    // монтировании компонента и при обновлении пользовательских данных
    const fetchUser = useCallback(async () => {
        if (!isAuthenticated) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const API_URL = import.meta.env.VITE_API_URL;

            // Сначала проверяем отдельные поля в localStorage (более надежный способ)
            const savedUsername = localStorage.getItem('user_username');
            const savedId = localStorage.getItem('user_id');
            const savedEmail = localStorage.getItem('user_email');
            const savedAvatarId = localStorage.getItem('user_avatar_id');

            if (savedId && savedUsername && savedEmail) {
                const localUser: User = {
                    id: parseInt(savedId),
                    username: savedUsername,
                    email: savedEmail,
                    avatarId: savedAvatarId ? parseInt(savedAvatarId) : undefined
                };

                console.log('✅ Данные пользователя загружены из отдельных полей localStorage:', localUser);
                setUser(localUser);
                setError(null);
                setLoading(false);
                return;
            }

            // Затем проверяем полный объект в localStorage
            const localUserData = getLocalUserData();
            if (localUserData) {
                console.log('✅ Данные пользователя загружены из localStorage:', localUserData);
                setUser(localUserData);
                setError(null);
                setLoading(false);
                return;
            }

            // Если не нашли данные в localStorage, пробуем получить с сервера
            try {
                const response = await fetch(`${API_URL}/api/me`, {
                    method: "GET",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                });

                if (response.ok) {
                    const userData = await response.json();
                    setUser(userData);

                    // Сохраняем полученные данные в localStorage
                    updateLocalUserData(userData);

                    setError(null);
                } else {
                    // Если сервер недоступен в режиме разработки, используем тестовые данные
                    if (process.env.NODE_ENV === 'development') {
                        console.log('⚠️ Сервер недоступен, используем тестовые данные');
                        const testUser = {
                            id: 1,
                            username: "Тестовый пользователь",
                            email: "test@example.com",
                            avatarId: 1
                        };
                        setUser(testUser);

                        // Сохраняем тестовые данные в localStorage
                        updateLocalUserData(testUser);

                        setError(null);
                    } else {
                        setUser(null);
                        setError('Не удалось загрузить данные пользователя');
                    }
                }
            } catch (err) {
                console.error('❌ Ошибка API:', err);

                // В режиме разработки используем тестовые данные при ошибке
                if (process.env.NODE_ENV === 'development') {
                    const testUser = {
                        id: 1,
                        username: "Тестовый пользователь",
                        email: "test@example.com",
                        avatarId: 1
                    };
                    setUser(testUser);
                    updateLocalUserData(testUser);
                    setError(null);
                } else {
                    setError('Произошла ошибка при загрузке данных пользователя');
                }
            }
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    // Подписываемся на событие обновления данных пользователя
    useEffect(() => {
        const handleUserDataUpdate = (event: Event) => {
            const customEvent = event as CustomEvent<User>;
            setUser(customEvent.detail);
        };

        window.addEventListener('userDataUpdated', handleUserDataUpdate);

        return () => {
            window.removeEventListener('userDataUpdated', handleUserDataUpdate);
        };
    }, []);

    // Загружаем данные пользователя при монтировании компонента
    // и при изменении статуса аутентификации
    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    // Функция для обновления данных пользователя
    const updateUserProfile = async (data: {username?: string, avatarId?: number | null}) => {
        if (!user) {
            throw new Error("Пользователь не авторизован");
        }

        try {
            console.log("📝 Отправка обновления профиля:", data);
            const API_URL = import.meta.env.VITE_API_URL;

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

            // После успешного обновления всегда запрашиваем актуальные данные
            await refreshUserData();

            return { success: true };
        } catch (err) {
            console.error("❌ Ошибка при обновлении профиля:", err);
            throw err;
        }
    };

    // Получаем URL аватарки по ID
    const getAvatarUrl = (avatarId?: number) => {
        return avatarId ? `/avatars/${avatarId}.png` : undefined;
    };

    return {
        user,
        loading,
        error,
        getAvatarUrl,
        updateUserProfile,
        refreshUserData: fetchUser // Экспортируем функцию обновления для использования извне
    };
}