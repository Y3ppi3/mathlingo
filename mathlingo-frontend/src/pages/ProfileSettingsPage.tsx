import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useUser } from '../hooks/useUser';
import AvatarSelector from '../components/AvatarSelector';
import Button from '../components/Button';
import Input from '../components/Input';

const ProfileSettingsPage: React.FC = () => {
    const { user, loading, error, refreshUserData } = useUser();
    const navigate = useNavigate();
    const isMounted = useRef(true);

    // Состояния формы
    const [formData, setFormData] = useState({
        username: '',
        avatarId: undefined as number | undefined
    });

    // Состояние для хранения оригинальных данных при загрузке
    const [originalData, setOriginalData] = useState({
        username: '',
        avatarId: undefined as number | undefined
    });

    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [formKey, setFormKey] = useState(Date.now()); // Ключ для полного пересоздания формы

    // Инициализация начальных данных
    useEffect(() => {
        if (user) {
            const userData = {
                username: user.username,
                avatarId: user.avatarId
            };

            setFormData(userData);
            setOriginalData(userData);

            console.log("Инициализация данных пользователя:", userData);
        }
    }, [user]);

    // Вычисляем, есть ли изменения в форме
    const hasFormChanges = useCallback(() => {
        return formData.username !== originalData.username ||
            formData.avatarId !== originalData.avatarId;
    }, [formData, originalData]);

    // Эффект для очистки
    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Обработчики изменения формы
    const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            username: e.target.value
        }));
    };

    const handleAvatarSelect = (id: number) => {
        setFormData(prev => ({
            ...prev,
            avatarId: id
        }));
    };

    // Полная перезагрузка формы и данных пользователя
    const resetFormWithFreshData = async () => {
        if (!isMounted.current) return;

        // Сначала перезагрузим данные пользователя с сервера
        try {
            console.log("Перезагрузка данных пользователя...");
            const freshUser = await refreshUserData();

            if (freshUser) {
                const freshData = {
                    username: freshUser.username,
                    avatarId: freshUser.avatarId
                };

                console.log("Получены свежие данные:", freshData);

                // Сбрасываем форму с новыми данными
                setFormData(freshData);
                setOriginalData(freshData);

                // Генерируем новый ключ для полного пересоздания формы
                setFormKey(Date.now());

                console.log("Форма сброшена с новыми данными");
            }
        } catch (err) {
            console.error("Ошибка при обновлении данных пользователя:", err);
        }
    };

    // Обработчик отправки формы
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("🔍 Форма отправлена, начинаем обработку");

        const changes = hasFormChanges();
        console.log("Текущее состояние изменений:", changes, {
            form: formData,
            original: originalData
        });

        if (!isMounted.current) return;

        if (!changes) {
            console.log("Нет изменений для сохранения");
            setSuccessMessage('Нет изменений для сохранения.');
            return;
        }

        setFormError('');
        setSuccessMessage('');
        setIsSaving(true);

        try {
            if (!formData.username.trim()) {
                console.log("❌ Пустое имя пользователя");
                setFormError('Имя пользователя не может быть пустым');
                setIsSaving(false);
                return;
            }

            const updateData: {username?: string, avatarId?: number | null} = {};

            // Добавляем только изменившиеся поля
            if (formData.username !== originalData.username) {
                updateData.username = formData.username;
                console.log(`Имя изменилось: "${originalData.username}" -> "${formData.username}"`);
            }

            if (formData.avatarId !== originalData.avatarId) {
                // null или конкретное значение
                updateData.avatarId = formData.avatarId ?? null;
                console.log(`Аватар изменился: ${originalData.avatarId} -> ${formData.avatarId}`);
            }

            console.log('Отправляем данные:', updateData);

            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

            const response = await fetch(`${API_URL}/api/me/update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
                credentials: 'include',
            });

            console.log(`Статус ответа: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Ошибка от сервера:', errorText);
                throw new Error(errorText || 'Не удалось обновить профиль');
            }

            const responseData = await response.json();
            console.log('Получены данные от сервера:', responseData);

            // Обновляем данные в localStorage
            localStorage.setItem('user_username', responseData.username);
            localStorage.setItem('user_id', responseData.id.toString());
            localStorage.setItem('user_email', responseData.email);
            localStorage.setItem('user_avatar_id', responseData.avatarId?.toString() || '');

            // Устанавливаем сообщение об успехе
            setSuccessMessage('Настройки профиля успешно сохранены!');

            // Отправляем событие для других компонентов
            window.dispatchEvent(new CustomEvent('userDataUpdated', {
                detail: responseData
            }));

            // Полностью обновляем форму и данные пользователя
            await resetFormWithFreshData();

        } catch (err) {
            console.error('Ошибка при сохранении:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setFormError(`Не удалось сохранить изменения: ${errorMessage}`);
        } finally {
            if (isMounted.current) {
                setIsSaving(false);
            }
        }
    };

    // Отображение состояния загрузки
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

    // Отображение ошибки
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

    // Определяем, есть ли изменения для кнопки
    const isFormChanged = hasFormChanges();

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

                    {/* Используем ключ для полного пересоздания формы при обновлении данных */}
                    <form key={formKey} onSubmit={handleSubmit} className="max-w-xl">
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold mb-3 text-white dark:text-gray-900">Основная информация</h2>

                            <div className="mb-4">
                                <label htmlFor="username-field" className="block mb-2 text-gray-300 dark:text-gray-700">
                                    Имя пользователя
                                </label>
                                <Input
                                    id="username-field"
                                    name="username"
                                    type="text"
                                    value={formData.username}
                                    onChange={handleUsernameChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="mb-6">
                            <h2 className="text-lg font-semibold mb-3 text-white dark:text-gray-900">Аватар</h2>

                            <AvatarSelector
                                selectedAvatar={formData.avatarId}
                                onSelect={handleAvatarSelect}
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

                            <button
                                type="submit"
                                disabled={isSaving || !isFormChanged}
                                className={`px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
                                ${isFormChanged
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-500'
                                    : 'bg-gray-400 cursor-not-allowed text-white'}`}
                            >
                                {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProfileSettingsPage;