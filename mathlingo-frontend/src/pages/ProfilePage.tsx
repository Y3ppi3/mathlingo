// src/pages/ProfilePage.tsx
import React from 'react';
import Navbar from '../components/Navbar';
import { useUser } from '../hooks/useUser';
import UserAvatar from '../components/UserAvatar';
import Button from '../components/Button';
import { Link } from 'react-router-dom';

const ProfilePage: React.FC = () => {
    const { user, loading, error } = useUser();

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
                    <div className="flex flex-col md:flex-row">
                        {/* Аватар и основная информация */}
                        <div className="w-full md:w-1/3 flex flex-col items-center p-4">
                            <UserAvatar username={user.username} avatarId={user.avatarId} size="lg" />
                            <h1 className="text-2xl font-bold mt-4 text-white dark:text-gray-900">{user.username}</h1>
                            <p className="text-gray-400 dark:text-gray-600">{user.email}</p>

                            <Link to="/profile/settings" className="mt-4 w-full">
                                <Button fullWidth>Настройки профиля</Button>
                            </Link>
                        </div>

                        {/* Статистика и достижения */}
                        <div className="w-full md:w-2/3 p-4">
                            <h2 className="text-xl font-semibold mb-4 text-white dark:text-gray-900">Статистика</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Карточка статистики */}
                                <div className="bg-gray-700 dark:bg-white p-4 rounded-lg shadow">
                                    <h3 className="text-lg font-medium mb-2 text-white dark:text-gray-900">Общий прогресс</h3>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-300 dark:text-gray-600">Уровень:</span>
                                        <span className="text-white dark:text-gray-900 font-bold">1</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-gray-300 dark:text-gray-600">Очки:</span>
                                        <span className="text-white dark:text-gray-900 font-bold">0</span>
                                    </div>
                                </div>

                                {/* Карточка статистики */}
                                <div className="bg-gray-700 dark:bg-white p-4 rounded-lg shadow">
                                    <h3 className="text-lg font-medium mb-2 text-white dark:text-gray-900">Задания</h3>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-300 dark:text-gray-600">Завершено:</span>
                                        <span className="text-white dark:text-gray-900 font-bold">0</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-gray-300 dark:text-gray-600">Точность:</span>
                                        <span className="text-white dark:text-gray-900 font-bold">0%</span>
                                    </div>
                                </div>
                            </div>

                            <h2 className="text-xl font-semibold mt-6 mb-4 text-white dark:text-gray-900">Достижения</h2>
                            <div className="bg-gray-700 dark:bg-white p-4 rounded-lg shadow">
                                <p className="text-gray-400 dark:text-gray-500 text-center">
                                    У вас пока нет достижений. Продолжайте обучение, чтобы получить их!
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;