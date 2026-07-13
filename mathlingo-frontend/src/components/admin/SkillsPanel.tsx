// src/components/admin/SkillsPanel.tsx
import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { fetchSkills, createSkill, updateSkill, fetchSubjects, Skill, Subject } from '../../utils/adminApi';
import { adminHasRole } from '../../utils/auth';

const inputCls = "w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors";

// "Тема внутри раздела" — единица, по которой в R2 будет считаться уровень
// освоения (см. docs/roadmap/product-technical-plan.md, R1 §1.2/§2). Архивация
// вместо удаления — тот же паттерн, что и у Subject (is_active toggle).
const SkillsPanel = () => {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [order, setOrder] = useState('0');
    const [submitting, setSubmitting] = useState(false);

    const canManageContent = adminHasRole('superadmin', 'content_manager');

    useEffect(() => {
        fetchSubjects()
            .then(list => {
                setSubjects(list);
                if (list.length > 0 && list[0].id) setSelectedSubjectId(list[0].id);
            })
            .catch(() => setError('Не удалось загрузить разделы'));
    }, []);

    const loadSkills = async (subjectId: number) => {
        try {
            setLoading(true);
            setSkills(await fetchSkills(subjectId));
            setError('');
        } catch {
            setError('Не удалось загрузить темы');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedSubjectId != null) loadSkills(selectedSubjectId);
    }, [selectedSubjectId]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedSubjectId == null) return;
        setSubmitting(true);
        setError('');
        try {
            await createSkill({ subject_id: selectedSubjectId, name, code, order: parseInt(order) || 0 });
            setShowForm(false);
            setName(''); setCode(''); setOrder('0');
            loadSkills(selectedSubjectId);
        } catch (err) {
            const detail = (err as AxiosError<{ detail?: string }>).response?.data?.detail;
            setError(detail || 'Не удалось создать тему');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleActive = async (skill: Skill) => {
        if (!skill.id) return;
        try {
            await updateSkill(skill.id, { is_active: !skill.is_active });
            if (selectedSubjectId != null) loadSkills(selectedSubjectId);
        } catch {
            setError('Не удалось изменить тему');
        }
    };

    return (
        <div className="p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Темы
                    {skills.length > 0 && <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">{skills.length}</span>}
                </h2>
                <div className="flex items-center gap-2">
                    <select
                        className={inputCls}
                        value={selectedSubjectId ?? ''}
                        onChange={e => setSelectedSubjectId(e.target.value ? parseInt(e.target.value) : null)}
                    >
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {canManageContent && (
                        <button
                            style={{ padding: '0.5rem 1rem' }}
                            onClick={() => setShowForm(v => !v)}
                            disabled={selectedSubjectId == null}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                        >
                            {showForm ? 'Отмена' : 'Добавить тему'}
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl">
                    <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                </div>
            )}

            {showForm && (
                <form onSubmit={handleCreate} className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-2xl p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className={labelCls}>Название</label>
                            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                        <div>
                            <label className={labelCls}>Код</label>
                            <input className={inputCls} value={code} onChange={e => setCode(e.target.value)} required />
                        </div>
                        <div>
                            <label className={labelCls}>Порядок</label>
                            <input type="number" className={inputCls} value={order} onChange={e => setOrder(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={submitting}
                            style={{ padding: '0.5rem 1.25rem' }}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors"
                        >
                            {submitting ? 'Создание...' : 'Создать'}
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        Загрузка...
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50">
                            {['ID', 'Название', 'Код', 'Порядок', 'Статус', 'Действия'].map(h => (
                                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                            ))}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                        {skills.length === 0 ? (
                            <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400 dark:text-gray-500">Тем пока нет.</td></tr>
                        ) : skills.map(skill => (
                            <tr key={skill.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                <td className="px-5 py-3.5 text-sm text-gray-400 dark:text-gray-500">{skill.id}</td>
                                <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-white">{skill.name}</td>
                                <td className="px-5 py-3.5 text-sm font-mono text-gray-500 dark:text-gray-400">{skill.code}</td>
                                <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">{skill.order ?? 0}</td>
                                <td className="px-5 py-3.5">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        skill.is_active
                                            ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                    }`}>
                                        {skill.is_active ? 'Активна' : 'В архиве'}
                                    </span>
                                </td>
                                <td className="px-5 py-3.5">
                                    {canManageContent ? (
                                        <button
                                            onClick={() => handleToggleActive(skill)}
                                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium transition-colors"
                                        >
                                            {skill.is_active ? 'Архивировать' : 'Восстановить'}
                                        </button>
                                    ) : (
                                        <span className="text-xs text-gray-400 dark:text-gray-500">Только просмотр</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SkillsPanel;
