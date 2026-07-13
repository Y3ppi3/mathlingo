// src/components/admin/TaskForm.tsx
import { useState, useEffect } from 'react';
import { createTask, updateTask, fetchSkills, Task, TaskLevel, User, fetchUsers, Skill, fetchSubjects, Subject } from '../../utils/adminApi';

interface TaskFormProps {
    task: Task | null;
    onSubmit: () => void;
    onCancel: () => void;
}

const inputCls = "w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors";

const LEVEL_LABELS: Record<TaskLevel, string> = {
    basic: 'Базовый',
    standard: 'Стандартный',
    advanced: 'Продвинутый',
};

const TaskForm = ({ task, onSubmit, onCancel }: TaskFormProps) => {
    const [title, setTitle]           = useState('');
    const [description, setDescription] = useState('');
    const [subject, setSubject]       = useState('');
    const [level, setLevel]           = useState<TaskLevel>('standard');
    const [skillId, setSkillId]       = useState<string>('');
    const [ownerId, setOwnerId]       = useState<string | null>(null);
    const [users, setUsers]           = useState<User[]>([]);
    const [subjects, setSubjects]     = useState<Subject[]>([]);
    const [skills, setSkills]         = useState<Skill[]>([]);
    const [error, setError]           = useState('');
    const [loading, setLoading]       = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [usersData, subjectsData] = await Promise.all([fetchUsers(), fetchSubjects()]);
                setUsers(usersData);
                setSubjects(subjectsData);
                if (usersData.length > 0 && !ownerId) setOwnerId(usersData[0].id.toString());
            } catch {
                setError('Не удалось загрузить необходимые данные');
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setDescription(task.description || '');
            setSubject(task.subject);
            setLevel(task.level ?? 'standard');
            setSkillId(task.skill_id ? task.skill_id.toString() : '');
            setOwnerId(task.owner_id ? task.owner_id.toString() : '');
        }
    }, [task]);

    // Темы зависят от выбранного раздела — перезагружаем список при смене
    // subject и сбрасываем выбор, если он больше не принадлежит разделу.
    useEffect(() => {
        const subjectEntry = subjects.find(s => s.code === subject);
        if (!subjectEntry?.id) {
            setSkills([]);
            return;
        }
        fetchSkills(subjectEntry.id)
            .then(list => {
                setSkills(list);
                if (skillId && !list.some(s => s.id?.toString() === skillId)) setSkillId('');
            })
            .catch(() => setSkills([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subject, subjects]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = {
                title,
                description: description || undefined,
                subject,
                level,
                skill_id: skillId ? parseInt(skillId) : undefined,
                owner_id: ownerId ? parseInt(ownerId) : undefined,
            };
            if (task?.id) await updateTask(task.id, data);
            else           await createTask(data);
            onSubmit();
        } catch {
            setError('Не удалось сохранить задание');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-5 transition-colors">
                {task ? 'Редактирование задания' : 'Создание нового задания'}
            </h3>

            {/* Ошибка */}
            {error && (
                <div className="mb-5 flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl transition-colors">
                    <svg className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

                {/* Название */}
                <div>
                    <label className={labelCls}>Название задания</label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        required
                        placeholder="Введите название задания"
                        className={inputCls}
                    />
                </div>

                {/* Предмет */}
                <div>
                    <label className={labelCls}>Предмет</label>
                    <select
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        required
                        className={inputCls}
                    >
                        <option value="">Выберите предмет</option>
                        {subjects.map(s => (
                            <option key={s.id} value={s.code}>{s.name}</option>
                        ))}
                    </select>
                </div>

                {/* Уровень и тема */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Уровень</label>
                        <select value={level} onChange={e => setLevel(e.target.value as TaskLevel)} className={inputCls}>
                            {(['basic', 'standard', 'advanced'] as TaskLevel[]).map(l => (
                                <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>
                            Тема
                            <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">необязательно</span>
                        </label>
                        <select
                            value={skillId}
                            onChange={e => setSkillId(e.target.value)}
                            disabled={!subject || skills.length === 0}
                            className={inputCls}
                        >
                            <option value="">Без темы</option>
                            {skills.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Описание */}
                <div>
                    <label className={labelCls}>Описание</label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={5}
                        placeholder="Введите описание задания"
                        className={inputCls}
                        style={{ resize: 'vertical' }}
                    />
                </div>

                {/* Владелец */}
                <div>
                    <label className={labelCls}>
                        Владелец задания
                        <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">необязательно</span>
                    </label>
                    <select
                        value={ownerId || ''}
                        onChange={e => setOwnerId(e.target.value || null)}
                        className={inputCls}
                    >
                        <option value="">Без владельца</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
                        ))}
                    </select>
                </div>

                {/* Кнопки */}
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        disabled={loading}
                        style={{ padding: '0.625rem 1.25rem' }}
                        onClick={onCancel}
                        className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{ padding: '0.625rem 1.25rem' }}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                    >
                        {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {loading ? 'Сохранение...' : task ? 'Сохранить изменения' : 'Создать задание'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default TaskForm;