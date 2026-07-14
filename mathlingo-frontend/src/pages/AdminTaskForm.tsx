// src/pages/AdminTaskForm.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createTask, fetchTaskById, updateTask } from '../api/studentApi';

const AdminTaskForm = () => {
    const { taskId } = useParams<{ taskId: string }>();
    const isEditing = taskId !== 'new' && taskId !== undefined;

    const [title, setTitle]       = useState('');
    const [description, setDescription] = useState('');
    const [subject, setSubject]   = useState('');
    const [ownerId, setOwnerId]   = useState('');
    const [loading, setLoading]   = useState(isEditing);
    const [saving, setSaving]     = useState(false);
    const [error, setError]       = useState('');

    const navigate = useNavigate();

    useEffect(() => {
        if (!localStorage.getItem('adminToken')) {
            navigate('/admin/login');
            return;
        }
        if (!isEditing) return;

        const loadTask = async () => {
            try {
                const task = await fetchTaskById(parseInt(taskId!));
                setTitle(task.title);
                setDescription(task.description || '');
                setSubject(task.subject);
                setOwnerId(task.owner_id ? task.owner_id.toString() : '');
            } catch {
                setError('Ошибка при загрузке задания');
            } finally {
                setLoading(false);
            }
        };
        loadTask();
    }, [isEditing, taskId, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            const taskData = {
                title,
                description: description || undefined,
                subject,
                owner_id: ownerId ? parseInt(ownerId) : undefined,
            };
            if (isEditing) {
                await updateTask(parseInt(taskId!), taskData);
            } else {
                await createTask(taskData);
            }
            navigate('/admin/dashboard');
        } catch {
            setError('Ошибка при сохранении задания');
        } finally {
            setSaving(false);
        }
    };

    const inputClass = "w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";
    const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors";

    if (loading) return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors">
            <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Загрузка задания...
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">

            {/* Шапка */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors">
                <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white transition-colors">MathLingo</span>
                        <span className="text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded font-medium transition-colors">Admin</span>
                    </div>
                    <button
                        style={{ padding: '0.375rem 0.875rem' }}
                        onClick={() => navigate('/admin/dashboard')}
                        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        К панели
                    </button>
                </div>
            </header>

            {/* Форма */}
            <div className="max-w-3xl mx-auto px-4 py-8">

                {/* Заголовок */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
                        {isEditing ? 'Редактирование задания' : 'Новое задание'}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 transition-colors">
                        {isEditing ? `Задание #${taskId}` : 'Заполните поля ниже'}
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-6 transition-colors">

                    {/* Ошибка */}
                    {error && (
                        <div className="mb-5 flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl transition-colors">
                            <svg className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* Название */}
                        <div>
                            <label className={labelClass}>Название задания</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                required
                                placeholder="Введите название задания"
                                className={inputClass}
                            />
                        </div>

                        {/* Предмет */}
                        <div>
                            <label className={labelClass}>Предмет</label>
                            <select
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                required
                                className={inputClass}
                            >
                                <option value="">Выберите предмет</option>
                                <option value="derivatives">Производные</option>
                                <option value="integrals">Интегралы</option>
                                <option value="probability">Теория вероятности</option>
                            </select>
                        </div>

                        {/* Описание */}
                        <div>
                            <label className={labelClass}>Описание</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={5}
                                placeholder="Введите описание задания"
                                className={inputClass}
                                style={{ resize: 'vertical' }}
                            />
                        </div>

                        {/* ID пользователя */}
                        <div>
                            <label className={labelClass}>
                                ID пользователя
                                <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">необязательно</span>
                            </label>
                            <input
                                type="number"
                                value={ownerId}
                                onChange={e => setOwnerId(e.target.value)}
                                placeholder="Оставьте пустым для общего задания"
                                className={inputClass}
                            />
                        </div>

                        {/* Кнопки */}
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                style={{ padding: '0.625rem 1.25rem' }}
                                onClick={() => navigate('/admin/dashboard')}
                                className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white rounded-xl text-sm font-medium transition-all"
                            >
                                Отмена
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                style={{ padding: '0.625rem 1.25rem' }}
                                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                            >
                                {saving && (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                )}
                                {isEditing ? 'Сохранить изменения' : 'Создать задание'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AdminTaskForm;