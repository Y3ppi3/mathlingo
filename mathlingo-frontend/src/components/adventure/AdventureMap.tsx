// src/components/adventure/AdventureMap.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface TaskGroup {
    id: number;
    name: string;
    description: string;
    difficulty: number;
    reward_points: number;
    tasks: number[];
    completed: boolean;
}

interface Location {
    id: number;
    name: string;
    description: string;
    position_x: number;
    position_y: number;
    icon_url: string;
    unlocked: boolean;
    completed: boolean;
    taskGroups: TaskGroup[];
}

interface AdventureMapProps {
    subjectId: number;
}

const fetchWithErrorHandling = async (url: string) => {
    const response = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    return response.json();
};

const AdventureMap = ({ subjectId }: AdventureMapProps) => {
    const [locations, setLocations]               = useState<Location[]>([]);
    const [loading, setLoading]                   = useState(true);
    const [error, setError]                       = useState<string | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [mapName, setMapName]                   = useState('');
    const [mapSubjectType, setMapSubjectType]     = useState('');
    const navigate    = useNavigate();
    const { isAuthenticated } = useAuth();
    const API_URL = import.meta.env.VITE_API_URL || '';

    useEffect(() => {
        const loadMapData = async () => {
            try {
                setLoading(true);
                setError(null);

                const mapsData: any[] = await fetchWithErrorHandling(`${API_URL}/gamification/maps/${subjectId}`);

                if (!mapsData?.length) {
                    setError('Карты для этого предмета не найдены');
                    return;
                }

                // Определяем тип предмета
                if (mapsData[0].subject_type) {
                    setMapSubjectType(mapsData[0].subject_type);
                } else {
                    const name = (mapsData[0].name || '').toLowerCase();
                    setMapSubjectType(
                        name.includes('интеграл') ? 'integrals' :
                            name.includes('производ') ? 'derivatives' : 'derivatives'
                    );
                }

                const data = await fetchWithErrorHandling(`${API_URL}/gamification/maps/${mapsData[0].id}/data`);
                setMapName(data.map.name || 'Карта приключений');

                const processedLocations = data.map.locations.map((loc: any) => ({
                    ...loc,
                    unlocked:   data.userProgress.unlockedLocations.includes(loc.id),
                    completed:  data.userProgress.completedLocations.includes(loc.id),
                    taskGroups: (loc.taskGroups || []).map((g: any) => ({
                        ...g,
                        completed: data.userProgress.completedLocations.includes(g.id),
                    })),
                }));

                setLocations(processedLocations);
            } catch (err) {
                setError('Не удалось загрузить карту приключений. Попробуйте позже.');
            } finally {
                setLoading(false);
            }
        };

        loadMapData();
    }, [subjectId, API_URL]);

    const handleLocationClick = (location: Location) => {
        if (location.unlocked) setSelectedLocation(location);
    };

    const openGamesPage = (group: TaskGroup) => {
        navigate(`/subject/${subjectId}/games?difficulty=${group.difficulty}&reward=${group.reward_points}`);
    };

    const launchGameDirectly = (group: TaskGroup) => {
        let gameType = 'deriv-fall';
        if (mapSubjectType === 'integrals') {
            gameType = group.difficulty > 3 ? 'math-lab-integrals' : 'integral-builder';
        } else {
            gameType = group.difficulty > 3 ? 'math-lab-derivatives' : 'deriv-fall';
        }
        navigate(`/subject/${subjectId}/game/${gameType}?difficulty=${group.difficulty}&reward=${group.reward_points}`);
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500 transition-colors">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Загрузка карты...
            </div>
        </div>
    );

    if (error) return (
        <div className="flex justify-center items-center h-32">
            <p className="text-red-500 dark:text-red-400 text-sm transition-colors">{error}</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            {mapName && (
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors">
                    {mapName}
                </h2>
            )}

            {/* Карта */}
            <div className="relative w-full h-[560px] bg-gray-100 dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">

                {/* Фон */}
                <div
                    className="absolute inset-0 bg-cover bg-center z-0"
                    style={{ backgroundImage: 'url(/images/map-background.jpg)' }}
                />
                {/* Затемнение */}
                <div className="absolute inset-0 bg-black/10 dark:bg-black/30 z-10" />

                {/* Локации */}
                <div className="absolute inset-0 z-20">
                    {locations.map(location => (
                        <div
                            key={location.id}
                            className={`absolute cursor-pointer transition-all duration-300 ${
                                location.unlocked
                                    ? 'opacity-100 hover:scale-110'
                                    : 'opacity-40 grayscale pointer-events-none'
                            }`}
                            style={{
                                left:      `${location.position_x}%`,
                                top:       `${location.position_y}%`,
                                transform: 'translate(-50%, -50%)',
                                zIndex:    selectedLocation?.id === location.id ? 40 : 30,
                            }}
                            onClick={() => handleLocationClick(location)}
                        >
                            {/* Иконка локации */}
                            <div className={`w-12 h-12 flex items-center justify-center rounded-full shadow-lg p-1 ${
                                location.completed
                                    ? 'bg-green-500/80 ring-2 ring-green-400'
                                    : location.unlocked
                                        ? 'bg-indigo-500/80 ring-2 ring-indigo-400'
                                        : 'bg-gray-500/60'
                            }`}>
                                <img
                                    src={location.icon_url || '/images/default-location.svg'}
                                    alt={location.name}
                                    className="w-8 h-8 object-contain"
                                />
                            </div>

                            {/* Название */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap z-50">
                                <span className="text-xs font-semibold text-white bg-gray-900/80 dark:bg-gray-800/90 px-2 py-0.5 rounded-lg shadow">
                                    {location.name}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Боковая панель выбранной локации */}
                {selectedLocation && (
                    <div className="absolute right-0 top-0 bottom-0 w-72 bg-white/95 dark:bg-gray-800/95 backdrop-blur border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col overflow-hidden transition-colors">

                        {/* Шапка панели */}
                        <div className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 transition-colors">
                            <div className="flex-1 pr-2">
                                <h3 className="text-base font-bold text-gray-900 dark:text-white transition-colors">
                                    {selectedLocation.name}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">
                                    {selectedLocation.description}
                                </p>
                            </div>
                            <button
                                style={{ padding: '0.25rem' }}
                                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-lg leading-none"
                                onClick={() => setSelectedLocation(null)}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Кнопка открыть все игры */}
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 transition-colors">
                            <button
                                style={{ padding: '0.5rem 1rem' }}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
                                onClick={() => navigate(`/subject/${subjectId}/games`)}
                            >
                                Все игры локации
                            </button>
                        </div>

                        {/* Список заданий — прокручиваемый */}
                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors">
                                Задания ({selectedLocation.taskGroups.length})
                            </h4>

                            {selectedLocation.taskGroups.length > 0 ? (
                                selectedLocation.taskGroups.map(group => (
                                    <div
                                        key={group.id}
                                        className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 transition-colors"
                                    >
                                        {/* Заголовок группы */}
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <span className="text-sm font-medium text-gray-900 dark:text-white leading-snug transition-colors">
                                                {group.name}
                                            </span>
                                            <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-medium transition-colors">
                                                +{group.reward_points} оч.
                                            </span>
                                        </div>

                                        {group.description && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 transition-colors">
                                                {group.description}
                                            </p>
                                        )}

                                        {/* Сложность + кол-во заданий */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="flex">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <span
                                                        key={i}
                                                        className={`text-sm ${i < group.difficulty ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                                                    >
                                                        ★
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="text-xs text-gray-400 dark:text-gray-500 transition-colors">
                                                {group.tasks.length} задани{group.tasks.length === 1 ? 'е' : 'й'}
                                            </span>
                                            {group.completed && (
                                                <span className="ml-auto text-xs text-green-600 dark:text-green-400 font-medium transition-colors">
                                                    ✓ Пройдено
                                                </span>
                                            )}
                                        </div>

                                        {/* Кнопки */}
                                        <div className="flex gap-2">
                                            <button
                                                style={{ padding: '0.375rem 0.5rem' }}
                                                className="flex-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-white rounded-lg text-xs font-medium transition-all"
                                                onClick={() => openGamesPage(group)}
                                            >
                                                Выбор игры
                                            </button>
                                            <button
                                                style={{ padding: '0.375rem 0.5rem' }}
                                                className="flex-1 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-medium transition-all"
                                                onClick={() => launchGameDirectly(group)}
                                            >
                                                ▶ Старт
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4 transition-colors">
                                    В этой локации пока нет доступных заданий.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Легенда */}
            <div className="flex flex-wrap justify-center gap-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl transition-colors">
                {[
                    { color: 'bg-gray-400/60',              label: 'Заблокировано' },
                    { color: 'bg-indigo-500/70 ring-2 ring-indigo-400', label: 'Доступно' },
                    { color: 'bg-green-500/70 ring-2 ring-green-400',   label: 'Пройдено'  },
                ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${color}`} />
                        <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors">{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdventureMap;