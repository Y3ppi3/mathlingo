// src/components/admin/GamificationPanel.tsx
import { useState, useEffect } from 'react';
import { api } from '../../api/studentApi';
import { deleteAdventureMap } from '../../api/adminApi';

interface Subject     { id: number; name: string; code: string; }
interface AdventureMap { id: number; name: string; description: string; background_image: string; subject_id: number; }
interface MapLocation  { id: number; name: string; description: string; position_x: number; position_y: number; icon_url: string; unlocked_by_location_id: number | null; adventure_map_id: number; }
interface TaskGroup    { id: number; name: string; description: string; location_id: number; difficulty: number; reward_points: number; }
interface Task         { id: number; title: string; description: string; subject: string; subject_id: number; }

// ── Переиспользуемые стили ────────────────────────────────────────────────────
const inputCls = "w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors";
const sectionTitleCls = "text-base font-semibold text-gray-900 dark:text-white transition-colors";

const cardCls = (active: boolean) =>
    `relative p-4 border rounded-xl cursor-pointer transition-all ${
        active
            ? 'bg-indigo-50 dark:bg-indigo-500/20 border-indigo-300 dark:border-indigo-500/50 ring-1 ring-indigo-400 dark:ring-indigo-500/50'
            : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-gray-50 dark:hover:bg-gray-600'
    }`;

const btnPrimary = "px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors";
const btnSecondary = "px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white rounded-xl text-sm font-medium transition-colors";
const emptyBoxCls = "text-center py-10 bg-gray-50 dark:bg-gray-700/50 border border-dashed border-gray-200 dark:border-gray-600 rounded-xl transition-colors";

// ── Модальное окно ────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col transition-colors">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 transition-colors">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white transition-colors">{title}</h3>
                <button
                    style={{ padding: '0.25rem' }}
                    onClick={onClose}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-lg leading-none"
                >✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
        </div>
    </div>
);

// ── Основной компонент ────────────────────────────────────────────────────────
const GamificationPanel = () => {
    const [subjects, setSubjects]         = useState<Subject[]>([]);
    const [maps, setMaps]                 = useState<AdventureMap[]>([]);
    const [locations, setLocations]       = useState<MapLocation[]>([]);
    const [taskGroups, setTaskGroups]     = useState<TaskGroup[]>([]);
    const [tasks, setTasks]               = useState<Task[]>([]);
    const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);

    const [selectedSubject, setSelectedSubject]     = useState<number | null>(null);
    const [selectedMap, setSelectedMap]             = useState<number | null>(null);
    const [selectedLocation, setSelectedLocation]   = useState<number | null>(null);
    const [selectedTaskGroup, setSelectedTaskGroup] = useState<number | null>(null);

    const [showMapForm, setShowMapForm]               = useState(false);
    const [showLocationForm, setShowLocationForm]     = useState(false);
    const [showTaskGroupForm, setShowTaskGroupForm]   = useState(false);
    const [showAssignTasksForm, setShowAssignTasksForm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [mapForm, setMapForm]           = useState({ name: '', description: '', background_image: '' });
    const [locationForm, setLocationForm] = useState({ name: '', description: '', position_x: 50, position_y: 50, icon_url: '', unlocked_by_location_id: null as number | null });
    const [taskGroupForm, setTaskGroupForm] = useState({ name: '', description: '', difficulty: 1, reward_points: 10 });
    const [selectedTasks, setSelectedTasks] = useState<number[]>([]);

    const token = () => localStorage.getItem('adminToken');
    const authHeader = () => ({ 'Authorization': `Bearer ${token()}` });

    const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };
    const showError   = (msg: string) => { setError(msg);   setTimeout(() => setError(null),   5000); };

    // ── Загрузка данных ───────────────────────────────────────────────────────
    const fetchSubjects = async () => {
        try {
            const r = await api.get('/admin/subjects', { headers: authHeader() });
            setSubjects(r.data);
        } catch { showError('Не удалось загрузить предметы'); }
    };

    const fetchMaps = async (subjectId: number) => {
        try {
            const r = await api.get(`/gamification/maps/${subjectId}`, { headers: authHeader() });
            setMaps(r.data);
        } catch { setMaps([]); }
    };

    const fetchLocations = async (mapId: number) => {
        try {
            const r = await api.get(`/admin/gamification/maps/${mapId}/locations`, { headers: authHeader() });
            setLocations(r.data);
        } catch { setLocations([]); }
    };

    const fetchTaskGroups = async (locationId: number) => {
        try {
            const r = await api.get(`/admin/gamification/locations/${locationId}/task-groups`, { headers: authHeader() });
            setTaskGroups(r.data);
        } catch { setTaskGroups([]); }
    };

    const fetchTasks = async (subjectId: number) => {
        try {
            const r = await api.get(`/admin/tasks?subject_id=${subjectId}`, { headers: authHeader() });
            setTasks(r.data);
        } catch { setTasks([]); }
    };

    const fetchAssignedTasks = async (groupId: number) => {
        try {
            const r = await api.get(`/admin/gamification/task-groups/${groupId}/tasks`, { headers: authHeader() });
            setAssignedTasks(r.data || []);
        } catch { setAssignedTasks([]); }
    };

    useEffect(() => { fetchSubjects(); }, []);

    useEffect(() => {
        if (selectedSubject) { fetchMaps(selectedSubject); fetchTasks(selectedSubject); }
        else { setMaps([]); setTasks([]); }
        setSelectedMap(null); setLocations([]);
    }, [selectedSubject]);

    useEffect(() => {
        if (selectedMap) fetchLocations(selectedMap); else setLocations([]);
        setSelectedLocation(null); setTaskGroups([]);
    }, [selectedMap]);

    useEffect(() => {
        if (selectedLocation) fetchTaskGroups(selectedLocation); else setTaskGroups([]);
        setSelectedTaskGroup(null); setAssignedTasks([]);
    }, [selectedLocation]);

    useEffect(() => {
        if (selectedTaskGroup) fetchAssignedTasks(selectedTaskGroup); else setAssignedTasks([]);
    }, [selectedTaskGroup]);

    // ── Удаление ─────────────────────────────────────────────────────────────
    const handleDeleteMap = async (mapId: number) => {
        if (!confirm('Удалить эту карту приключений?')) return;
        try {
            const r = await deleteAdventureMap(mapId);
            if (r?.status === 'confirmation_required') {
                const { locations_count, task_groups_count } = r.related_data;
                if (!confirm(`Будет удалено:\n— ${locations_count} локаций\n— ${task_groups_count} групп заданий\n\nПродолжить?`)) return;
                await deleteAdventureMap(mapId, true);
            }
            if (selectedSubject) fetchMaps(selectedSubject);
            showSuccess('Карта удалена');
        } catch { showError('Не удалось удалить карту'); }
    };

    const handleDeleteLocation = async (locationId: number) => {
        if (!confirm('Удалить эту локацию?')) return;
        try {
            const r = await api.delete(`/admin/gamification/locations/${locationId}`, { headers: authHeader() });
            if (r.data?.status === 'confirmation_required') {
                const { dependent_locations_count, task_groups_count } = r.data.related_data;
                if (!confirm(`Будет затронуто:\n— ${dependent_locations_count} зависимых локаций\n— ${task_groups_count} групп заданий\n\nПродолжить?`)) return;
                await api.delete(`/admin/gamification/locations/${locationId}?force=true`, { headers: authHeader() });
            }
            if (selectedMap) fetchLocations(selectedMap);
            showSuccess('Локация удалена');
        } catch { showError('Не удалось удалить локацию'); }
    };

    const handleDeleteTaskGroup = async (groupId: number) => {
        if (!confirm('Удалить эту группу заданий?')) return;
        try {
            const r = await api.delete(`/admin/gamification/task-groups/${groupId}`, { headers: authHeader() });
            if (r.data?.status === 'confirmation_required') {
                const { tasks_count } = r.data.related_data;
                if (!confirm(`В группе ${tasks_count} заданий — они будут отвязаны. Продолжить?`)) return;
                await api.delete(`/admin/gamification/task-groups/${groupId}?force=true`, { headers: authHeader() });
            }
            if (selectedLocation) fetchTaskGroups(selectedLocation);
            showSuccess('Группа удалена');
        } catch { showError('Не удалось удалить группу заданий'); }
    };

    // ── Создание ─────────────────────────────────────────────────────────────
    const handleCreateMap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubject) return;
        try {
            await api.post('/admin/gamification/maps', { ...mapForm, subject_id: selectedSubject }, { headers: authHeader() });
            fetchMaps(selectedSubject);
            setShowMapForm(false);
            setMapForm({ name: '', description: '', background_image: '' });
            showSuccess('Карта создана');
        } catch { showError('Не удалось создать карту'); }
    };

    const handleCreateLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMap) return;
        try {
            await api.post('/admin/gamification/locations', { ...locationForm, adventure_map_id: selectedMap }, { headers: authHeader() });
            fetchLocations(selectedMap);
            setShowLocationForm(false);
            setLocationForm({ name: '', description: '', position_x: 50, position_y: 50, icon_url: '', unlocked_by_location_id: null });
            showSuccess('Локация создана');
        } catch { showError('Не удалось создать локацию'); }
    };

    const handleCreateTaskGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLocation) return;
        try {
            await api.post('/admin/gamification/task-groups', { ...taskGroupForm, location_id: selectedLocation }, { headers: authHeader() });
            fetchTaskGroups(selectedLocation);
            setShowTaskGroupForm(false);
            setTaskGroupForm({ name: '', description: '', difficulty: 1, reward_points: 10 });
            showSuccess('Группа заданий создана');
        } catch { showError('Не удалось создать группу заданий'); }
    };

    const handleAssignTasks = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTaskGroup || !selectedTasks.length) return;
        try {
            await api.post(`/admin/gamification/task-groups/${selectedTaskGroup}/assign-tasks`, selectedTasks, {
                headers: { ...authHeader(), 'Content-Type': 'application/json' }
            });
            setShowAssignTasksForm(false);
            setSelectedTasks([]);
            fetchAssignedTasks(selectedTaskGroup);
            showSuccess('Задания назначены');
        } catch { showError('Не удалось назначить задания'); }
    };

    const toggleTask = (id: number) =>
        setSelectedTasks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    // ── Кнопка удаления карточки ──────────────────────────────────────────────
    const DeleteBtn = ({ onClick }: { onClick: (e: React.MouseEvent) => void }) => (
        <button
            style={{ padding: '0.25rem' }}
            onClick={onClick}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all text-sm"
        >✕</button>
    );

    return (
        <div className="p-6 space-y-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white transition-colors">Управление геймификацией</h2>

            {/* Уведомления */}
            {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl transition-colors">
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                </div>
            )}
            {success && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl transition-colors">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-green-700 dark:text-green-400">{success}</span>
                </div>
            )}

            {/* ── 1. Предметы ─────────────────────────────────────────────── */}
            <section>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 transition-colors">
                    Шаг 1 — Предмет
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {subjects.map(s => (
                        <div key={s.id} className={cardCls(selectedSubject === s.id)} onClick={() => setSelectedSubject(s.id)}>
                            <div className={`font-medium text-sm transition-colors ${selectedSubject === s.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>
                                {s.name}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 transition-colors">{s.code}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── 2. Карты ─────────────────────────────────────────────────── */}
            {selectedSubject && (
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">Шаг 2 — Карты приключений</p>
                        <button className={btnPrimary} onClick={() => setShowMapForm(true)}>+ Добавить карту</button>
                    </div>
                    {maps.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {maps.map(m => (
                                <div key={m.id} className={cardCls(selectedMap === m.id)}>
                                    <DeleteBtn onClick={e => { e.stopPropagation(); handleDeleteMap(m.id); }} />
                                    <div className="pr-6" onClick={() => setSelectedMap(m.id)}>
                                        <div className={`font-medium text-sm transition-colors ${selectedMap === m.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>{m.name}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 transition-colors">{m.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={emptyBoxCls}>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mb-2 transition-colors">Нет карт для этого предмета</p>
                            <button className={btnPrimary} onClick={() => setShowMapForm(true)}>Создать первую карту</button>
                        </div>
                    )}
                </section>
            )}

            {/* ── 3. Локации ───────────────────────────────────────────────── */}
            {selectedMap && (
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">Шаг 3 — Локации</p>
                        <button className={btnPrimary} onClick={() => setShowLocationForm(true)}>+ Добавить локацию</button>
                    </div>
                    {locations.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {locations.map(loc => (
                                <div key={loc.id} className={cardCls(selectedLocation === loc.id)}>
                                    <DeleteBtn onClick={e => { e.stopPropagation(); handleDeleteLocation(loc.id); }} />
                                    <div className="pr-6" onClick={() => setSelectedLocation(loc.id)}>
                                        <div className={`font-medium text-sm transition-colors ${selectedLocation === loc.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>{loc.name}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 transition-colors">{loc.description}</div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-colors">X: {loc.position_x}% Y: {loc.position_y}%</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={emptyBoxCls}>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mb-2 transition-colors">Нет локаций на этой карте</p>
                            <button className={btnPrimary} onClick={() => setShowLocationForm(true)}>Создать первую локацию</button>
                        </div>
                    )}
                </section>
            )}

            {/* ── 4. Группы заданий ────────────────────────────────────────── */}
            {selectedLocation && (
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">Шаг 4 — Группы заданий</p>
                        <button className={btnPrimary} onClick={() => setShowTaskGroupForm(true)}>+ Добавить группу</button>
                    </div>
                    {taskGroups.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {taskGroups.map(g => (
                                <div key={g.id} className={cardCls(selectedTaskGroup === g.id)}>
                                    <DeleteBtn onClick={e => { e.stopPropagation(); handleDeleteTaskGroup(g.id); }} />
                                    <div className="pr-6" onClick={() => setSelectedTaskGroup(g.id)}>
                                        <div className={`font-medium text-sm transition-colors ${selectedTaskGroup === g.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>{g.name}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 transition-colors">{g.description}</div>
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <span key={i} className={`text-xs ${i < g.difficulty ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}>★</span>
                                                ))}
                                            </div>
                                            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium transition-colors">+{g.reward_points} оч.</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={emptyBoxCls}>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mb-2 transition-colors">Нет групп заданий</p>
                            <button className={btnPrimary} onClick={() => setShowTaskGroupForm(true)}>Создать первую группу</button>
                        </div>
                    )}
                </section>
            )}

            {/* ── 5. Задания в группе ──────────────────────────────────────── */}
            {selectedTaskGroup && (
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">Шаг 5 — Задания в группе</p>
                        <button className={btnPrimary} onClick={() => setShowAssignTasksForm(true)}>+ Назначить задания</button>
                    </div>
                    {assignedTasks.length > 0 ? (
                        <div className="space-y-2">
                            {assignedTasks.map(t => (
                                <div key={t.id} className="px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl transition-colors">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white transition-colors">{t.title}</div>
                                    {t.description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">{t.description}</div>}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={emptyBoxCls}>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mb-2 transition-colors">Нет назначенных заданий</p>
                            <button className={btnPrimary} onClick={() => setShowAssignTasksForm(true)}>Назначить задания</button>
                        </div>
                    )}
                </section>
            )}

            {/* ════════ Модальные окна ════════ */}

            {/* Создание карты */}
            {showMapForm && (
                <Modal title="Новая карта приключений" onClose={() => { setShowMapForm(false); setMapForm({ name: '', description: '', background_image: '' }); }}>
                    <form onSubmit={handleCreateMap} className="space-y-4">
                        <div><label className={labelCls}>Название</label><input type="text" className={inputCls} value={mapForm.name} onChange={e => setMapForm({ ...mapForm, name: e.target.value })} required /></div>
                        <div><label className={labelCls}>Описание</label><textarea className={inputCls} rows={3} value={mapForm.description} onChange={e => setMapForm({ ...mapForm, description: e.target.value })} /></div>
                        <div><label className={labelCls}>URL фонового изображения</label><input type="text" className={inputCls} value={mapForm.background_image} onChange={e => setMapForm({ ...mapForm, background_image: e.target.value })} /></div>
                        <div className="flex justify-end gap-3 pt-1">
                            <button type="button" className={btnSecondary} onClick={() => { setShowMapForm(false); setMapForm({ name: '', description: '', background_image: '' }); }}>Отмена</button>
                            <button type="submit" className={btnPrimary}>Создать</button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Создание локации */}
            {showLocationForm && (
                <Modal title="Новая локация" onClose={() => setShowLocationForm(false)}>
                    <form onSubmit={handleCreateLocation} className="space-y-4">
                        <div><label className={labelCls}>Название</label><input type="text" className={inputCls} value={locationForm.name} onChange={e => setLocationForm({ ...locationForm, name: e.target.value })} required /></div>
                        <div><label className={labelCls}>Описание</label><textarea className={inputCls} rows={3} value={locationForm.description} onChange={e => setLocationForm({ ...locationForm, description: e.target.value })} /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className={labelCls}>Позиция X (%)</label><input type="number" min="0" max="100" className={inputCls} value={locationForm.position_x} onChange={e => setLocationForm({ ...locationForm, position_x: parseInt(e.target.value) || 0 })} required /></div>
                            <div><label className={labelCls}>Позиция Y (%)</label><input type="number" min="0" max="100" className={inputCls} value={locationForm.position_y} onChange={e => setLocationForm({ ...locationForm, position_y: parseInt(e.target.value) || 0 })} required /></div>
                        </div>
                        <div><label className={labelCls}>URL иконки</label><input type="text" className={inputCls} value={locationForm.icon_url} onChange={e => setLocationForm({ ...locationForm, icon_url: e.target.value })} /></div>
                        <div>
                            <label className={labelCls}>Разблокируется локацией <span className="font-normal text-gray-400">необязательно</span></label>
                            <select className={inputCls} value={locationForm.unlocked_by_location_id || ''} onChange={e => setLocationForm({ ...locationForm, unlocked_by_location_id: e.target.value ? parseInt(e.target.value) : null })}>
                                <option value="">Доступна изначально</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-1">
                            <button type="button" className={btnSecondary} onClick={() => setShowLocationForm(false)}>Отмена</button>
                            <button type="submit" className={btnPrimary}>Создать</button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Создание группы заданий */}
            {showTaskGroupForm && (
                <Modal title="Новая группа заданий" onClose={() => setShowTaskGroupForm(false)}>
                    <form onSubmit={handleCreateTaskGroup} className="space-y-4">
                        <div><label className={labelCls}>Название</label><input type="text" className={inputCls} value={taskGroupForm.name} onChange={e => setTaskGroupForm({ ...taskGroupForm, name: e.target.value })} required /></div>
                        <div><label className={labelCls}>Описание</label><textarea className={inputCls} rows={3} value={taskGroupForm.description} onChange={e => setTaskGroupForm({ ...taskGroupForm, description: e.target.value })} /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className={labelCls}>Сложность (1–5)</label><input type="number" min="1" max="5" className={inputCls} value={taskGroupForm.difficulty} onChange={e => setTaskGroupForm({ ...taskGroupForm, difficulty: parseInt(e.target.value) || 1 })} required /></div>
                            <div><label className={labelCls}>Очки за выполнение</label><input type="number" min="1" className={inputCls} value={taskGroupForm.reward_points} onChange={e => setTaskGroupForm({ ...taskGroupForm, reward_points: parseInt(e.target.value) || 10 })} required /></div>
                        </div>
                        <div className="flex justify-end gap-3 pt-1">
                            <button type="button" className={btnSecondary} onClick={() => setShowTaskGroupForm(false)}>Отмена</button>
                            <button type="submit" className={btnPrimary}>Создать</button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Назначение заданий */}
            {showAssignTasksForm && (
                <Modal title="Назначить задания группе" onClose={() => { setShowAssignTasksForm(false); setSelectedTasks([]); }}>
                    <form onSubmit={handleAssignTasks} className="space-y-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors">Выберите задания для добавления в группу:</p>
                        <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden transition-colors">
                            {tasks.length > 0 ? tasks.map((t, i) => (
                                <label key={t.id} className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${i < tasks.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                                    <input type="checkbox" className="mt-0.5 rounded accent-indigo-600" checked={selectedTasks.includes(t.id)} onChange={() => toggleTask(t.id)} />
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-white transition-colors">{t.title}</div>
                                        {t.description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 transition-colors">{t.description}</div>}
                                    </div>
                                </label>
                            )) : (
                                <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500 transition-colors">
                                    Нет доступных заданий для этого предмета
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 pt-1">
                            <button type="button" className={btnSecondary} onClick={() => { setShowAssignTasksForm(false); setSelectedTasks([]); }}>Отмена</button>
                            <button type="submit" className={btnPrimary} disabled={!selectedTasks.length} style={{ opacity: selectedTasks.length ? 1 : 0.5 }}>
                                Назначить {selectedTasks.length > 0 ? `(${selectedTasks.length})` : ''}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default GamificationPanel;