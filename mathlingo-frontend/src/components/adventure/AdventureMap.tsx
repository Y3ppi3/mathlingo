// src/components/adventure/AdventureMap.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMapData } from '../../utils/api';
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

const fetchWithErrorHandling = async (url: string) => {
    console.log(`📡 Fetching: ${url}`); // Log all API requests

    try {
        const response = await fetch(url, {
            credentials: 'include', // Include cookies for authentication
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log(`📡 Response status: ${response.status} for ${url}`);

        if (!response.ok) {
            const errorText = await response.text(); // Get error text for debugging
            console.error(`📡 Error response: ${errorText}`);
            throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`📡 Success for ${url}`, data);
        return data;
    } catch (error) {
        console.error(`📡 Fetch error for ${url}:`, error);
        throw error;
    }
};

const AdventureMap: React.FC<AdventureMapProps> = ({ subjectId }) => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [mapName, setMapName] = useState<string>('');
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth(); // Add this line
    const API_URL = import.meta.env.VITE_API_URL || '';

    useEffect(() => {
        const loadMapData = async () => {
            try {
                setLoading(true);
                setError(null);

                console.log(`🗺️ Loading map data for subject ${subjectId}`);

                // Step 1: Get maps for the subject
                let mapsData: any[];
                try {
                    const mapsEndpoint = `${API_URL}/gamification/maps/${subjectId}`;
                    mapsData = await fetchWithErrorHandling(mapsEndpoint);

                    console.log(`🗺️ Found ${mapsData.length} maps for subject ${subjectId}`);

                    if (!mapsData || mapsData.length === 0) {
                        setError('No maps found for this subject');
                        setLoading(false);
                        return;
                    }
                } catch (err) {
                    console.error('Failed to load maps list:', err);
                    setError('Could not load maps for this subject');
                    setLoading(false);
                    return;
                }

                // Step 2: Load data for the first map
                try {
                    const mapId = mapsData[0].id;
                    const mapDataEndpoint = `${API_URL}/gamification/maps/${mapId}/data`;
                    const data = await fetchWithErrorHandling(mapDataEndpoint);

                    // Set map name from data
                    setMapName(data.map.name || 'Adventure Map');

                    // Process locations with user progress
                    const processedLocations = data.map.locations.map((loc: any) => ({
                        ...loc,
                        unlocked: data.userProgress.unlockedLocations.includes(loc.id),
                        completed: data.userProgress.completedLocations.includes(loc.id),
                        taskGroups: (loc.taskGroups || []).map((group: any) => ({
                            ...group,
                            completed: data.userProgress.completedLocations.includes(group.id)
                        }))
                    }));

                    setLocations(processedLocations);
                } catch (err) {
                    console.error('Failed to load map data:', err);
                    setError('Could not load adventure map data');
                }
            } catch (err) {
                console.error('Error in loadMapData:', err);
                setError('Failed to load adventure map. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        loadMapData();
    }, [subjectId, API_URL]);

    const handleLocationClick = (location: Location) => {
        if (location.unlocked) {
            setSelectedLocation(location);
        } else {
            // Анимация или сообщение о том, что локация заблокирована
        }
    };

    const openGamesPage = () => {
        // Переходим на страницу с играми для текущего предмета
        navigate(`/subject/${subjectId}/games`);
    };

    if (loading) return <div className="flex justify-center items-center h-96">Загрузка карты приключений...</div>;
    if (error) return <div className="text-red-500 p-4">{error}</div>;

    return (
        <div className="flex flex-col space-y-4">
            <h2 className="text-xl font-semibold text-gray-100 dark:text-gray-900 transition-colors">
                {mapName}
            </h2>

            {/* Основной контейнер карты с увеличенной высотой */}
            <div className="relative w-full h-[600px] bg-gray-900 dark:bg-gray-100 rounded-lg overflow-hidden shadow-lg">
                {/* Фоновое изображение карты */}
                <div
                    className="absolute inset-0 bg-cover bg-center z-0"
                    style={{backgroundImage: 'url(/images/map-background.jpg)'}}
                ></div>

                {/* Слой затемнения */}
                <div className="absolute inset-0 bg-black/5 dark:bg-black/20 z-10"></div>

                {/* Контейнер для локаций - предотвращает перекрытие элементами боковой панели */}
                <div className="absolute inset-0 z-20">
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
                                transform: 'translate(-50%, -50%)',
                                zIndex: selectedLocation?.id === location.id ? 40 : 30
                            }}
                            onClick={() => handleLocationClick(location)}
                        >
                            <div className="w-12 h-12 flex items-center justify-center bg-white/20 dark:bg-gray-900/20 rounded-full p-1 shadow-lg">
                                <img
                                    src={location.icon_url || '/images/default-location.svg'}
                                    alt={location.name}
                                    className="w-10 h-10 object-contain"
                                />
                            </div>
                            {/* Добавляем прозрачный элемент, чтобы увеличить высоту метки и избежать накладывания текста */}
                            <div style={{ height: '25px' }}></div>
                            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full mt-2 text-xs font-bold text-white dark:text-gray-800 bg-gray-900 dark:bg-gray-600/95 px-2 py-1 rounded whitespace-nowrap" style={{
                                maxWidth: "none",  // Убираем ограничение ширины
                                zIndex: 35,        // Увеличиваем z-index чтобы метка была поверх других элементов
                                textShadow: "0px 0px 2px rgba(0,0,0,0.5)",  // Добавляем тень для лучшей видимости
                                boxShadow: "0px 1px 3px rgba(0,0,0,0.3)"    // Добавляем тень для метки
                            }}>
                                {location.name}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Информационная панель с выбранной локацией */}
                {selectedLocation && (
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gray-800/95 dark:bg-white/95 p-4 shadow-lg z-50 overflow-y-auto">
                        <button
                            className="absolute top-2 right-2 text-gray-400 hover:text-white dark:text-gray-600 dark:hover:text-gray-900 z-10"
                            onClick={() => setSelectedLocation(null)}
                        >
                            ✕
                        </button>

                        <h3 className="text-xl font-bold mb-2 text-gray-100 dark:text-gray-900">{selectedLocation.name}</h3>
                        <p className="text-sm mb-4 text-gray-300 dark:text-gray-600">{selectedLocation.description}</p>

                        <div className="mb-6">
                            <button
                                className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                                onClick={openGamesPage}
                            >
                                Открыть игры
                            </button>
                        </div>

                        <h4 className="text-lg font-semibold mb-2 text-gray-100 dark:text-gray-800">Задания:</h4>
                        {selectedLocation.taskGroups.length > 0 ? (
                            <div className="space-y-3">
                                {selectedLocation.taskGroups.map((group) => (
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
                            <p className="text-sm text-gray-400 dark:text-gray-500">В этой локации пока нет доступных заданий.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Легенда карты */}
            <div className="flex justify-center gap-6 bg-gray-800/70 dark:bg-gray-100/70 p-2 rounded">
                <div className="flex items-center">
                    <div className="w-4 h-4 bg-gray-900/20 dark:bg-white/20 rounded-full mr-2"></div>
                    <span className="text-xs text-gray-300 dark:text-gray-700">Заблокированная локация</span>
                </div>
                <div className="flex items-center">
                    <div className="w-4 h-4 bg-indigo-500/50 rounded-full mr-2"></div>
                    <span className="text-xs text-gray-300 dark:text-gray-700">Доступная локация</span>
                </div>
                <div className="flex items-center">
                    <div className="w-4 h-4 bg-green-500/50 ring-2 ring-green-500 rounded-full mr-2"></div>
                    <span className="text-xs text-gray-300 dark:text-gray-700">Завершенная локация</span>
                </div>
            </div>
        </div>
    );
};

export default AdventureMap;