// src/pages/GameLauncherPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
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

// Интерфейс для групп игр по механике
interface GameMechanicGroup {
    title: string;
    type: string;
    games: GameInfo[];
}

const GameLauncherPage: React.FC = () => {
    const { subjectId, mechanicType } = useParams<{ subjectId: string, mechanicType: string }>();
    const [searchParams] = useSearchParams();
    const difficulty = searchParams.get('difficulty') ? parseInt(searchParams.get('difficulty')!, 10) : undefined;
    const rewardPoints = searchParams.get('reward') ? parseInt(searchParams.get('reward')!, 10) : undefined;
    const navigate = useNavigate();

    const launchGame = (gameId: string) => {
        // Pass the custom parameters if they exist
        if (difficulty !== undefined && rewardPoints !== undefined) {
            navigate(`/subject/${subjectId}/game/${gameId}?difficulty=${difficulty}&reward=${rewardPoints}`);
        } else {
            navigate(`/subject/${subjectId}/game/${gameId}`);
        }
    };

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [subjectName, setSubjectName] = useState('');
    const [games, setGames] = useState<GameInfo[]>([]);
    const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null);
    const [gameGroups, setGameGroups] = useState<GameMechanicGroup[]>([]);

    useEffect(() => {
        const fetchSubjectAndGames = async () => {
            if (!subjectId) return;

            try {
                setLoading(true);

                // Загружаем информацию о предмете
                const subjectResponse = await api.get(`/api/subjects/${subjectId}`);
                setSubjectName(subjectResponse.data.name);

                // Определяем тему с более надежной проверкой
                // Для отладки всегда показываем правильную тему в консоли
                let subjectTheme: 'derivatives' | 'integrals';

                // Используем имя предмета для более надежного определения темы
                const subjectNameLower = subjectResponse.data.name.toLowerCase();
                if (subjectNameLower.includes('производн') ||
                    subjectNameLower.includes('дифференц') ||
                    subjectId === '1') {
                    subjectTheme = 'derivatives';
                    console.log(`Определена тема: ПРОИЗВОДНЫЕ (id: ${subjectId})`);
                } else if (subjectNameLower.includes('интеграл') ||
                    subjectId === '2' ||
                    subjectId === '3') {
                    subjectTheme = 'integrals';
                    console.log(`Определена тема: ИНТЕГРАЛЫ (id: ${subjectId})`);
                } else {
                    // Если не смогли определить по имени - считаем интегралами для безопасности
                    subjectTheme = 'integrals';
                    console.log(`Невозможно точно определить тему, используем ИНТЕГРАЛЫ (id: ${subjectId})`);
                }

                // Здесь в реальном приложении вы бы загружали список игр с сервера
                // Сейчас просто имитируем это с локальными данными
                const availableGames: GameInfo[] = [
                    {
                        id: 'deriv-fall',
                        title: 'DerivFall',
                        description: 'Находите производные падающих выражений до того, как они достигнут дна!',
                        icon: '📉',
                        mechanicType: 'падение',
                        subject: 'derivatives',
                        difficulty: difficulty !== undefined ? difficulty : 3, // Use custom difficulty if available
                        estimatedTime: 5
                    },
                    {
                        id: 'integral-builder',
                        title: 'IntegralBuilder',
                        description: 'Соберите правильные интегралы из предложенных частей!',
                        icon: '🧩',
                        mechanicType: 'сборка',
                        subject: 'integrals',
                        difficulty: difficulty !== undefined ? difficulty : 4, // Use custom difficulty if available
                        estimatedTime: 10
                    },
                    {
                        id: 'math-lab-derivatives',
                        title: 'MathLab: Производные',
                        description: 'Изучайте функции, их производные и решайте задачи!',
                        icon: '🔬',
                        mechanicType: 'лаборатория',
                        subject: 'derivatives',
                        difficulty: difficulty !== undefined ? difficulty : 3, // Use custom difficulty if available
                        estimatedTime: 15
                    },
                    {
                        id: 'math-lab-integrals',
                        title: 'MathLab: Интегралы',
                        description: 'Изучайте функции, их интегралы и решайте задачи!',
                        icon: '🧪',
                        mechanicType: 'лаборатория',
                        subject: 'integrals',
                        difficulty: difficulty !== undefined ? difficulty : 4, // Use custom difficulty if available
                        estimatedTime: 15
                    }
                ];

                // Фильтруем игры по теме
                let filteredGames = availableGames.filter(game => game.subject === subjectTheme);

                // Проверяем, что есть игры для этой темы
                if (filteredGames.length === 0) {
                    console.warn(`Нет игр для темы ${subjectTheme}!`);
                } else {
                    console.log(`Найдено ${filteredGames.length} игр для темы ${subjectTheme}`);
                }

                // Если указан тип механики, дополнительно фильтруем
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

                // Группируем игры по типу механики
                const groupedGames: GameMechanicGroup[] = [];

                // Создаем группы для каждого типа механики
                const mechanicTypes = [...new Set(filteredGames.map(game => game.mechanicType))];

                mechanicTypes.forEach(type => {
                    const gamesInGroup = filteredGames.filter(game => game.mechanicType === type);

                    let title = '';
                    switch(type) {
                        case 'падение':
                            title = 'Игры на быструю реакцию';
                            break;
                        case 'сборка':
                            title = 'Игры на конструирование';
                            break;
                        case 'лаборатория':
                            title = 'Исследовательские игры';
                            break;
                        default:
                            title = 'Другие игры';
                    }

                    groupedGames.push({
                        title,
                        type,
                        games: gamesInGroup
                    });
                });

                setGames(filteredGames);
                setGameGroups(groupedGames);

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
    }, [subjectId, mechanicType, difficulty]);

    const handleGameSelect = (game: GameInfo) => {
        setSelectedGame(game);
    };

    const handleStartGame = () => {
        if (!selectedGame) return;

        // Use the launchGame function to ensure custom parameters are passed
        launchGame(selectedGame.id);
    };

    const handleBack = () => {
        navigate(`/subject/${subjectId}/map`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-700 dark:bg-gray-200">
                <Navbar />
                <div className="container mx-auto px-4 py-8 mt-16">
                    <div className="flex justify-center items-center h-96">
                        <div className="text-lg text-gray-300 dark:text-gray-600">Загрузка...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-700 dark:bg-gray-200">
                <Navbar />
                <div className="container mx-auto px-4 py-8 mt-16">
                    <div className="bg-gray-800 dark:bg-gray-100 rounded-lg shadow-lg p-6 text-center">
                        <h2 className="text-xl text-red-500 dark:text-red-600 mb-4">{error}</h2>
                        <Button onClick={handleBack}>
                            Вернуться к карте
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-700 dark:bg-gray-200">
            <Navbar />
            <div className="container mx-auto px-4 py-8 mt-16">
                <div className="bg-gray-800 dark:bg-gray-100 rounded-lg shadow-lg overflow-hidden">
                    <div className="p-6">
                        <div className="mb-6">
                            <Button
                                variant="outline"
                                onClick={handleBack}
                                className="mb-4"
                            >
                                ← Вернуться к карте
                            </Button>

                            <h1 className="text-2xl font-bold text-gray-100 dark:text-gray-900">
                                {mechanicType
                                    ? `Игры типа "${mechanicType}" по теме "${subjectName}"`
                                    : `Игры по теме "${subjectName}"`}
                            </h1>
                        </div>

                        {/* Display custom settings if available */}
                        {difficulty !== undefined && rewardPoints !== undefined && (
                            <div className="mb-6 p-4 bg-blue-900/30 dark:bg-blue-100/50 border border-blue-800 dark:border-blue-300 rounded-lg">
                                <h2 className="text-lg font-semibold text-blue-300 dark:text-blue-800 mb-2">Выбранные настройки:</h2>
                                <div className="flex space-x-4">
                                    <div className="flex items-center">
                                        <span className="text-yellow-400 dark:text-yellow-600 mr-1">★</span>
                                        <span className="text-white dark:text-gray-800">Сложность: {difficulty}/5</span>
                                    </div>
                                    <div className="flex items-center">
                                        <span className="text-green-400 dark:text-green-600 mr-1">🏆</span>
                                        <span className="text-white dark:text-gray-800">Награда: {rewardPoints} очков</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {games.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-gray-400 dark:text-gray-500 mb-4">К сожалению, игры не найдены.</p>
                                <Button onClick={handleBack}>
                                    Вернуться к карте
                                </Button>
                            </div>
                        ) : (
                            <div>
                                {/* Сгруппированные игры */}
                                {gameGroups.map((group) => (
                                    <div key={group.type} className="mb-8">
                                        <h2 className="text-xl font-semibold mb-4 text-gray-200 dark:text-gray-800">{group.title}</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {group.games.map((game) => (
                                                <div
                                                    key={game.id}
                                                    className={`
                                                        p-6 rounded-lg cursor-pointer transition-all transform hover:scale-105 shadow-md
                                                        ${selectedGame?.id === game.id
                                                        ? 'bg-indigo-700 dark:bg-indigo-200 border-2 border-indigo-500 dark:border-indigo-400'
                                                        : 'bg-gray-700 dark:bg-gray-200 border border-gray-600 dark:border-gray-300 hover:shadow-lg'}
                                                    `}
                                                    onClick={() => handleGameSelect(game)}
                                                >
                                                    <div className="flex items-center mb-3">
                                                        <div className="text-3xl mr-3">{game.icon}</div>
                                                        <h3 className="text-xl font-semibold text-gray-100 dark:text-gray-900">{game.title}</h3>
                                                    </div>
                                                    <p className="text-gray-300 dark:text-gray-700 mb-4">{game.description}</p>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-400 dark:text-gray-500">Сложность: {Array(game.difficulty).fill('★').join('')}</span>
                                                        <span className="text-gray-400 dark:text-gray-500">~{game.estimatedTime} мин</span>
                                                    </div>
                                                    {/* Add quick launch button */}
                                                    <div className="mt-4">
                                                        <button
                                                            className="w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                launchGame(game.id);
                                                            }}
                                                        >
                                                            Быстрый запуск
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                <div className="flex justify-center mt-8">
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
        </div>
    );
};

export default GameLauncherPage;