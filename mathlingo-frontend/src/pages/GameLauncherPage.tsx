// src/pages/GameLauncherPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import Navbar from '../components/Navbar';
import Button from '../components/Button';

interface GameInfo {
    id: string;
    title: string;
    description: string;
    icon: string;
    mechanicType: 'падение' | 'сборка' | 'лаборатория';
    subject: 'derivatives' | 'integrals';
    difficulty: number;
    estimatedTime: number; // в минутах
}

const GameLauncherPage: React.FC = () => {
    const { subjectId, mechanicType } = useParams<{ subjectId: string, mechanicType: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [subjectName, setSubjectName] = useState('');
    const [games, setGames] = useState<GameInfo[]>([]);
    const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null);

    useEffect(() => {
        const fetchSubjectAndGames = async () => {
            if (!subjectId) return;

            try {
                setLoading(true);
                
                // Загружаем информацию о предмете
                const subjectResponse = await api.get(`/api/subjects/${subjectId}`);
                setSubjectName(subjectResponse.data.name);
                
                // Здесь в реальном приложении вы бы загружали список игр с сервера
                // Сейчас просто имитируем это с локальными данными
                
                // Определяем тему (производные или интегралы) на основе subjectId
                // В реальном приложении это бы приходило с сервера
                const subjectTheme = subjectId === '1' ? 'derivatives' : 'integrals';
                
                // Фильтруем игры по механике, если указана
                const availableGames: GameInfo[] = [
                    {
                        id: 'deriv-fall',
                        title: 'DerivFall',
                        description: 'Находите производные падающих выражений до того, как они достигнут дна!',
                        icon: '📉',
                        mechanicType: 'падение',
                        subject: 'derivatives',
                        difficulty: 3,
                        estimatedTime: 5
                    },
                    {
                        id: 'integral-builder',
                        title: 'IntegralBuilder',
                        description: 'Соберите правильные интегралы из предложенных частей!',
                        icon: '🧩',
                        mechanicType: 'сборка',
                        subject: 'integrals',
                        difficulty: 4,
                        estimatedTime: 10
                    },
                    {
                        id: 'math-lab-derivatives',
                        title: 'MathLab: Производные',
                        description: 'Изучайте функции, их производные и решайте задачи!',
                        icon: '🔬',
                        mechanicType: 'лаборатория',
                        subject: 'derivatives',
                        difficulty: 3,
                        estimatedTime: 15
                    },
                    {
                        id: 'math-lab-integrals',
                        title: 'MathLab: Интегралы',
                        description: 'Изучайте функции, их интегралы и решайте задачи!',
                        icon: '🧪',
                        mechanicType: 'лаборатория',
                        subject: 'integrals',
                        difficulty: 4,
                        estimatedTime: 15
                    }
                ];
                
                // Фильтруем игры по теме и механике
                let filteredGames = availableGames.filter(game => game.subject === subjectTheme);
                
                if (mechanicType) {
                    const mechanicMap: Record<string, string> = {
                        'fall': 'падение',
                        'builder': 'сборка',
                        'lab': 'лаборатория'
                    };
                    
                    const mappedMechanicType = mechanicMap[mechanicType] as 'падение' | 'сборка' | 'лаборатория';
                    
                    if (mappedMechanicType) {
                        filteredGames = filteredGames.filter(game => game.mechanicType === mappedMechanicType);
                    }
                }
                
                setGames(filteredGames);
                
                // Если есть только одна игра, сразу выбираем её
                if (filteredGames.length === 1) {
                    setSelectedGame(filteredGames[0]);
                }
                
            } catch (err) {
                console.error('Ошибка при загрузке данных:', err);
                setError('Не удалось загрузить данные. Попробуйте позже.');
            } finally {
                setLoading(false);
            }
        };

        fetchSubjectAndGames();
    }, [subjectId, mechanicType]);

    const handleGameSelect = (game: GameInfo) => {
        setSelectedGame(game);
    };

    const handleStartGame = () => {
        if (!selectedGame) return;
        
        // Переходим на соответствующую страницу игры
        navigate(`/subject/${subjectId}/game/${selectedGame.id}`);
    };

    const handleBack = () => {
        navigate(`/subject/${subjectId}/map`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
                <Navbar />
                <div className="container mx-auto px-4 py-8 mt-16">
                    <div className="flex justify-center items-center h-96">
                        <div className="text-lg text-gray-500">Загрузка...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
                <Navbar />
                <div className="container mx-auto px-4 py-8 mt-16">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
                        <h2 className="text-xl text-red-500 mb-4">{error}</h2>
                        <Button onClick={handleBack}>
                            Вернуться к карте
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            <Navbar />
            <div className="container mx-auto px-4 py-8 mt-16">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                    <div className="mb-6">
                        <Button
                            variant="outline"
                            onClick={handleBack}
                            className="mb-4"
                        >
                            ← Вернуться к карте
                        </Button>
                        
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {mechanicType 
                                ? `Игры типа "${mechanicType}" по теме "${subjectName}"` 
                                : `Игры по теме "${subjectName}"`}
                        </h1>
                    </div>

                    {games.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-500 mb-4">К сожалению, игры не найдены.</p>
                            <Button onClick={handleBack}>
                                Вернуться к карте
                            </Button>
                        </div>
                    ) : (
                        <div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                {games.map((game) => (
                                    <div
                                        key={game.id}
                                        className={`
                                            p-6 rounded-lg cursor-pointer transition-all transform hover:scale-105
                                            ${selectedGame?.id === game.id 
                                                ? 'bg-indigo-100 dark:bg-indigo-900 border-2 border-indigo-500' 
                                                : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:shadow-lg'}
                                        `}
                                        onClick={() => handleGameSelect(game)}
                                    >
                                        <div className="flex items-center mb-3">
                                            <div className="text-3xl mr-3">{game.icon}</div>
                                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{game.title}</h3>
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-300 mb-4">{game.description}</p>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500 dark:text-gray-400">Сложность: {Array(game.difficulty).fill('★').join('')}</span>
                                            <span className="text-gray-500 dark:text-gray-400">~{game.estimatedTime} мин</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-center">
                                <Button
                                    onClick={handleStartGame}
                                    disabled={!selectedGame}
                                    className="px-8 py-3 text-lg"
                                >
                                    {selectedGame ? `Начать игру "${selectedGame.title}"` : 'Выберите игру'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GameLauncherPage;
