// src/components/adventure/AdventureMap.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config/apiBase';

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
    const API_URL = API_BASE;

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
            } catch {
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

            {/* Карта. Высота адаптивна: ниже на телефоне. Фон и иконки —
                самодостаточные (CSS-градиент + инлайн-SVG), без внешних
                картинок: прежние /images/*.jpg|svg отдавали 404. */}
            <div className="relative w-full h-[380px] sm:h-[520px] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">

                {/* Фон-градиент */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 dark:from-slate-900 dark:via-gray-900 dark:to-indigo-950" />
                {/* Точечная «сетка карты» */}
                <div
                    className="absolute inset-0 opacity-70 dark:opacity-40"
                    style={{
                        backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.28) 1px, transparent 1.4px)',
                        backgroundSize: '22px 22px',
                    }}
                />

                {/* Локации. Позиции клампятся, чтобы узел и подпись не
                    обрезались у краёв на узких экранах. */}
                <div className="absolute inset-0">
                    {locations.map(location => (
                        <button
                            type="button"
                            key={location.id}
                            disabled={!location.unlocked}
                            className={`absolute p-0 border-0 bg-transparent transition-transform duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-full ${
                                location.unlocked
                                    ? 'cursor-pointer hover:scale-110'
                                    : 'opacity-45 grayscale cursor-not-allowed'
                            }`}
                            style={{
                                left:      `clamp(3.5rem, ${location.position_x}%, calc(100% - 3.5rem))`,
                                top:       `clamp(2.5rem, ${location.position_y}%, calc(100% - 3.5rem))`,
                                transform: 'translate(-50%, -50%)',
                                zIndex:    selectedLocation?.id === location.id ? 20 : 10,
                            }}
                            onClick={() => handleLocationClick(location)}
                        >
                            {/* Иконка-маркер по состоянию */}
                            <span className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lg ring-2 ${
                                location.completed
                                    ? 'bg-green-500 ring-green-300'
                                    : location.unlocked
                                        ? 'bg-indigo-500 ring-indigo-300'
                                        : 'bg-gray-500 ring-gray-400'
                            }`}>
                                {location.completed ? (
                                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : location.unlocked ? (
                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.364 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.446a1 1 0 00-1.176 0l-3.366 2.446c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.343 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.951-.69l1.285-3.958z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                )}
                            </span>

                            {/* Название */}
                            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 block max-w-[6.5rem] truncate text-center text-xs font-semibold text-white bg-gray-900/85 px-2 py-0.5 rounded-lg shadow">
                                {location.name}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Боковая панель выбранной локации */}
                {selectedLocation && (
                    <div className="absolute right-0 top-0 bottom-0 w-full sm:w-80 bg-white/95 dark:bg-gray-800/95 backdrop-blur border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col overflow-hidden transition-colors">

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