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

    const startTaskGroup = (taskGroupId: number) => {
        navigate(`/subject/${subjectId}/task-group/${taskGroupId}`);
    };

    if (loading) return <div className="flex justify-center items-center h-96">Загрузка карты приключений...</div>;
    if (error) return <div className="text-red-500 p-4">{error}</div>;

    return (
        <div className="relative w-full h-96 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
            {/* Фоновое изображение карты */}
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/images/map-background.jpg)' }}></div>

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
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full mt-1 text-xs font-bold">
                        {location.name}
                    </div>
                </div>
            ))}

            {/* Боковая панель с информацией о выбранной локации */}
            {selectedLocation && (
                <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white dark:bg-gray-900 bg-opacity-90 dark:bg-opacity-90 p-4 shadow-lg">
                    <button
                        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        onClick={() => setSelectedLocation(null)}
                    >
                        &times;
                    </button>

                    <h3 className="text-xl font-bold mb-2">{selectedLocation.name}</h3>
                    <p className="text-sm mb-4">{selectedLocation.description}</p>

                    <h4 className="text-lg font-semibold mb-2">Задания:</h4>
                    {selectedLocation.taskGroups.length > 0 ? (
                        <div className="space-y-3">
                            {selectedLocation.taskGroups.map((group) => (
                                <div
                                    key={group.id}
                                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                                        group.completed
                                            ? 'bg-green-100 dark:bg-green-900'
                                            : 'bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800'
                                    }`}
                                    onClick={() => startTaskGroup(group.id)}
                                >
                                    <div className="flex justify-between items-center">
                                        <h5 className="font-medium">{group.name}</h5>
                                        <span className="text-xs px-2 py-1 rounded bg-blue-200 dark:bg-blue-700">
                      {group.reward_points} очков
                    </span>
                                    </div>
                                    <p className="text-xs mt-1">{group.description}</p>
                                    <div className="flex items-center mt-2">
                                        <div className="flex">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <span
                                                    key={i}
                                                    className={`w-4 h-4 ${
                                                        i < group.difficulty
                                                            ? 'text-yellow-500'
                                                            : 'text-gray-300 dark:text-gray-600'
                                                    }`}
                                                >
                          ★
                        </span>
                                            ))}
                                        </div>
                                        <span className="text-xs ml-2">
                      {group.tasks.length} задани{group.tasks.length === 1 ? 'е' : 'й'}
                    </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">В этой локации пока нет доступных заданий.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdventureMap;