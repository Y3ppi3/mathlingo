// src/components/adventure/AdventureMap.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMapData } from '../../utils/api';

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

interface MapData {
    id: number;
    name: string;
    description: string;
    background_image: string;
    subject_id: number;
    locations: Location[];
}

interface UserProgress {
    level: number;
    totalPoints: number;
    completedLocations: number[];
    unlockedLocations: number[];
    unlockedAchievements: number[];
}

interface MapResponse {
    map: MapData;
    userProgress: UserProgress;
}

interface AdventureMapProps {
    subjectId: number;
}

const AdventureMap: React.FC<AdventureMapProps> = ({ subjectId }) => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const loadMapData = async () => {
            try {
                setLoading(true);
                const data = await fetchMapData(subjectId) as MapResponse;

                // Преобразуем данные, учитывая прогресс пользователя
                const processedLocations = data.map.locations.map((loc) => ({
                    ...loc,
                    unlocked: data.userProgress.unlockedLocations.includes(loc.id),
                    completed: data.userProgress.completedLocations.includes(loc.id),
                    taskGroups: loc.taskGroups.map((group) => ({
                        ...group,
                        completed: data.userProgress.completedLocations.includes(group.id)
                    }))
                }));

                setLocations(processedLocations);
            } catch (err) {
                setError('Не удалось загрузить карту приключений. Попробуйте позже.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadMapData();
    }, [subjectId]);

    const handleLocationClick = (location: Location) => {
        if (location.unlocked) {
            setSelectedLocation(location);
        } else {
            // Анимация или сообщение о том, что локация заблокирована
        }
    };

    // ИСПРАВЛЕНО: переход на страницу с играми вместо заданий
    const openGamesPage = () => {
        // Переходим на страницу с играми для текущего предмета
        navigate(`/subject/${subjectId}/games`);
    };

    if (loading) return <div className="flex justify-center items-center h-96">Загрузка карты приключений...</div>;
    if (error) return <div className="text-red-500 p-4">{error}</div>;

    return (
        <div className="relative w-full h-96 bg-gray-800 dark:bg-white rounded-lg overflow-hidden">
            {/* Фоновое изображение карты с адаптивным слоем затемнения */}
            <div className="absolute inset-0 bg-cover bg-center"
                 style={{backgroundImage: 'url(/images/map-background.jpg)'}}></div>

            {/* Слой затемнения (разный для светлой/темной темы) */}
            <div className="absolute inset-0 bg-black/10 dark:bg-black/10 transition-colors"></div>



            {/* Локации на карте */}
            {locations.map((location) => (
                <div
                    key={location.id}
                    className={`absolute cursor-pointer transition-all duration-300 ${
                        location.unlocked ? 'opacity-100 hover:scale-110' : 'opacity-50 filter grayscale'
                    } ${location.completed ? 'ring-2 ring-green-500' : ''}`}
                    style={{
                        left: `${location.position_x}%`,
                        top: `${location.position_y}%`,
                        transform: 'translate(-50%, -50%)'
                    }}
                    onClick={() => handleLocationClick(location)}
                >
                    <div className="w-12 h-12 flex items-center justify-center">
                        <img
                            src={location.icon_url || '/images/default-location.svg'}
                            alt={location.name}
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <div
                        className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full mt-1 text-xs font-bold text-gray-200 dark:text-gray-800">
                        {location.name}
                    </div>
                </div>
            ))}

            {/* Боковая панель с информацией о выбранной локации */}
            {selectedLocation && (
                <div
                    className="absolute right-0 top-0 bottom-0 w-1/3 bg-gray-800 dark:bg-white bg-opacity-90 dark:bg-opacity-90 p-4 shadow-lg">
                    <button
                        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        onClick={() => setSelectedLocation(null)}
                    >
                        &times;
                    </button>

                    <h3 className="text-xl font-bold mb-2 text-white dark:text-gray-800">{selectedLocation.name}</h3>
                    <p className="text-sm mb-4 text-gray-600 dark:text-gray-800">{selectedLocation.description}</p>

                    {/* ИСПРАВЛЕНО: добавлена кнопка для перехода на страницу с играми */}
                    <div className="mb-6">
                        <button
                            className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                            onClick={openGamesPage}
                        >
                            Открыть игры
                        </button>
                    </div>

                    <h4 className="text-lg font-semibold mb-2 text-white dark:text-gray-800">Задания:</h4>
                    {selectedLocation.taskGroups.length > 0 ? (
                        <div className="space-y-3">
                            {selectedLocation.taskGroups.map((group) => (
                                // Исправленная версия секции с карточками заданий
                                <div
                                    key={group.id}
                                    className="p-3 rounded-lg transition-colors bg-gray-700 hover:bg-gray-600 dark:bg-gray-100 dark:hover:bg-gray-200 border border-gray-600 dark:border-gray-200"
                                >
                                    <div className="flex justify-between items-center">
                                        <h5 className="font-medium text-gray-100 dark:text-gray-800">{group.name}</h5>
                                        <span className="text-xs px-2 py-1 rounded bg-indigo-600 text-white">
                                            {group.reward_points} очков
                                        </span>
                                    </div>
                                    <p className="text-xs mt-1 text-gray-300 dark:text-gray-500">{group.description}</p>
                                    <div className="flex items-center mt-2">
                                        <div className="flex">
                                            {Array.from({length: 5}).map((_, i) => (
                                                <span
                                                    key={i}
                                                    className={`w-4 h-4 ${
                                                        i < group.difficulty
                                                            ? 'text-yellow-400'  // Ярче для лучшей видимости
                                                            : 'text-gray-600'    // Темнее для неактивных
                                                    }`}
                                                >
                                                    ★
                                                </span>
                                            ))}
                                        </div>
                                        <span className="text-xs ml-2 text-gray-300 dark:text-gray-500">
                                            {group.tasks.length} задани{group.tasks.length === 1 ? 'е' : 'й'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">В этой локации пока нет доступных
                            заданий.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdventureMap;