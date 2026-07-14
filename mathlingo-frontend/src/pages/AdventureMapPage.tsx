// src/pages/AdventureMapPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import AdventureMap from '../components/adventure/AdventureMap';
import { api } from '../api/studentApi';
import '../styles/adventure-map.css';

interface Subject {
    id: number;
    name: string;
    code: string;
    description: string;
    icon: string;
}

const AdventureMapPage = () => {
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
                setError('Не удалось загрузить данные о предмете. Попробуйте позже.');
            } finally {
                setLoading(false);
            }
        };
        fetchSubject();
    }, [subjectId]);

    if (loading) return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <Navbar />
            <div className="container mx-auto px-4 py-8 mt-16 flex justify-center items-center h-96">
                <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500 transition-colors">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    Загрузка...
                </div>
            </div>
        </div>
    );

    if (error || !subject) return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <Navbar />
            <div className="container mx-auto px-4 py-8 mt-16">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center transition-colors">
                    <p className="text-red-500 dark:text-red-400 text-lg mb-4 transition-colors">
                        {error || 'Предмет не найден'}
                    </p>
                    <button
                        style={{ padding: '0.625rem 1.5rem' }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
                        onClick={() => navigate('/dashboard')}
                    >
                        Вернуться на главную
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <Navbar />
            <div className="container mx-auto px-4 py-8 mt-16">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-6 transition-colors">

                    {/* Шапка */}
                    <div className="flex items-center gap-4 mb-6">
                        {subject.icon && (
                            <img
                                src={subject.icon}
                                alt={subject.name}
                                className="w-14 h-14 object-contain flex-shrink-0"
                            />
                        )}
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
                                {subject.name}
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 text-sm transition-colors">
                                {subject.description}
                            </p>
                        </div>
                    </div>

                    {/* Карта */}
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white transition-colors">
                            Ваше приключение
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 transition-colors">
                            Пройдите через различные локации, выполняя задания по математике.
                            Накапливайте очки и открывайте новые части карты!
                        </p>

                        <div className="adventure-map-wrapper">
                            <AdventureMap subjectId={parseInt(subjectId!)} />
                        </div>
                    </div>

                    {/* Инструкция */}
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl transition-colors">
                        <h3 className="text-base font-semibold mb-2 text-indigo-700 dark:text-indigo-300 transition-colors">
                            Как играть?
                        </h3>
                        <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-600 dark:text-gray-400 transition-colors">
                            <li>Нажмите на доступную локацию на карте (яркие иконки)</li>
                            <li>Выберите группу заданий, которую хотите пройти</li>
                            <li>Решайте задания одно за другим, зарабатывая очки</li>
                            <li>Завершив группу заданий, вы разблокируете новые локации</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdventureMapPage;