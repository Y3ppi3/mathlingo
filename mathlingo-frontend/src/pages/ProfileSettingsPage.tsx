import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useUser } from '../hooks/useUser';
import AvatarSelector from '../components/AvatarSelector';
import Button from '../components/Button';
import Input from '../components/Input';
import { fetchWithRetry } from '../utils/fetchUtils';

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

        try {
            // Устанавливаем флаг, что идет обновление формы
            const updatingFormFlag = 'updating_profile_form';
            if (sessionStorage.getItem(updatingFormFlag)) {
                console.log('🔄 Обновление формы уже выполняется, пропускаем');
                return;
            }

            sessionStorage.setItem(updatingFormFlag, '1');

            const freshUser = await refreshUserData();

            if (freshUser) {
                const freshData = {
                    username: freshUser.username,
                    avatarId: freshUser.avatarId
                };

                // Атомарное обновление состояния формы
                setFormData(freshData);
                setOriginalData(freshData);
                setFormKey(Date.now());
            }

            // Очищаем флаг
            sessionStorage.removeItem(updatingFormFlag);
        } catch (err) {
            console.error("❌ Ошибка при обновлении данных формы:", err);
            sessionStorage.removeItem('updating_profile_form');
        }
    };

    // Обработчик отправки формы
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!hasFormChanges()) {
            setSuccessMessage('Нет изменений для сохранения.');
            return;
        }

        setFormError('');
        setSuccessMessage('');
        setIsSaving(true);

        try {
            // Создаём объект только с измененными данными
            const updateData: {username?: string, avatarId?: number | null} = {};

            if (formData.username !== originalData.username) {
                updateData.username = formData.username;
            }

            if (formData.avatarId !== originalData.avatarId) {
                updateData.avatarId = formData.avatarId ?? null;
            }

            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

            // Использовать fetch с учетом CSRF-защиты
            const response = await fetch(`${API_URL}/api/me/update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                body: JSON.stringify(updateData),
                credentials: 'include', // Отправлять куки
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Не удалось обновить профиль');
            }

            const responseData = await response.json();

            // НЕ сохраняем данные в localStorage

            setSuccessMessage(responseData.message || 'Профиль успешно обновлен!');

            // Обновить состояние формы с новыми данными
            await refreshUserData();
        } catch (err) {
            console.error('Ошибка при сохранении:', err);
            setFormError(`Не удалось сохранить изменения: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`);
        } finally {
            setIsSaving(false);
        }
    };    // Отображение состояния загрузки
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