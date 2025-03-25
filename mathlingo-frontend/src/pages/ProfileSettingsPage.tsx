// src/pages/ProfileSettingsPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useUser } from '../hooks/useUser';
import AvatarSelector from '../components/AvatarSelector';
import Button from '../components/Button';
import Input from '../components/Input';

const ProfileSettingsPage: React.FC = () => {
    const { user, loading, error, updateUserProfile, refreshUserData } = useUser();
    const navigate = useNavigate();
    const isMounted = useRef(true);

    const [username, setUsername] = useState('');
    const [avatarId, setAvatarId] = useState<number | null>(null);
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Приоритет данным из формы для предотвращения потери изменений
    const [hasFormChanges, setHasFormChanges] = useState(false);


    useEffect(() => {
        if (user && !hasFormChanges) {
            setUsername(user.username);
            if (user.avatarId !== undefined) {
                setAvatarId(user.avatarId);
            }
        }
    }, [user, hasFormChanges]);

    useEffect(() => {
        return () => {
            isMounted.current = false; // При размонтировании компонента
        };
    }, []);

    // Загружаем данные пользователя в форму
    const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUsername(e.target.value);
        setHasFormChanges(true);
    };

    const handleAvatarSelect = (id: number) => {
        setAvatarId(id);
        setHasFormChanges(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isMounted.current) return;

        setFormError('');
        setSuccessMessage('');
        setIsSaving(true);

        try {
            // Валидация данных перед отправкой
            if (!username.trim()) {
                setFormError('Имя пользователя не может быть пустым');
                setIsSaving(false);
                return;
            }

            // Создаем пустой объект для обновления
            const updateData: {username?: string, avatarId?: number | null} = {};

            // Добавляем username только если он изменился
            if (username !== user?.username) {
                updateData.username = username;
            }

            // ВАЖНО: Проверяем изменение аватарки правильно
            // Используем строгое сравнение для проверки изменения аватарки
            if (user?.avatarId !== avatarId) {
                // Включаем в запрос avatarId ТОЛЬКО если он изменился
                updateData.avatarId = avatarId;
                console.log(`Аватар изменился: ${user?.avatarId} -> ${avatarId}`);
            } else {
                console.log('Аватар не изменился, не включаем в запрос');
            }

            // Проверяем, есть ли изменения для отправки
            if (Object.keys(updateData).length === 0) {
                setSuccessMessage('Нет изменений для сохранения.');
                setIsSaving(false);
                return;
            }

            console.log('Отправка запроса на обновление профиля:', updateData);

            // Отправляем данные на сервер
            const result = await updateUserProfile(updateData);
            console.log('Результат обновления профиля:', result);

            if (!isMounted.current) return;

            if (result.success) {
                setSuccessMessage('Настройки профиля успешно сохранены!');

                // Если сервер вернул обновленные данные, используем их
                if (result.data) {
                    setUsername(result.data.username);
                    setAvatarId(result.data.avatarId);
                } else {
                    // Иначе запрашиваем обновление через API
                    await refreshUserData();
                }

                // Сбрасываем флаг изменений
                setHasFormChanges(false);
            }
        } catch (err) {
            if (!isMounted.current) return;
            setFormError('Не удалось сохранить изменения. Попробуйте позже.');
            console.error(err);
        } finally {
            if (isMounted.current) {
                setIsSaving(false);
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 dark:bg-white">
                <Navbar />
                <div className="container mx-auto px-4 py-8 mt-16">
                    <div className="flex justify-center items-center h-96">
                        <div className="text-lg text-gray-400">Загрузка профиля...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !user) {
        return (
            <div className="min-h-screen bg-gray-900 dark:bg-white">
                <Navbar />
                <div className="container mx-auto px-4 py-8 mt-16">
                    <div className="bg-gray-800 dark:bg-gray-100 rounded-lg shadow-lg p-6 text-center">
                        <h2 className="text-xl text-red-500 mb-4">{error || 'Не удалось загрузить профиль'}</h2>
                        <Link to="/dashboard">
                            <Button>Вернуться на главную</Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 dark:bg-white">
            <Navbar />
            <div className="container mx-auto px-4 py-8 mt-16">
                <div className="bg-gray-800 dark:bg-gray-100 rounded-lg shadow-lg p-6">
                    <div className="flex items-center mb-6">
                        <button
                            className="text-indigo-400 hover:text-indigo-300 mr-2"
                            onClick={() => navigate('/profile')}
                        >
                            ← Назад
                        </button>
                        <h1 className="text-2xl font-bold text-white dark:text-gray-900">Настройки профиля</h1>
                    </div>

                    {formError && (
                        <div className="mb-4 p-3 bg-red-900/50 dark:bg-red-100 text-red-200 dark:text-red-700 rounded">
                            {formError}
                        </div>
                    )}

                    {successMessage && (
                        <div className="mb-4 p-3 bg-green-900/50 dark:bg-green-100 text-green-200 dark:text-green-700 rounded">
                            {successMessage}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="max-w-xl">
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold mb-3 text-white dark:text-gray-900">Основная информация</h2>

                            <div className="mb-4">
                                <label className="block mb-2 text-gray-300 dark:text-gray-700">Имя пользователя</label>
                                <Input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="mb-6">
                            <h2 className="text-lg font-semibold mb-3 text-white dark:text-gray-900">Аватар</h2>

                            <AvatarSelector
                                selectedAvatar={avatarId}
                                onSelect={setAvatarId}
                            />

                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                                Выберите аватар из галереи, который будет отображаться в вашем профиле.
                            </p>
                        </div>

                        <div className="mb-6">
                            <h2 className="text-lg font-semibold mb-3 text-white dark:text-gray-900">Email</h2>
                            <p className="text-gray-300 dark:text-gray-700 mb-2">
                                {user.email}
                            </p>
                            <p className="text-gray-400 dark:text-gray-500 text-sm">
                                Вы не можете изменить email после регистрации.
                            </p>
                        </div>

                        <div className="flex justify-end space-x-4">
                            <Button
                                variant="outline"
                                onClick={() => navigate('/profile')}
                                type="button"
                            >
                                Отмена
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSaving}
                            >
                                {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProfileSettingsPage;