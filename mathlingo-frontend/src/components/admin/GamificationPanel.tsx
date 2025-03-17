// src/components/admin/GamificationPanel.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';

interface Subject {
    id: number;
    name: string;
    code: string;
}

interface AdventureMap {
    id: number;
    name: string;
    description: string;
    background_image: string;
    subject_id: number;
}

interface MapLocation {
    id: number;
    name: string;
    description: string;
    position_x: number;
    position_y: number;
    icon_url: string;
    unlocked_by_location_id: number | null;
    adventure_map_id: number;
}

interface TaskGroup {
    id: number;
    name: string;
    description: string;
    location_id: number;
    difficulty: number;
    reward_points: number;
}

interface Task {
    id: number;
    title: string;
    description: string;
    subject: string;
    subject_id: number;
}

const GamificationPanel: React.FC = () => {

    // Состояния для списков данных
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [maps, setMaps] = useState<AdventureMap[]>([]);
    const [locations, setLocations] = useState<MapLocation[]>([]);
    const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);

    // Состояния для выбранных элементов
    const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
    const [selectedMap, setSelectedMap] = useState<number | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
    const [selectedTaskGroup, setSelectedTaskGroup] = useState<number | null>(null);

    // Состояния для форм
    const [showMapForm, setShowMapForm] = useState(false);
    const [showLocationForm, setShowLocationForm] = useState(false);
    const [showTaskGroupForm, setShowTaskGroupForm] = useState(false);
    const [showAssignTasksForm, setShowAssignTasksForm] = useState(false);

    // Данные форм
    const [mapForm, setMapForm] = useState({
        name: '',
        description: '',
        background_image: ''
    });

    const [locationForm, setLocationForm] = useState({
        name: '',
        description: '',
        position_x: 50,
        position_y: 50,
        icon_url: '',
        unlocked_by_location_id: null as number | null
    });

    const [taskGroupForm, setTaskGroupForm] = useState({
        name: '',
        description: '',
        difficulty: 1,
        reward_points: 10
    });

    const [selectedTasks, setSelectedTasks] = useState<number[]>([]);

    // Загрузка данных
    useEffect(() => {
        fetchSubjects();
    }, []);

    useEffect(() => {
        if (selectedSubject) {
            fetchMaps(selectedSubject);
            fetchTasks(selectedSubject);
        } else {
            setMaps([]);
            setTasks([]);
        }
        setSelectedMap(null);
        setLocations([]);
    }, [selectedSubject]);

    useEffect(() => {
        if (selectedMap) {
            fetchLocations(selectedMap);
        } else {
            setLocations([]);
        }
        setSelectedLocation(null);
        setTaskGroups([]);
    }, [selectedMap]);

    useEffect(() => {
        if (selectedLocation) {
            fetchTaskGroups(selectedLocation);
        } else {
            setTaskGroups([]);
        }
        setSelectedTaskGroup(null);
    }, [selectedLocation]);

    // Функции загрузки данных
    const fetchSubjects = async () => {
        try {
            const response = await api.get('/admin/subjects');
            setSubjects(response.data);
        } catch (error) {
            console.error('Ошибка при загрузке предметов:', error);
            alert('Не удалось загрузить предметы');
        }
    };

    const fetchMaps = async (subjectId: number) => {
        try {
            const response = await api.get(`/gamification/maps/${subjectId}`);
            setMaps(response.data);
        } catch (error) {
            console.error('Ошибка при загрузке карт:', error);
            // Если карт нет, то просто установим пустой массив
            setMaps([]);
        }
    };

    const fetchLocations = async (mapId: number) => {
        try {
            const response = await api.get(`/admin/gamification/maps/${mapId}/locations`);
            setLocations(response.data);
        } catch (error) {
            console.error('Ошибка при загрузке локаций:', error);
            setLocations([]);
        }
    };

    const fetchTaskGroups = async (locationId: number) => {
        try {
            const response = await api.get(`/admin/gamification/locations/${locationId}/task-groups`);
            setTaskGroups(response.data);
        } catch (error) {
            console.error('Ошибка при загрузке групп заданий:', error);
            setTaskGroups([]);
        }
    };

    const fetchTasks = async (subjectId: number) => {
        try {
            const response = await api.get(`/admin/tasks?subject_id=${subjectId}`);
            setTasks(response.data);
        } catch (error) {
            console.error('Ошибка при загрузке заданий:', error);
            setTasks([]);
        }
    };

    // Функции отправки форм
    const handleCreateMap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubject) return;

        try {
            await api.post('/gamification/maps/', {
                ...mapForm,
                subject_id: selectedSubject
            });

            fetchMaps(selectedSubject);
            setShowMapForm(false);
            setMapForm({ name: '', description: '', background_image: '' });
        } catch (error) {
            console.error('Ошибка при создании карты:', error);
            alert('Не удалось создать карту');
        }
    };

    const handleCreateLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMap) return;

        try {
            await api.post('/admin/gamification/locations', {
                ...locationForm,
                adventure_map_id: selectedMap
            });

            fetchLocations(selectedMap);
            setShowLocationForm(false);
            setLocationForm({
                name: '',
                description: '',
                position_x: 50,
                position_y: 50,
                icon_url: '',
                unlocked_by_location_id: null
            });
        } catch (error) {
            console.error('Ошибка при создании локации:', error);
            alert('Не удалось создать локацию');
        }
    };

    const handleCreateTaskGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLocation) return;

        try {
            await api.post('/admin/gamification/task-groups', {
                ...taskGroupForm,
                location_id: selectedLocation
            });

            fetchTaskGroups(selectedLocation);
            setShowTaskGroupForm(false);
            setTaskGroupForm({ name: '', description: '', difficulty: 1, reward_points: 10 });
        } catch (error) {
            console.error('Ошибка при создании группы заданий:', error);
            alert('Не удалось создать группу заданий');
        }
    };

    const handleAssignTasks = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTaskGroup || selectedTasks.length === 0) return;

        try {
            await api.post(`/admin/gamification/task-groups/${selectedTaskGroup}/assign-tasks`, {
                task_ids: selectedTasks
            });

            setShowAssignTasksForm(false);
            setSelectedTasks([]);
            alert('Задания успешно назначены группе');
        } catch (error) {
            console.error('Ошибка при назначении заданий:', error);
            alert('Не удалось назначить задания');
        }
    };

    const toggleTaskSelection = (taskId: number) => {
        if (selectedTasks.includes(taskId)) {
            setSelectedTasks(prev => prev.filter(id => id !== taskId));
        } else {
            setSelectedTasks(prev => [...prev, taskId]);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Управление геймификацией</h1>

            {/* Выбор предмета */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">1. Выберите предмет</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {subjects.map(subject => (
                        <div
                            key={subject.id}
                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                selectedSubject === subject.id
                                    ? 'bg-blue-100 border-blue-500 dark:bg-blue-900 dark:border-blue-500 text-blue-800 dark:text-blue-100'
                                    : 'border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200'
                            }`}
                            onClick={() => setSelectedSubject(subject.id)}
                        >
                            <div className="font-medium">{subject.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{subject.code}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Управление картами */}
            {selectedSubject && (
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-semibold">2. Карты приключений</h2>
                        <button
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            onClick={() => setShowMapForm(true)}
                        >
                            Добавить карту
                        </button>
                    </div>

                    {maps.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {maps.map(map => (
                                <div
                                    key={map.id}
                                    className={`p-4 border rounded-lg cursor-pointer ${
                                        selectedMap === map.id
                                            ? 'bg-blue-100 border-blue-500 dark:bg-blue-900 dark:border-blue-500'
                                            : 'border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                                    }`}
                                    onClick={() => setSelectedMap(map.id)}
                                >
                                    <div className="font-medium">{map.name}</div>
                                    <div className="text-sm text-gray-500 line-clamp-2">{map.description}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-gray-500 dark:text-gray-400">Нет доступных карт для этого предмета</p>
                            <button
                                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                onClick={() => setShowMapForm(true)}
                            >
                                Создать первую карту
                            </button>
                        </div>
                    )}

                    {/* Форма создания карты */}
                    {showMapForm && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
                                <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Создание карты
                                    приключений</h3>
                                <form onSubmit={handleCreateMap}>
                                    <div className="mb-4">
                                        <label className="block mb-1 text-gray-700 dark:text-gray-300">Название
                                            карты</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                                            value={mapForm.name}
                                            onChange={e => setMapForm({...mapForm, name: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-1">Описание</label>
                                        <textarea
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                            value={mapForm.description}
                                            onChange={e => setMapForm({...mapForm, description: e.target.value})}
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-1">URL фонового изображения</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                            value={mapForm.background_image}
                                            onChange={e => setMapForm({...mapForm, background_image: e.target.value})}
                                        />
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                        <button
                                            type="button"
                                            className="px-4 py-2 border rounded dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                            onClick={() => {
                                                setShowMapForm(false);
                                                setMapForm({name: '', description: '', background_image: ''});
                                            }}
                                        >
                                            Отмена
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                        >
                                            Создать
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Управление локациями */}
            {selectedMap && (
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-semibold">3. Локации на карте</h2>
                        <button
                            className="px-3 py-1 bg-blue-600 text-white rounded"
                            onClick={() => setShowLocationForm(true)}
                        >
                            Добавить локацию
                        </button>
                    </div>

                    {locations.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {locations.map(location => (
                                <div
                                    key={location.id}
                                    className={`p-4 border rounded-lg cursor-pointer ${
                                        selectedLocation === location.id
                                            ? 'bg-blue-100 border-blue-500 dark:bg-blue-900 dark:border-blue-500'
                                            : 'border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                                    }`}
                                    onClick={() => setSelectedLocation(location.id)}
                                >
                                    <div className="font-medium">{location.name}</div>
                                    <div className="text-sm text-gray-500 line-clamp-2">{location.description}</div>
                                    <div className="mt-2 text-xs">
                                        <span className="text-gray-500">Позиция: {location.position_x}% x {location.position_y}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-gray-500">Нет локаций на этой карте</p>
                            <button
                                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
                                onClick={() => setShowLocationForm(true)}
                            >
                                Создать первую локацию
                            </button>
                        </div>
                    )}

                    {/* Форма создания локации */}
                    {showLocationForm && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
                                <h3 className="text-xl font-semibold mb-4">Создание локации</h3>
                                <form onSubmit={handleCreateLocation}>
                                    <div className="mb-4">
                                        <label className="block mb-1">Название локации</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                            value={locationForm.name}
                                            onChange={e => setLocationForm({ ...locationForm, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-1">Описание</label>
                                        <textarea
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                            value={locationForm.description}
                                            onChange={e => setLocationForm({ ...locationForm, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block mb-1">Позиция X (%)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                                value={locationForm.position_x}
                                                onChange={e => setLocationForm({
                                                    ...locationForm,
                                                    position_x: parseInt(e.target.value) || 0
                                                })}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block mb-1">Позиция Y (%)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                                value={locationForm.position_y}
                                                onChange={e => setLocationForm({
                                                    ...locationForm,
                                                    position_y: parseInt(e.target.value) || 0
                                                })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-1">URL иконки</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                            value={locationForm.icon_url}
                                            onChange={e => setLocationForm({ ...locationForm, icon_url: e.target.value })}
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-1">Разблокируется локацией (опционально)</label>
                                        <select
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                            value={locationForm.unlocked_by_location_id || ''}
                                            onChange={e => setLocationForm({
                                                ...locationForm,
                                                unlocked_by_location_id: e.target.value ? parseInt(e.target.value) : null
                                            })}
                                        >
                                            <option value="">Доступна изначально</option>
                                            {locations.map(loc => (
                                                <option key={loc.id} value={loc.id}>
                                                    {loc.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                        <button
                                            type="button"
                                            className="px-4 py-2 border rounded"
                                            onClick={() => {
                                                setShowLocationForm(false);
                                                setLocationForm({
                                                    name: '',
                                                    description: '',
                                                    position_x: 50,
                                                    position_y: 50,
                                                    icon_url: '',
                                                    unlocked_by_location_id: null
                                                });
                                            }}
                                        >
                                            Отмена
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-blue-600 text-white rounded"
                                        >
                                            Создать
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Управление группами заданий */}
            {selectedLocation && (
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-semibold">4. Группы заданий</h2>
                        <button
                            className="px-3 py-1 bg-blue-600 text-white rounded"
                            onClick={() => setShowTaskGroupForm(true)}
                        >
                            Добавить группу
                        </button>
                    </div>

                    {taskGroups.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {taskGroups.map(group => (
                                <div
                                    key={group.id}
                                    className={`p-4 border rounded-lg cursor-pointer ${
                                        selectedTaskGroup === group.id
                                            ? 'bg-blue-100 border-blue-500 dark:bg-blue-900 dark:border-blue-500'
                                            : 'border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                                    }`}
                                    onClick={() => setSelectedTaskGroup(group.id)}
                                >
                                    <div className="font-medium">{group.name}</div>
                                    <div className="text-sm text-gray-500 line-clamp-2">{group.description}</div>
                                    <div className="flex justify-between mt-2 text-xs">
                                        <span className="text-gray-500">Сложность: {group.difficulty}/5</span>
                                        <span className="text-gray-500">{group.reward_points} очков</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-gray-500">Нет групп заданий в этой локации</p>
                            <button
                                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
                                onClick={() => setShowTaskGroupForm(true)}
                            >
                                Создать первую группу заданий
                            </button>
                        </div>
                    )}

                    {/* Форма создания группы заданий */}
                    {showTaskGroupForm && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
                                <h3 className="text-xl font-semibold mb-4">Создание группы заданий</h3>
                                <form onSubmit={handleCreateTaskGroup}>
                                    <div className="mb-4">
                                        <label className="block mb-1">Название группы</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                            value={taskGroupForm.name}
                                            onChange={e => setTaskGroupForm({ ...taskGroupForm, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-1">Описание</label>
                                        <textarea
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                            value={taskGroupForm.description}
                                            onChange={e => setTaskGroupForm({ ...taskGroupForm, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block mb-1">Сложность (1-5)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="5"
                                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                                value={taskGroupForm.difficulty}
                                                onChange={e => setTaskGroupForm({
                                                    ...taskGroupForm,
                                                    difficulty: parseInt(e.target.value) || 1
                                                })}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block mb-1">Очки за выполнение</label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                                value={taskGroupForm.reward_points}
                                                onChange={e => setTaskGroupForm({
                                                    ...taskGroupForm,
                                                    reward_points: parseInt(e.target.value) || 10
                                                })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                        <button
                                            type="button"
                                            className="px-4 py-2 border rounded"
                                            onClick={() => {
                                                setShowTaskGroupForm(false);
                                                setTaskGroupForm({ name: '', description: '', difficulty: 1, reward_points: 10 });
                                            }}
                                        >
                                            Отмена
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-blue-600 text-white rounded"
                                        >
                                            Создать
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Назначение заданий выбранной группе */}
            {selectedTaskGroup && (
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-semibold">5. Задания в группе</h2>
                        <button
                            className="px-3 py-1 bg-blue-600 text-white rounded"
                            onClick={() => setShowAssignTasksForm(true)}
                        >
                            Назначить задания
                        </button>
                    </div>

                    {/* Форма назначения заданий */}
                    {showAssignTasksForm && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full max-h-screen overflow-auto">
                                <h3 className="text-xl font-semibold mb-4">Назначить задания группе</h3>
                                <form onSubmit={handleAssignTasks}>
                                    <div className="mb-4">
                                        <label className="block mb-2">Выберите задания:</label>
                                        <div className="max-h-96 overflow-y-auto border rounded p-2">
                                            {tasks.length > 0 ? tasks.map(task => (
                                                <div
                                                    key={task.id}
                                                    className="p-2 border-b last:border-b-0 flex items-start"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        id={`task-${task.id}`}
                                                        className="mt-1 mr-3"
                                                        checked={selectedTasks.includes(task.id)}
                                                        onChange={() => toggleTaskSelection(task.id)}
                                                    />
                                                    <label htmlFor={`task-${task.id}`} className="cursor-pointer flex-1">
                                                        <div className="font-medium">{task.title}</div>
                                                        <div className="text-sm text-gray-500 line-clamp-2">{task.description}</div>
                                                    </label>
                                                </div>
                                            )) : (
                                                <div className="text-center py-4">
                                                    <p className="text-gray-500">Нет доступных заданий для этого предмета</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                        <button
                                            type="button"
                                            className="px-4 py-2 border rounded"
                                            onClick={() => {
                                                setShowAssignTasksForm(false);
                                                setSelectedTasks([]);
                                            }}
                                        >
                                            Отмена
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-blue-600 text-white rounded"
                                            disabled={selectedTasks.length === 0}
                                        >
                                            Назначить
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GamificationPanel;