// src/components/admin/GamificationPanel.tsx
// Enhanced version with deletion handlers for gamification elements

import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { deleteAdventureMap } from '../../utils/adminApi';

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
    // State for lists of data
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [maps, setMaps] = useState<AdventureMap[]>([]);
    const [locations, setLocations] = useState<MapLocation[]>([]);
    const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);

    // State for selected elements
    const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
    const [selectedMap, setSelectedMap] = useState<number | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
    const [selectedTaskGroup, setSelectedTaskGroup] = useState<number | null>(null);

    // State for forms
    const [showMapForm, setShowMapForm] = useState(false);
    const [showLocationForm, setShowLocationForm] = useState(false);
    const [showTaskGroupForm, setShowTaskGroupForm] = useState(false);
    const [showAssignTasksForm, setShowAssignTasksForm] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form data
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

    const fetchAssignedTasks = async (groupId: number) => {
        try {
            const token = localStorage.getItem('adminToken');

            if (!token) {
                console.error('No admin token found');
                setAssignedTasks([]);
                return;
            }

            try {
                const response = await api.get(`/admin/gamification/task-groups/${groupId}/tasks`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                setAssignedTasks(response.data || []);
            } catch (routeError) {
                console.log(`Failed to fetch assigned tasks for group ${groupId}:`, routeError);
                setAssignedTasks([]);
            }
        } catch (error) {
            console.error('Unexpected error in fetchAssignedTasks', error);
            setAssignedTasks([]);
        }
    };

// Function to delete an adventure map
    const handleDeleteMap = async (mapId: number) => {
        if (!window.confirm('Вы уверены, что хотите удалить эту карту приключений?')) {
            return;
        }

        try {
            setError(null);

            // First attempt without force flag
            const response = await deleteAdventureMap(mapId);

            // Check if confirmation is required for cascade delete
            if (response && response.status === 'confirmation_required') {
                const { locations_count, task_groups_count } = response.related_data;

                const confirmMessage = `
            ⚠️ ВНИМАНИЕ! Удаление этой карты приключений повлечет за собой:
            
            - ${locations_count} локаций
            - ${task_groups_count} групп заданий
            
            Все эти данные будут удалены. Продолжить?
            `;

                if (window.confirm(confirmMessage)) {
                    // Force deletion with cascade
                    const forceResponse = await deleteAdventureMap(mapId, true);

                    if (forceResponse && forceResponse.status === 'success') {
                        // Update the maps list
                        if (selectedSubject) {
                            fetchMaps(selectedSubject);
                        }
                    } else {
                        setError('Получен неожиданный ответ от сервера при удалении карты.');
                    }
                }
            } else if (response && response.status === 'success') {
                // Normal deletion was successful
                if (selectedSubject) {
                    fetchMaps(selectedSubject);
                }
            } else {
                setError('Получен неожиданный ответ от сервера при удалении карты.');
            }
        } catch (error) {
            console.error('Ошибка при удалении карты:', error);
            setError('Не удалось удалить карту приключений. Проверьте сетевое соединение или повторите позже.');
        }
    };

    // Function to delete a location
    const handleDeleteLocation = async (locationId: number) => {
        try {
            if (!window.confirm('Вы уверены, что хотите удалить эту локацию?')) {
                return;
            }

            setError(null);
            const token = localStorage.getItem('adminToken');

            // Try to delete the location
            const response = await api.delete(`/admin/gamification/locations/${locationId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // Check if confirmation is required for cascade delete
            if (response.data && response.data.status === 'confirmation_required') {
                const { dependent_locations_count, task_groups_count } = response.data.related_data;

                let confirmMessage = '⚠️ ВНИМАНИЕ! Удаление этой локации повлечет за собой:\n\n';

                if (dependent_locations_count > 0) {
                    confirmMessage += `- ${dependent_locations_count} зависимых локаций будут отвязаны\n`;
                }

                if (task_groups_count > 0) {
                    confirmMessage += `- ${task_groups_count} групп заданий будут удалены\n`;
                }

                confirmMessage += '\nВы уверены, что хотите продолжить?';

                if (window.confirm(confirmMessage)) {
                    // Force deletion with cascade
                    await api.delete(`/admin/gamification/locations/${locationId}?force=true`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    // Update the locations list
                    if (selectedMap) {
                        fetchLocations(selectedMap);
                    }
                }
            } else {
                // Normal deletion was successful
                if (selectedMap) {
                    fetchLocations(selectedMap);
                }
            }
        } catch (error) {
            console.error('Ошибка при удалении локации:', error);
            setError('Не удалось удалить локацию. Проверьте сетевое соединение или повторите позже.');
        }
    };

    // Function to delete a task group
    const handleDeleteTaskGroup = async (taskGroupId: number) => {
        try {
            if (!window.confirm('Вы уверены, что хотите удалить эту группу заданий?')) {
                return;
            }

            setError(null);
            const token = localStorage.getItem('adminToken');

            // Try to delete the task group
            const response = await api.delete(`/admin/gamification/task-groups/${taskGroupId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // Check if confirmation is required for cascade delete
            if (response.data && response.data.status === 'confirmation_required') {
                const { tasks_count } = response.data.related_data;

                const confirmMessage = `
                ⚠️ ВНИМАНИЕ! В этой группе есть ${tasks_count} заданий.
                
                Они будут отвязаны от группы, но не удалены из системы.
                Продолжить?
                `;

                if (window.confirm(confirmMessage)) {
                    // Force deletion with cascade
                    await api.delete(`/admin/gamification/task-groups/${taskGroupId}?force=true`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    // Update the task groups list
                    if (selectedLocation) {
                        fetchTaskGroups(selectedLocation);
                    }
                }
            } else {
                // Normal deletion was successful
                if (selectedLocation) {
                    fetchTaskGroups(selectedLocation);
                }
            }
        } catch (error) {
            console.error('Ошибка при удалении группы заданий:', error);
            setError('Не удалось удалить группу заданий. Проверьте сетевое соединение или повторите позже.');
        }
    };

    // Data loading
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
        setAssignedTasks([]);
    }, [selectedLocation]);

    useEffect(() => {
        if (selectedTaskGroup) {
            fetchAssignedTasks(selectedTaskGroup);
        } else {
            setAssignedTasks([]);
        }
    }, [selectedTaskGroup]);

    // Data loading functions
    const fetchSubjects = async () => {
        try {
            const token = localStorage.getItem('adminToken');

            const response = await api.get('/admin/subjects', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setSubjects(response.data);
        } catch (error) {
            console.error('Ошибка при загрузке предметов:', error);
            setError('Не удалось загрузить предметы');
        }
    };

    const fetchMaps = async (subjectId: number) => {
        try {
            const token = localStorage.getItem('adminToken');

            const response = await api.get(`/gamification/maps/${subjectId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setMaps(response.data);
        } catch (error) {
            console.error('Ошибка при загрузке карт:', error);
            setMaps([]);
        }
    };

    const fetchLocations = async (mapId: number) => {
        try {
            const token = localStorage.getItem('adminToken');

            try {
                const response = await api.get(`/admin/gamification/maps/${mapId}/locations`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setLocations(response.data);
            } catch (error) {
                console.log('Пробуем альтернативный путь API для локаций...');
                const altResponse = await api.get(`/admin/maps/${mapId}/locations`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setLocations(altResponse.data);
            }
        } catch (error: unknown) {
            console.error('Ошибка при загрузке локаций:', error);
            setLocations([]);
        }
    };

    const fetchTaskGroups = async (locationId: number) => {
        try {
            const token = localStorage.getItem('adminToken');

            try {
                const response = await api.get(`/admin/gamification/locations/${locationId}/task-groups`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setTaskGroups(response.data);
            } catch (error) {
                console.log('Пробуем альтернативный путь API для групп заданий...');
                const altResponse = await api.get(`/admin/locations/${locationId}/task-groups`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setTaskGroups(altResponse.data);
            }
        } catch (error: unknown) {
            console.error('Ошибка при загрузке групп заданий:', error);
            setTaskGroups([]);
        }
    };

    const fetchTasks = async (subjectId: number) => {
        try {
            const token = localStorage.getItem('adminToken');

            const response = await api.get(`/admin/tasks?subject_id=${subjectId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setTasks(response.data);
        } catch (error) {
            console.error('Ошибка при загрузке заданий:', error);
            setTasks([]);
        }
    };

    // Form submission handlers
    const handleCreateMap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubject) return;

        try {
            const token = localStorage.getItem('adminToken');

            await api.post('/admin/gamification/maps', {
                ...mapForm,
                subject_id: selectedSubject
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            fetchMaps(selectedSubject);
            setShowMapForm(false);
            setMapForm({ name: '', description: '', background_image: '' });
        } catch (error) {
            console.error('Ошибка при создании карты:', error);
            setError('Не удалось создать карту');
        }
    };

    const handleCreateLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMap) return;

        try {
            const token = localStorage.getItem('adminToken');

            await api.post('/admin/gamification/locations', {
                ...locationForm,
                adventure_map_id: selectedMap
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
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
            setError('Не удалось создать локацию');
        }
    };

    const handleCreateTaskGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLocation) return;

        try {
            const token = localStorage.getItem('adminToken');

            await api.post('/admin/gamification/task-groups', {
                ...taskGroupForm,
                location_id: selectedLocation
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            fetchTaskGroups(selectedLocation);
            setShowTaskGroupForm(false);
            setTaskGroupForm({ name: '', description: '', difficulty: 1, reward_points: 10 });
        } catch (error) {
            console.error('Ошибка при создании группы заданий:', error);
            setError('Не удалось создать группу заданий');
        }
    };

    const handleAssignTasks = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTaskGroup || selectedTasks.length === 0) return;

        try {
            const token = localStorage.getItem('adminToken');

            console.log('Отправка заданий:', {
                taskGroupId: selectedTaskGroup,
                selectedTasks: selectedTasks,
                token: token ? token.substring(0, 10) + '...' : 'отсутствует'
            });

            await api.post(
                `/admin/gamification/task-groups/${selectedTaskGroup}/assign-tasks`,
                selectedTasks,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            setShowAssignTasksForm(false);
            setSelectedTasks([]);

            // Refresh the list of assigned tasks
            fetchAssignedTasks(selectedTaskGroup);

            alert('Задания успешно назначены группе');
        } catch (error: unknown) {
            console.error('Ошибка при назначении заданий:', error);
            setError('Не удалось назначить задания');
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
        <div className="p-6 text-white dark:text-gray-900 transition-colors">
            <h1 className="text-2xl font-bold mb-6 text-white dark:text-gray-900 transition-colors">Управление геймификацией</h1>

            {error && (
                <div className="bg-red-900/50 dark:bg-red-100 text-red-200 dark:text-red-700 p-3 mb-4 rounded transition-colors">
                    {error}
                </div>
            )}

            {/* Subject selection */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold mb-3 text-white dark:text-gray-900 transition-colors">1. Выберите предмет</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {subjects.map(subject => (
                        <div
                            key={subject.id}
                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                selectedSubject === subject.id
                                    ? 'bg-blue-900 border-blue-600 dark:bg-blue-100 dark:border-blue-500 text-blue-200 dark:text-blue-900'
                                    : 'border-gray-600 dark:border-gray-300 hover:bg-gray-800 dark:hover:bg-gray-100 text-gray-200 dark:text-gray-800'
                            } transition-colors`}
                            onClick={() => setSelectedSubject(subject.id)}
                        >
                            <div className="font-medium">{subject.name}</div>
                            <div className="text-sm text-gray-400 dark:text-gray-600 transition-colors">{subject.code}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Adventure maps management */}
            {selectedSubject && (
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-semibold text-white dark:text-gray-900 transition-colors">2. Карты приключений</h2>
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
                                    className={`relative p-4 border rounded-lg cursor-pointer ${
                                        selectedMap === map.id
                                            ? 'bg-blue-900 border-blue-600 dark:bg-blue-100 dark:border-blue-500 text-blue-200 dark:text-blue-900'
                                            : 'border-gray-600 dark:border-gray-300 hover:bg-gray-800 dark:hover:bg-gray-100 text-gray-200 dark:text-gray-800'
                                    } transition-colors`}
                                >
                                    <button
                                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-600 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent selecting the map
                                            handleDeleteMap(map.id);
                                        }}
                                    >
                                        ✕
                                    </button>

                                    <div
                                        className="pt-2"
                                        onClick={() => setSelectedMap(map.id)}
                                    >
                                        <div className="font-medium">{map.name}</div>
                                        <div
                                            className="text-sm text-gray-400 dark:text-gray-600 line-clamp-2 transition-colors">{map.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 bg-gray-800 dark:bg-gray-100 rounded-lg transition-colors">
                            <p className="text-gray-400 dark:text-gray-600 transition-colors">Нет доступных карт для этого предмета</p>
                            <button
                                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                onClick={() => setShowMapForm(true)}
                            >
                                Создать первую карту
                            </button>
                        </div>
                    )}

                    {/* Map creation form */}
                    {showMapForm && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-gray-800 dark:bg-gray-100 rounded-lg p-6 max-w-md w-full transition-colors">
                                <h3 className="text-xl font-semibold mb-4 text-white dark:text-gray-900 transition-colors">Создание карты
                                    приключений</h3>
                                <form onSubmit={handleCreateMap}>
                                    <div className="mb-4">
                                        <label className="block mb-1 text-gray-300 dark:text-gray-700 transition-colors">Название карты</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded bg-gray-700 dark:bg-white border-gray-600 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
                                            value={mapForm.name}
                                            onChange={e => setMapForm({...mapForm, name: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-1 text-gray-300 dark:text-gray-700 transition-colors">Описание</label>
                                        <textarea
                                            className="w-full p-2 border rounded bg-gray-700 dark:bg-white border-gray-600 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
                                            value={mapForm.description}
                                            onChange={e => setMapForm({...mapForm, description: e.target.value})}
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-1 text-gray-300 dark:text-gray-700 transition-colors">URL фонового изображения</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded bg-gray-700 dark:bg-white border-gray-600 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
                                            value={mapForm.background_image}
                                            onChange={e => setMapForm({...mapForm, background_image: e.target.value})}
                                        />
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                        <button
                                            type="button"
                                            className="px-4 py-2 border rounded border-gray-600 dark:border-gray-300 text-gray-300 dark:text-gray-700 hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
                                            onClick={() => {
                                                setShowMapForm(false);
                                                setMapForm({name: '', description: '', background_image: ''});
                                            }}
                                        >
                                            Отмена
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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

            {/* Locations management */}
            {selectedMap && (
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-semibold text-white dark:text-gray-900 transition-colors">3. Локации на карте</h2>
                        <button
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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
                                    className={`relative p-4 border rounded-lg cursor-pointer ${
                                        selectedLocation === location.id
                                            ? 'bg-blue-900 border-blue-600 dark:bg-blue-100 dark:border-blue-500 text-blue-200 dark:text-blue-900'
                                            : 'border-gray-600 dark:border-gray-300 hover:bg-gray-800 dark:hover:bg-gray-100 text-gray-200 dark:text-gray-800'
                                    } transition-colors`}
                                >
                                    <button
                                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-600 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent selecting the location
                                            handleDeleteLocation(location.id);
                                        }}
                                    >
                                        ✕
                                    </button>

                                    <div
                                        className="pt-2"
                                        onClick={() => setSelectedLocation(location.id)}
                                    >
                                        <div className="font-medium">{location.name}</div>
                                        <div className="text-sm text-gray-400 dark:text-gray-600 line-clamp-2 transition-colors">{location.description}</div>
                                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-600 transition-colors">
                                            <span>Позиция: {location.position_x}% x {location.position_y}%</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 bg-gray-800 dark:bg-gray-100 rounded-lg transition-colors">
                            <p className="text-gray-400 dark:text-gray-600 transition-colors">Нет локаций на этой карте</p>
                            <button
                                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                onClick={() => setShowLocationForm(true)}
                            >
                                Создать первую локацию
                            </button>
                        </div>
                    )}

                    {/* Location creation form */}
                    {showLocationForm && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-gray-800 dark:bg-gray-100 rounded-lg p-6 max-w-md w-full transition-colors">
                                <h3 className="text-xl font-semibold mb-4 text-white dark:text-gray-900 transition-colors">Создание локации</h3>
                                <form onSubmit={handleCreateLocation}>
                                    <div className="mb-4">
                                        <label className="block mb-1 text-gray-300 dark:text-gray-700 transition-colors">Название локации</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded bg-gray-700 dark:bg-white border-gray-600 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
                                            value={locationForm.name}
                                            onChange={e => setLocationForm({ ...locationForm, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-1 text-gray-300 dark:text-gray-700 transition-colors">Описание</label>
                                        <textarea
                                            className="w-full p-2 border rounded bg-gray-700 dark:bg-white border-gray-600 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
                                            value={locationForm.description}
                                            onChange={e => setLocationForm({ ...locationForm, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block mb-1 text-gray-300 dark:text-gray-700 transition-colors">Позиция X (%)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                className="w-full p-2 border rounded bg-gray-700 dark:bg-white border-gray-600 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
                                                value={locationForm.position_x}
                                                onChange={e => setLocationForm({
                                                    ...locationForm,
                                                    position_x: parseInt(e.target.value) || 0
                                                })}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block mb-1 text-gray-300 dark:text-gray-700 transition-colors">Позиция Y (%)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                className="w-full p-2 border rounded bg-gray-700 dark:bg-white border-gray-600 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
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
                                        <label className="block mb-1 text-gray-300 dark:text-gray-700 transition-colors">URL иконки</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded bg-gray-700 dark:bg-white border-gray-600 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
                                            value={locationForm.icon_url}
                                            onChange={e => setLocationForm({ ...locationForm, icon_url: e.target.value })}
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-1 text-gray-300 dark:text-gray-700 transition-colors">Разблокируется локацией (опционально)</label>
                                        <select
                                            className="w-full p-2 border rounded bg-gray-700 dark:bg-white border-gray-600 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
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
                                            className="px-4 py-2 border rounded border-gray-600 dark:border-gray-300 text-gray-300 dark:text-gray-700 hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
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
                                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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

            {/* Task groups management */}
            {selectedLocation && (
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-semibold text-white dark:text-gray-900 transition-colors">4. Группы заданий</h2>
                        <button
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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
                                    className={`relative p-4 border rounded-lg cursor-pointer ${
                                        selectedTaskGroup === group.id
                                            ? 'bg-blue-900 border-blue-600 dark:bg-blue-100 dark:border-blue-500 text-blue-200 dark:text-blue-900'
                                            : 'border-gray-600 dark:border-gray-300 hover:bg-gray-800 dark:hover:bg-gray-100 text-gray-200 dark:text-gray-800'
                                    } transition-colors`}
                                >
                                    <button
                                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-600 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent selecting the group
                                            handleDeleteTaskGroup(group.id);
                                        }}
                                    >
                                        ✕
                                    </button>

                                    <div
                                        className="pt-2"
                                        onClick={() => setSelectedTaskGroup(group.id)}
                                    >
                                        <div className="font-medium">{group.name}</div>
                                        <div className="text-sm text-gray-400 dark:text-gray-600 line-clamp-2 transition-colors">{group.description}</div>
                                        <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-600 transition-colors">
                                            <span>Сложность: {group.difficulty}/5</span>
                                            <span>{group.reward_points} очков</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 bg-gray-800 dark:bg-gray-100 rounded-lg transition-colors">
                            <p className="text-gray-400 dark:text-gray-600 transition-colors">Нет групп заданий в этой локации</p>
                            <button
                                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                onClick={() => setShowTaskGroupForm(true)}
                            >
                                Создать первую группу заданий
                            </button>
                        </div>
                    )}

                    {/* Task group creation form */}
                    {showTaskGroupForm && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-gray-800 dark:bg-gray-100 rounded-lg p-6 max-w-md w-full transition-colors">
                                <h3 className="text-xl font-semibold mb-4 text-white dark:text-gray-900 transition-colors">Создание группы заданий</h3>
                                <form onSubmit={handleCreateTaskGroup}>
                                    <div className="mb-4">
                                        <label className="block mb-1 text-gray-300 dark:text-gray-700 transition-colors">Название группы</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded bg-gray-700 dark:bg-white border-gray-600 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
                                            value={taskGroupForm.name}
                                            onChange={e => setTaskGroupForm({ ...taskGroupForm, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-1 text-gray-300 dark:text-gray-700 transition-colors">Описание</label>
                                        <textarea
                                            className="w-full p-2 border rounded bg-gray-700 dark:bg-white border-gray-600 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
                                            value={taskGroupForm.description}
                                            onChange={e => setTaskGroupForm({ ...taskGroupForm, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block mb-1 text-gray-300 dark:text-gray-700 transition-colors">Сложность (1-5)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="5"
                                                className="w-full p-2 border rounded bg-gray-700 dark:bg-white border-gray-600 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
                                                value={taskGroupForm.difficulty}
                                                onChange={e => setTaskGroupForm({
                                                    ...taskGroupForm,
                                                    difficulty: parseInt(e.target.value) || 1
                                                })}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block mb-1 text-gray-300 dark:text-gray-700 transition-colors">Очки за выполнение</label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full p-2 border rounded bg-gray-700 dark:bg-white border-gray-600 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
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
                                            className="px-4 py-2 border rounded border-gray-600 dark:border-gray-300 text-gray-300 dark:text-gray-700 hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
                                            onClick={() => {
                                                setShowTaskGroupForm(false);
                                                setTaskGroupForm({ name: '', description: '', difficulty: 1, reward_points: 10 });
                                            }}
                                        >
                                            Отмена
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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

            {/* Task assignment panel */}
            {selectedTaskGroup && (
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-semibold text-white dark:text-gray-900 transition-colors">
                            5. Задания в группе
                        </h2>
                        <button
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            onClick={() => setShowAssignTasksForm(true)}
                        >
                            Назначить задания
                        </button>
                    </div>

                    {assignedTasks.length > 0 ? (
                        <div className="bg-gray-800 dark:bg-gray-100 rounded-lg p-4 transition-colors">
                            <ul className="space-y-2">
                                {assignedTasks.map(task => (
                                    <li
                                        key={task.id}
                                        className="p-3 border border-gray-700 dark:border-gray-300 rounded-lg transition-colors"
                                    >
                                        <div className="font-medium text-white dark:text-gray-900 transition-colors">
                                            {task.title}
                                        </div>
                                        <div className="text-sm text-gray-400 dark:text-gray-600 transition-colors">
                                            {task.description}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="text-center py-8 bg-gray-800 dark:bg-gray-100 rounded-lg transition-colors">
                            <p className="text-gray-400 dark:text-gray-600 transition-colors">
                                Нет назначенных заданий в этой группе
                            </p>
                            <button
                                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                onClick={() => setShowAssignTasksForm(true)}
                            >
                                Назначить задания
                            </button>
                        </div>
                    )}

                    {/* Task assignment form */}
                    {showAssignTasksForm && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-gray-800 dark:bg-gray-100 rounded-lg p-6 max-w-lg w-full max-h-screen overflow-auto transition-colors">
                                <h3 className="text-xl font-semibold mb-4 text-white dark:text-gray-900 transition-colors">
                                    Назначить задания группе
                                </h3>
                                <form onSubmit={handleAssignTasks}>
                                    <div className="mb-4">
                                        <label className="block mb-2 text-white dark:text-gray-900 transition-colors">
                                            Выберите задания:
                                        </label>
                                        <div className="max-h-96 overflow-y-auto border border-gray-600 dark:border-gray-300 rounded p-2 transition-colors">
                                            {tasks.length > 0 ? (
                                                tasks.map(task => (
                                                    <div
                                                        key={task.id}
                                                        className="p-2 border-b last:border-b-0 border-gray-700 dark:border-gray-300 flex items-start transition-colors"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            id={`task-${task.id}`}
                                                            className="mt-1 mr-3"
                                                            checked={selectedTasks.includes(task.id)}
                                                            onChange={() => toggleTaskSelection(task.id)}
                                                        />
                                                        <label
                                                            htmlFor={`task-${task.id}`}
                                                            className="cursor-pointer flex-1 text-white dark:text-gray-900 transition-colors"
                                                        >
                                                            <div className="font-medium">
                                                                {task.title}
                                                            </div>
                                                            <div className="text-sm text-gray-400 dark:text-gray-600 line-clamp-2 transition-colors">
                                                                {task.description}
                                                            </div>
                                                        </label>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-4">
                                                    <p className="text-gray-400 dark:text-gray-600 transition-colors">
                                                        Нет доступных заданий для этого предмета
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                        <button
                                            type="button"
                                            className="px-4 py-2 border rounded border-gray-600 dark:border-gray-300 text-gray-300 dark:text-gray-700 hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
                                            onClick={() => {
                                                setShowAssignTasksForm(false);
                                                setSelectedTasks([]);
                                            }}
                                        >
                                            Отмена
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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