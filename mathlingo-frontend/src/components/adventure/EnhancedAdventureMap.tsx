// Исправленный код для src/components/adventure/EnhancedAdventureMap.tsx
import React, { useState, useEffect } from 'react';
import { fetchMapData } from '../../utils/api';
import EnhancedLocationWidget from './EnhancedLocationWidget';

interface TaskGroup {
    id: number;
    name: string;
    description: string;
    difficulty: number;
    reward_points: number;
    tasks: number[];
    completed: boolean;
}

interface GameMechanic {
    id: string;
    name: string;
    description: string;
    icon: string;
    type: string;
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
    gameMechanics: GameMechanic[]; // Добавлено: игровые механики для локации
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

interface EnhancedAdventureMapProps {
    subjectId: number;
}

const EnhancedAdventureMap: React.FC<EnhancedAdventureMapProps> = ({ subjectId }) => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [userProgress, setUserProgress] = useState<UserProgress | null>(null);

    useEffect(() => {
        const loadMapData = async () => {
            try {
                setLoading(true);
                const data = await fetchMapData(subjectId) as MapResponse;

                // Преобразуем данные, учитывая прогресс пользователя
                const processedLocations = data.map.locations.map((loc) => {
                    // Определяем тип предмета (производные или интегралы) для правильного подбора игр
                    const subjectType = subjectId === 1 ? 'derivatives' : 'integrals';

                    // Добавляем игровые механики к локации в зависимости от её ID и типа предмета
                    const locationGameMechanics: GameMechanic[] = getGameMechanicsForLocation(loc.id, subjectType);

                    return {
                        ...loc,
                        unlocked: data.userProgress.unlockedLocations.includes(loc.id),
                        completed: data.userProgress.completedLocations.includes(loc.id),
                        taskGroups: loc.taskGroups.map((group) => ({
                            ...group,
                            completed: data.userProgress.completedLocations.includes(group.id)
                        })),
                        gameMechanics: locationGameMechanics
                    };
                });

                setLocations(processedLocations);
                setUserProgress(data.userProgress);
            } catch (err) {
                setError('Не удалось загрузить карту приключений. Попробуйте позже.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadMapData();
    }, [subjectId]);

    // Функция для определения доступных игровых механик для локации
    const getGameMechanicsForLocation = (locationId: number, subjectType: 'derivatives' | 'integrals'): GameMechanic[] => {
        // Здесь можно реализовать логику распределения механик по локациям
        // В нашем случае просто имитируем, что у разных локаций разные наборы механик

        const allMechanics: Record<string, GameMechanic[]> = {
            derivatives: [
                {
                    id: 'deriv-fall',
                    name: 'Падающие производные',
                    description: 'Находите производные падающих выражений!',
                    icon: '📉',
                    type: 'fall'
                },
                {
                    id: 'math-lab-derivatives',
                    name: 'Лаборатория производных',
                    description: 'Исследуйте функции и их производные!',
                    icon: '🔬',
                    type: 'lab'
                }
            ],
            integrals: [
                {
                    id: 'integral-builder',
                    name: 'Конструктор интегралов',
                    description: 'Соберите правильные интегралы из частей!',
                    icon: '🧩',
                    type: 'builder'
                },
                {
                    id: 'math-lab-integrals',
                    name: 'Лаборатория интегралов',
                    description: 'Исследуйте функции и их интегралы!',
                    icon: '🧪',
                    type: 'lab'
                }
            ]
        };

        // Логика распределения механик по локациям
        // Первая локация имеет все механики, остальные - по одной случайной
        if (locationId === 1) {
            return allMechanics[subjectType];
        } else {
            // Выбираем одну механику в зависимости от ID локации
            const mechIndex = (locationId % allMechanics[subjectType].length);
            return [allMechanics[subjectType][mechIndex]];
        }
    };

    const handleLocationClick = (location: Location) => {
        if (location.unlocked) {
            setSelectedLocation(location);
        } else {
            // Анимация или сообщение о том, что локация заблокирована
        }
    };

    if (loading) return <div className="flex justify-center items-center h-96">Загрузка карты приключений...</div>;
    if (error) return <div className="text-red-500 p-4">{error}</div>;

    return (
        <div className="relative w-full h-96 bg-white dark:bg-gray-800 rounded-lg overflow-hidden transition-colors">
            {/* Фоновое изображение карты */}
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/images/map-background.jpg)' }}></div>

            {/* Информационная панель с прогрессом */}
            {userProgress && (
                <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-90 p-3 rounded-lg shadow-lg transition-colors">
                    <div className="flex items-center space-x-3">
                        <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                            Уровень {userProgress.level}
                        </div>
                        <div className="text-gray-700 dark:text-gray-300">
                            {userProgress.totalPoints} очков
                        </div>
                    </div>
                </div>
            )}

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
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full mt-1 text-xs font-bold text-gray-800 dark:text-gray-200 transition-colors">
                        {location.name}
                    </div>

                    {/* Индикаторы игровых механик */}
                    {location.unlocked && location.gameMechanics.length > 0 && (
                        <div className="absolute -top-2 -right-2 flex">
                            {location.gameMechanics.slice(0, 2).map((mechanic, index) => (
                                <div key={mechanic.id} className="w-6 h-6 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-md transition-colors" style={{ marginLeft: index > 0 ? '-0.5rem' : '0' }}>
                                    <span>{mechanic.icon}</span>
                                </div>
                            ))}
                            {location.gameMechanics.length > 2 && (
                                <div className="w-6 h-6 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-md transition-colors" style={{ marginLeft: '-0.5rem' }}>
                                    <span>+{location.gameMechanics.length - 2}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}

            {/* Боковая панель с информацией о выбранной локации */}
            {selectedLocation && (
                <EnhancedLocationWidget
                    locationName={selectedLocation.name}
                    locationDescription={selectedLocation.description}
                    subjectId={subjectId}
                    taskGroups={selectedLocation.taskGroups}
                    gameMechanics={selectedLocation.gameMechanics}
                    onClose={() => setSelectedLocation(null)}
                />
            )}
        </div>
    );
};

export default EnhancedAdventureMap;