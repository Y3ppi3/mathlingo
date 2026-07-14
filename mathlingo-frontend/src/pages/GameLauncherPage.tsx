// src/pages/GameLauncherPage.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/studentApi';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';

interface GameInfo {
    id: string;
    title: string;
    description: string;
    icon: string;
    mechanicType: 'падение' | 'сборка' | 'лаборатория' | 'приближение' | 'наполнение';
    subject: 'derivatives' | 'integrals' | 'limits' | 'series';
    difficulty: number;
    estimatedTime: number;
}

interface GameMechanicGroup {
    title: string;
    type: string;
    games: GameInfo[];
}

const GameLauncherPage = () => {
    const { subjectId, mechanicType } = useParams<{ subjectId: string; mechanicType: string }>();
    const [searchParams] = useSearchParams();
    const difficulty = searchParams.get('difficulty') ? parseInt(searchParams.get('difficulty')!, 10) : undefined;
    const rewardPoints = searchParams.get('reward') ? parseInt(searchParams.get('reward')!, 10) : undefined;
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [subjectName, setSubjectName] = useState('');
    const [games, setGames] = useState<GameInfo[]>([]);
    const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null);
    const [gameGroups, setGameGroups] = useState<GameMechanicGroup[]>([]);

    const launchGame = (gameId: string) => {
        if (difficulty !== undefined && rewardPoints !== undefined) {
            navigate(`/subject/${subjectId}/game/${gameId}?difficulty=${difficulty}&reward=${rewardPoints}`);
        } else {
            navigate(`/subject/${subjectId}/game/${gameId}`);
        }
    };

    const handleBack = () => navigate(`/subject/${subjectId}/map`);

    useEffect(() => {
        const fetchSubjectAndGames = async () => {
            if (!subjectId) return;
            try {
                setLoading(true);

                const subjectResponse = await api.get(`/api/subjects/${subjectId}`);
                setSubjectName(subjectResponse.data.name);

                const subjectNameLower = subjectResponse.data.name.toLowerCase();
                let subjectTheme: 'derivatives' | 'integrals' | 'limits' | 'series';

                if (subjectNameLower.includes('предел')) {
                    subjectTheme = 'limits';
                } else if (subjectNameLower.includes('ряд')) {
                    subjectTheme = 'series';
                } else if (subjectNameLower.includes('производн') || subjectNameLower.includes('дифференц') || subjectId === '1') {
                    subjectTheme = 'derivatives';
                } else {
                    subjectTheme = 'integrals';
                }

                const availableGames: GameInfo[] = [
                    {
                        id: 'deriv-fall',
                        title: 'DerivFall',
                        description: 'Находите производные падающих выражений до того, как они достигнут дна!',
                        icon: '📉',
                        mechanicType: 'падение',
                        subject: 'derivatives',
                        difficulty: difficulty ?? 3,
                        estimatedTime: 1,
                    },
                    {
                        id: 'integral-builder',
                        title: 'IntegralBuilder',
                        description: 'Соберите правильные интегралы из предложенных частей!',
                        icon: '🧩',
                        mechanicType: 'сборка',
                        subject: 'integrals',
                        difficulty: difficulty ?? 4,
                        estimatedTime: 10,
                    },
                    // MathLab: Производные/Интегралы архивированы (R4) — см.
                    // gameMockData.ts. DerivFall/IntegralBuilder уже покрывают
                    // эти темы своими механиками.
                    {
                        id: 'limits-approach',
                        title: 'Приближение',
                        description: 'Смотрите, к чему стремится график функции, и угадывайте предел!',
                        icon: '🔎',
                        mechanicType: 'приближение',
                        subject: 'limits',
                        difficulty: difficulty ?? 3,
                        estimatedTime: 8,
                    },
                    {
                        id: 'series-filling',
                        title: 'Наполнение',
                        description: 'Смотрите, как растёт сумма ряда, и угадывайте, сходится ли она!',
                        icon: '🥤',
                        mechanicType: 'наполнение',
                        subject: 'series',
                        difficulty: difficulty ?? 3,
                        estimatedTime: 8,
                    },
                ];

                let filteredGames = availableGames.filter(g => g.subject === subjectTheme);

                if (mechanicType) {
                    const mechanicMap: Record<string, string> = {
                        fall: 'падение',
                        builder: 'сборка',
                        lab: 'лаборатория',
                    };
                    const mapped = mechanicMap[mechanicType];
                    if (mapped) filteredGames = filteredGames.filter(g => g.mechanicType === mapped);
                }

                const mechanicTypes = [...new Set(filteredGames.map(g => g.mechanicType))];
                const groupedGames: GameMechanicGroup[] = mechanicTypes.map(type => ({
                    title: type === 'падение' ? 'Игры на быструю реакцию'
                        : type === 'сборка'  ? 'Игры на конструирование'
                            : type === 'лаборатория' ? 'Исследовательские игры'
                                : (type === 'приближение' || type === 'наполнение') ? 'Игры на визуальную интуицию'
                                    : 'Другие игры',
                    type,
                    games: filteredGames.filter(g => g.mechanicType === type),
                }));

                setGames(filteredGames);
                setGameGroups(groupedGames);
                if (filteredGames.length === 1) setSelectedGame(filteredGames[0]);
            } catch (err) {
                setError('Не удалось загрузить данные. Попробуйте позже.');
            } finally {
                setLoading(false);
            }
        };

        fetchSubjectAndGames();
    }, [subjectId, mechanicType, difficulty]);

    // — Loading —
    if (loading) {
        return (
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
    }

    // — Error —
    if (error) {
        return (
            <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
                <Navbar />
                <div className="container mx-auto px-4 py-8 mt-16">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center transition-colors">
                        <p className="text-red-500 dark:text-red-400 text-lg mb-4 transition-colors">{error}</p>
                        <Button onClick={handleBack}>Вернуться к карте</Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <Navbar />
            <div className="container mx-auto px-4 py-8 mt-16">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden transition-colors">
                    <div className="p-6">

                        {/* Шапка */}
                        <div className="mb-6">
                            <Button variant="outline" onClick={handleBack} className="mb-4">
                                ← Вернуться к карте
                            </Button>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
                                {mechanicType
                                    ? `Игры типа "${mechanicType}" по теме "${subjectName}"`
                                    : `Игры по теме ${subjectName}`}
                            </h1>
                        </div>

                        {/* Баннер настроек */}
                        {difficulty !== undefined && rewardPoints !== undefined && (
                            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl transition-colors">
                                <h2 className="text-base font-semibold text-blue-700 dark:text-blue-300 mb-2 transition-colors">
                                    Выбранные настройки:
                                </h2>
                                <div className="flex gap-6 text-sm">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-yellow-500">★</span>
                                        <span className="text-gray-700 dark:text-gray-300 transition-colors">
                                            Сложность: {difficulty}/5
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span>🏆</span>
                                        <span className="text-gray-700 dark:text-gray-300 transition-colors">
                                            Награда: {rewardPoints} очков
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Нет игр */}
                        {games.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-gray-400 dark:text-gray-500 mb-4 transition-colors">
                                    К сожалению, игры не найдены.
                                </p>
                                <Button onClick={handleBack}>Вернуться к карте</Button>
                            </div>
                        ) : (
                            <div>
                                {gameGroups.map((group) => (
                                    <div key={group.type} className="mb-8">
                                        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white transition-colors">
                                            {group.title}
                                        </h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {group.games.map((game) => (
                                                <div
                                                    key={game.id}
                                                    onClick={() => setSelectedGame(game)}
                                                    className={`p-6 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] border-2 ${
                                                        selectedGame?.id === game.id
                                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <span className="text-3xl">{game.icon}</span>
                                                        <h3 className="text-base font-semibold text-gray-900 dark:text-white transition-colors">
                                                            {game.title}
                                                        </h3>
                                                    </div>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 transition-colors">
                                                        {game.description}
                                                    </p>
                                                    <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-4 transition-colors">
                                                        <span>Сложность: {Array(game.difficulty).fill('★').join('')}</span>
                                                        <span>~{game.estimatedTime} мин</span>
                                                    </div>
                                                    <button
                                                        style={{ padding: '0.5rem' }}
                                                        className="w-full bg-green-50 dark:bg-green-500/10 hover:bg-green-100 dark:hover:bg-green-500/20 border border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400 rounded-xl text-sm font-medium transition-all"
                                                        onClick={(e) => { e.stopPropagation(); launchGame(game.id); }}
                                                    >
                                                        Быстрый запуск
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                <div className="flex justify-center mt-8">
                                    <Button
                                        onClick={() => selectedGame && launchGame(selectedGame.id)}
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