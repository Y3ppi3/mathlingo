// src/components/admin/DiagnosticsPanel.tsx
import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import {
    fetchSubjects, fetchSkills, fetchTasks, fetchDiagnostics, createDiagnostic, updateDiagnostic,
    Subject, Skill, Task, Diagnostic,
} from '../../utils/adminApi';
import { adminHasRole } from '../../utils/auth';

const inputCls = "px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";

// Диагностика = куратор собирает набор УЖЕ опубликованных заданий темы в
// один тест (R2 task 3). Ревью на самих заданиях уже пройдено — поэтому
// тут просто выбор из published, без своего draft/review цикла.
const DiagnosticsPanel = () => {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [subjectId, setSubjectId] = useState<number | null>(null);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [skillId, setSkillId] = useState<number | null>(null);
    const [publishedTasks, setPublishedTasks] = useState<Task[]>([]);
    const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
    const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const canManageContent = adminHasRole('superadmin', 'content_manager');

    useEffect(() => {
        fetchSubjects().then(list => {
            setSubjects(list);
            if (list.length > 0 && list[0].id) setSubjectId(list[0].id);
        }).catch(() => setError('Не удалось загрузить разделы'));
    }, []);

    useEffect(() => {
        if (subjectId == null) return;
        fetchSkills(subjectId).then(list => {
            setSkills(list);
            setSkillId(list.length > 0 ? list[0].id ?? null : null);
        }).catch(() => setError('Не удалось загрузить темы'));
    }, [subjectId]);

    const load = () => {
        if (skillId == null) return;
        Promise.all([
            fetchTasks({ skill_id: skillId, status_filter: 'published' }),
            fetchDiagnostics(skillId),
        ]).then(([tasks, diags]) => {
            setPublishedTasks(tasks);
            setDiagnostics(diags);
            setSelectedTaskIds([]);
        }).catch(() => setError('Не удалось загрузить задания/диагностики'));
    };

    useEffect(load, [skillId]);

    const toggleTask = (id: number) => {
        setSelectedTaskIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    };

    const handleCreate = async () => {
        if (skillId == null || selectedTaskIds.length === 0) return;
        setSubmitting(true);
        setError('');
        try {
            await createDiagnostic(skillId, selectedTaskIds);
            load();
        } catch (err) {
            const detail = (err as AxiosError<{ detail?: string }>).response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Не удалось создать диагностику');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleDiagnosticActive = async (d: Diagnostic) => {
        try {
            await updateDiagnostic(d.id, { is_active: !d.is_active });
            load();
        } catch {
            setError('Не удалось изменить диагностику');
        }
    };

    return (
        <div className="p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Диагностика</h2>
                <div className="flex items-center gap-2">
                    <select className={inputCls} value={subjectId ?? ''} onChange={e => setSubjectId(e.target.value ? parseInt(e.target.value) : null)}>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select className={inputCls} value={skillId ?? ''} onChange={e => setSkillId(e.target.value ? parseInt(e.target.value) : null)}>
                        {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl">
                    <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                </div>
            )}

            {/* Существующие диагностики по теме */}
            <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Существующие диагностики</h3>
                {diagnostics.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">Пока нет ни одной.</p>
                ) : (
                    <div className="space-y-2">
                        {diagnostics.map(d => (
                            <div key={d.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    #{d.id} — {d.task_ids.length} заданий
                                </span>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.is_active ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                        {d.is_active ? 'Активна' : 'Выключена'}
                                    </span>
                                    {canManageContent && (
                                        <button onClick={() => toggleDiagnosticActive(d)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                                            {d.is_active ? 'Выключить' : 'Включить'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Создание новой */}
            {canManageContent && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Собрать новую из опубликованных заданий темы
                    </h3>
                    {publishedTasks.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            В этой теме нет опубликованных заданий.
                        </p>
                    ) : (
                        <div className="space-y-2 mb-3">
                            {publishedTasks.map(t => (
                                <label key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedTaskIds.includes(t.id!)}
                                        onChange={() => toggleTask(t.id!)}
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">{t.title}</span>
                                </label>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={handleCreate}
                        disabled={submitting || selectedTaskIds.length === 0}
                        style={{ padding: '0.5rem 1.25rem' }}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                        {submitting ? 'Создание...' : `Создать (${selectedTaskIds.length})`}
                    </button>
                </div>
            )}
        </div>
    );
};

export default DiagnosticsPanel;
