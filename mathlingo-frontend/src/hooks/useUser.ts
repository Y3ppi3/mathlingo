// src/hooks/useUser.ts
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
    const [forceUpdate, setForceUpdate] = useState<number>(0); // Добавляем счетчик для принудительного обновления

    // Функция получения данных пользователя
    const fetchUser = useCallback(async () => {
        if (!isAuthenticated) {
            setUser(null);
            setLoading(false);
            return null;
        }

        try {
            setLoading(true);
            const API_URL = import.meta.env.VITE_API_URL;

            // Сначала проверяем отдельные поля в localStorage
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
                return localUser;
            }

            // Затем проверяем полный объект в localStorage
            const localUserData = getLocalUserData();
            if (localUserData) {
                console.log('✅ Данные пользователя загружены из localStorage:', localUserData);
                setUser(localUserData);
                setError(null);
                setLoading(false);
                return localUserData;
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
                    console.log('✅ Получены данные пользователя от сервера:', userData);
                    setUser(userData);

                    // Сохраняем полученные данные в localStorage
                    localStorage.setItem('user_username', userData.username);
                    localStorage.setItem('user_id', userData.id.toString());
                    localStorage.setItem('user_email', userData.email);
                    localStorage.setItem('user_avatar_id', userData.avatarId?.toString() || '');

                    // Сохраняем также через функцию updateLocalUserData
                    updateLocalUserData(userData);

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
                        setUser(testUser);
                        updateLocalUserData(testUser);
                        setError(null);
                        return testUser;
                    } else {
                        setUser(null);
                        setError('Не удалось загрузить данные пользователя');
                        return null;
                    }
                }
            } catch (err) {
                console.error('❌ Ошибка API:', err);

                // Аналогично в случае ошибки в режиме разработки
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
                    return testUser;
                } else {
                    setError('Произошла ошибка при загрузке данных пользователя');
                    return null;
                }
            }
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, forceUpdate]); // Добавляем forceUpdate в зависимости

    // Функция обновления данных пользователя
    const updateUserProfile = async (data: {username?: string, avatarId?: number | null}) => {
        if (!user) {
            throw new Error("Пользователь не авторизован");
        }

        const controller = new AbortController();
        const signal = controller.signal;

        try {
            console.log("📝 Отправка обновления профиля:", data);
            const API_URL = import.meta.env.VITE_API_URL;

            const response = await fetch(`${API_URL}/api/me/update`, {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                signal
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || "Не удалось обновить профиль");
            }

            // Получаем обновленные данные из ответа
            const updatedUserData = await response.json();
            console.log('✅ Получены обновленные данные:', updatedUserData);

            // Обновляем состояние и localStorage
            setUser(updatedUserData);

            // Обновляем локальное хранилище
            localStorage.setItem('user_username', updatedUserData.username);
            localStorage.setItem('user_id', updatedUserData.id.toString());
            localStorage.setItem('user_email', updatedUserData.email);
            localStorage.setItem('user_avatar_id', updatedUserData.avatarId?.toString() || '');

            // Также обновляем через функцию
            updateLocalUserData(updatedUserData);

            // Принудительно запускаем обновление компонентов
            setForceUpdate(prev => prev + 1);

            // Отправляем событие для других компонентов
            window.dispatchEvent(new CustomEvent('userDataUpdated', {
                detail: updatedUserData
            }));

            return { success: true, data: updatedUserData };
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('Запрос был отменен');
                return { success: false, canceled: true };
            }

            console.error("❌ Ошибка при обновлении профиля:", err);
            throw err;
        } finally {
            controller.abort();
        }
    };

    // Подписываемся на обновления данных
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

    // Загружаем данные при монтировании
    useEffect(() => {
        let isMounted = true;

        const loadUserData = async () => {
            try {
                await fetchUser();
            } catch (err) {
                if (isMounted) {
                    console.error('Ошибка при загрузке данных пользователя:', err);
                }
            }
        };

        loadUserData();

        return () => {
            isMounted = false;
        };
    }, [fetchUser]);

    // Функция обновления данных, доступная извне
    const refreshUserData = async () => {
        const userData = await fetchUser();
        if (userData) {
            // Увеличиваем счетчик обновлений
            setForceUpdate(prev => prev + 1);
        }
        return userData;
    };

    return {
        user,
        loading,
        error,
        getAvatarUrl: (avatarId?: number) => avatarId ? `/avatars/${avatarId}.png` : undefined,
        updateUserProfile,
        refreshUserData
    };
}