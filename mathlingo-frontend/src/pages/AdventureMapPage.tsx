// src/pages/AdventureMapPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AdventureMap from '../components/adventure/AdventureMap';
import { api } from '../utils/api';
import '../styles/adventure-map.css'; // Импортируем новые стили

interface Subject {
    id: number;
    name: string;
    code: string;
    description: string;
    icon: string;
}

const AdventureMapPage: React.FC = () => {
    const { subjectId } = useParams<{ subjectId: string }>();
    const navigate = useNavigate();

    const [subject, setSubject] = useState<Subject | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSubject = async () => {
            if (!subjectId) return;

            try {
                setLoading(true);
                const response = await api.get(`/api/subjects/${subjectId}`);
                setSubject(response.data);
            } catch (err) {
                console.error('Ошибка при загрузке предмета:', err);
                setError('Не удалось загрузить данные о предмете. Попробуйте позже.');
            } finally {
                setLoading(false);
            }
        };

        fetchSubject();
    }, [subjectId]);

    if (loading) return (
        <div className="min-h-screen bg-gray-900 dark:bg-white">
            <Navbar />
            <div className="container mx-auto px-4 py-8 mt-16">
                <div className="flex justify-center items-center h-96">
                    <div className="text-lg text-gray-500">Загрузка...</div>
                </div>
            </div>
        </div>
    );

    if (error || !subject) return (
        <div className="min-h-screen bg-gray-900 dark:bg-white">
            <Navbar />
            <div className="container mx-auto px-4 py-8 mt-16">
                <div className="bg-gray-800 dark:bg-gray-100 rounded-lg shadow-lg p-6 text-center">
                    <h2 className="text-xl text-red-500 mb-4">{error || 'Предмет не найден'}</h2>
                    <button
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        onClick={() => navigate('/dashboard')}
                    >
                        Вернуться на главную
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-900 dark:bg-white">
            <Navbar />
            <div className="container mx-auto px-4 py-8 mt-16">
                <div className="bg-gray-800 dark:bg-white rounded-lg shadow-lg p-6">
                    {/* Шапка страницы */}
                    <div className="flex items-center mb-6">
                        {subject.icon && (
                            <img
                                src={subject.icon}
                                alt={subject.name}
                                className="w-16 h-16 mr-4 object-contain"
                            />
                        )}
                        <div>
                            <h1 className="text-2xl font-bold text-white dark:text-gray-900">{subject.name}</h1>
                            <p className="text-gray-400 dark:text-gray-500">{subject.description}</p>
                        </div>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-xl font-semibold mb-4 text-white dark:text-gray-900">Ваше приключение</h2>
                        <p className="text-gray-300 dark:text-gray-600 mb-4">
                            Пройдите через различные локации, выполняя увлекательные задания по математике.
                            Накапливайте очки и открывайте новые части карты!
                        </p>

                        {/* Карта приключений с исправленными стилями */}
                        <div className="adventure-map-wrapper">
                            <AdventureMap subjectId={parseInt(subjectId!)} />
                        </div>
                    </div>

                    <div className="mt-8 p-4 bg-blue-900/80 dark:bg-blue-50 rounded-lg">
                        <h3 className="text-lg font-semibold mb-2 text-white dark:text-gray-900">Как играть?</h3>
                        <ol className="list-decimal list-inside space-y-2 text-gray-300 dark:text-gray-700">
                            <li>Нажмите на доступную локацию на карте (яркие иконки)</li>
                            <li>Выберите группу заданий, которую хотите пройти</li>
                            <li>Решайте задания одно за другим, зарабатывая очки</li>
                            <li>Завершив группу заданий, вы разблокируете новые локации на карте</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdventureMapPage;