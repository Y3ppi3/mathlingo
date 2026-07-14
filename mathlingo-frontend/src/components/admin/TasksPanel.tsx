// src/components/admin/TasksPanel.tsx
import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { fetchTasks, deleteTask, transitionTask, downloadTasksExport, Task, TaskStatus, TaskTransitionAction } from '../../api/adminApi';
import { adminHasRole, AdminRole } from '../../utils/auth';
import TaskForm from './TaskForm';

const SUBJECT_LABELS: Record<string, string> = {
    derivatives: 'Производные',
    integrals:   'Интегралы',
    probability: 'Теория вероятности',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
    draft: 'Черновик',
    in_review: 'На проверке',
    needs_revision: 'Возвращено',
    approved: 'Одобрено',
    published: 'Опубликовано',
    archived: 'В архиве',
};

const STATUS_COLOR: Record<TaskStatus, string> = {
    draft: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    in_review: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
    needs_revision: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
    approved: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
    published: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
    archived: 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
};

// Зеркалит TASK_TRANSITIONS в mathlingo-backend/app/routes/admin.py — сервер
// всё равно перепроверяет роль и исходный статус, это только UX.
const AVAILABLE_ACTIONS: Record<TaskStatus, { action: TaskTransitionAction; label: string; roles: AdminRole[] }[]> = {
    draft: [{ action: 'submit_review', label: 'На проверку', roles: ['superadmin', 'content_manager'] }],
    in_review: [
        { action: 'approve', label: 'Одобрить', roles: ['superadmin', 'teacher'] },
        { action: 'request_changes', label: 'Вернуть на доработку', roles: ['superadmin', 'teacher'] },
    ],
    needs_revision: [{ action: 'submit_review', label: 'На проверку', roles: ['superadmin', 'content_manager'] }],
    approved: [{ action: 'publish', label: 'Опубликовать', roles: ['superadmin', 'content_manager'] }],
    published: [],
    archived: [],
};

const TasksPanel = () => {
    const [tasks, setTasks]               = useState<Task[]>([]);
    const [loading, setLoading]           = useState(true);
    const [error, setError]               = useState('');
    const [showForm, setShowForm]         = useState(false);
    const [editingTask, setEditingTask]   = useState<Task | null>(null);
    const [busyId, setBusyId]             = useState<number | null>(null);

    const canManageContent = adminHasRole('superadmin', 'content_manager');

    const loadTasks = async () => {
        try {
            setLoading(true);
            setTasks(await fetchTasks());
            setError('');
        } catch {
            setError('Не удалось загрузить задания');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadTasks(); }, []);

    const handleAdd  = () => { setEditingTask(null); setShowForm(true); };
    const handleEdit = (t: Task) => { setEditingTask(t); setShowForm(true); };
    const handleFormClose  = () => { setShowForm(false); setEditingTask(null); };
    const handleFormSubmit = () => { setShowForm(false); setEditingTask(null); loadTasks(); };

    const handleDelete = async (id: number) => {
        if (!confirm('Необратимо удалить это задание? Обычно вместо этого используется архивация.')) return;
        try {
            await deleteTask(id);
            setTasks(prev => prev.filter(t => t.id !== id));
        } catch {
            setError('Не удалось удалить задание');
        }
    };

    const handleTransition = async (id: number, action: TaskTransitionAction) => {
        let comment: string | undefined;
        if (action === 'request_changes') {
            comment = window.prompt('Комментарий для автора (необязательно):') || undefined;
        }
        setBusyId(id);
        setError('');
        try {
            const updated = await transitionTask(id, action, comment);
            setTasks(prev => prev.map(t => t.id === id ? updated : t));
        } catch (err) {
            const detail = (err as AxiosError<{ detail?: string }>).response?.data?.detail;
            setError(detail || 'Не удалось изменить статус задания');
        } finally {
            setBusyId(null);
        }
    };

    const handleArchive = (id: number) => handleTransition(id, 'archive');

    if (loading && tasks.length === 0) return (
        <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Загрузка заданий...
            </div>
        </div>
    );

    return (
        <div className="p-6 space-y-5">

            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors">
                    Задания
                    {tasks.length > 0 && (
                        <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">{tasks.length}</span>
                    )}
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        style={{ padding: '0.5rem 0.875rem' }}
                        onClick={() => downloadTasksExport('csv').catch(() => setError('Не удалось экспортировать задания'))}
                        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
                    >
                        Экспорт CSV
                    </button>
                    {canManageContent && (
                        <button
                            style={{ padding: '0.5rem 1rem' }}
                            onClick={handleAdd}
                            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Добавить задание
                        </button>
                    )}
                </div>
            </div>

            {/* Ошибка */}
            {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl transition-colors">
                    <svg className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                </div>
            )}

            {/* Форма */}
            {showForm && (
                <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-2xl p-5 transition-colors">
                    <TaskForm
                        task={editingTask}
                        onSubmit={handleFormSubmit}
                        onCancel={handleFormClose}
                    />
                </div>
            )}

            {/* Таблица */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 transition-colors">
                    <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 transition-colors">
                        {['ID', 'Название', 'Предмет', 'Уровень', 'Статус', 'Источник', 'Действия'].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors">
                                {h}
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800 transition-colors">
                    {tasks.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400 dark:text-gray-500 transition-colors">
                                Заданий пока нет.{' '}
                                {canManageContent && (
                                    <button onClick={handleAdd} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                        Создайте первое задание
                                    </button>
                                )}
                            </td>
                        </tr>
                    ) : (
                        tasks.map(task => {
                            const status = task.status ?? 'published';
                            const canEditContent = canManageContent && (status === 'draft' || status === 'needs_revision');
                            const availableActions = AVAILABLE_ACTIONS[status].filter(a => adminHasRole(...a.roles));
                            const canArchive = canManageContent && status !== 'archived';
                            return (
                                <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-5 py-3.5 text-sm text-gray-400 dark:text-gray-500 transition-colors">
                                        {task.id}
                                    </td>
                                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-white transition-colors">
                                        {task.title}
                                    </td>
                                    <td className="px-5 py-3.5">
                                            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 transition-colors">
                                                {SUBJECT_LABELS[task.subject] ?? task.subject}
                                            </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-gray-400 transition-colors">
                                        {task.level ?? 'standard'}
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors ${STATUS_COLOR[status]}`}>
                                            {STATUS_LABELS[status]}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        {task.source === 'ai' ? (
                                            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400">
                                                AI
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400 dark:text-gray-500">вручную</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            {canEditContent && (
                                                <button
                                                    onClick={() => handleEdit(task)}
                                                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium transition-colors"
                                                >
                                                    Изменить
                                                </button>
                                            )}
                                            {task.id != null && availableActions.map(a => (
                                                <button
                                                    key={a.action}
                                                    disabled={busyId === task.id}
                                                    onClick={() => task.id && handleTransition(task.id, a.action)}
                                                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium transition-colors disabled:opacity-50"
                                                >
                                                    {a.label}
                                                </button>
                                            ))}
                                            {canArchive && task.id != null && (
                                                <button
                                                    disabled={busyId === task.id}
                                                    onClick={() => task.id && handleArchive(task.id)}
                                                    className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 font-medium transition-colors disabled:opacity-50"
                                                >
                                                    Архивировать
                                                </button>
                                            )}
                                            {adminHasRole('superadmin') && (
                                                <button
                                                    onClick={() => task.id && handleDelete(task.id)}
                                                    className="text-xs text-red-500 dark:text-red-400 hover:text-red-400 dark:hover:text-red-300 font-medium transition-colors"
                                                >
                                                    Удалить
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TasksPanel;