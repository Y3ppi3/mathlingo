// src/components/admin/SubjectsPanel.tsx
import { useEffect, useState } from 'react';
import { fetchSubjects, deleteSubject, deleteSubjectBypass, Subject } from '../../api/adminApi';
import SubjectForm from './SubjectForm';

const SubjectsPanel = () => {
    const [subjects, setSubjects]             = useState<Subject[]>([]);
    const [loading, setLoading]               = useState(true);
    const [error, setError]                   = useState('');
    const [showForm, setShowForm]             = useState(false);
    const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

    const loadSubjects = async () => {
        try {
            setLoading(true);
            setSubjects(await fetchSubjects());
            setError('');
        } catch {
            setError('Не удалось загрузить разделы математики');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadSubjects(); }, []);

    const handleAdd  = () => { setEditingSubject(null); setShowForm(true); };
    const handleEdit = (s: Subject) => { setEditingSubject(s); setShowForm(true); };
    const handleFormClose  = () => { setShowForm(false); setEditingSubject(null); };
    const handleFormSubmit = () => { setShowForm(false); setEditingSubject(null); loadSubjects(); };

    const handleDelete = async (id: number) => {
        if (!confirm('Удалить этот раздел?')) return;
        try {
            setError('');
            setLoading(true);
            const result = await deleteSubject(id, false);

            if (result.success) {
                setSubjects(prev => prev.filter(s => s.id !== id));
                return;
            }

            if (result.data?.detail?.includes('связано')) {
                const match = result.data.detail.match(/\d+/);
                const count = match ? match[0] : '?';
                if (!confirm(`Раздел имеет ${count} связанных заданий.\nУдалить раздел и отвязать задания?\n\nЭто действие нельзя отменить.`)) return;
                const bypass = await deleteSubjectBypass(id);
                if (bypass.success) {
                    setSubjects(prev => prev.filter(s => s.id !== id));
                    return;
                }
                setError(bypass.data?.detail || bypass.error || 'Не удалось удалить раздел');
            } else {
                setError(result.data?.detail || result.error || 'Ошибка при удалении раздела');
            }
        } catch {
            setError('Неожиданная ошибка при удалении раздела');
        } finally {
            setLoading(false);
            loadSubjects();
        }
    };

    if (loading && subjects.length === 0) return (
        <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Загрузка разделов...
            </div>
        </div>
    );

    return (
        <div className="p-6 space-y-5">

            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors">
                    Разделы
                    {subjects.length > 0 && (
                        <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">{subjects.length}</span>
                    )}
                </h2>
                <button
                    style={{ padding: '0.5rem 1rem' }}
                    onClick={handleAdd}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Добавить раздел
                </button>
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

            {/* Форма создания / редактирования */}
            {showForm && (
                <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-2xl p-5 transition-colors">
                    <SubjectForm
                        subject={editingSubject}
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
                        {['ID', 'Название', 'Код', 'Порядок', 'Заданий', 'Статус', 'Действия'].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors">
                                {h}
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800 transition-colors">
                    {subjects.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400 dark:text-gray-500 transition-colors">
                                Разделов пока нет.{' '}
                                <button onClick={handleAdd} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                    Создайте первый раздел
                                </button>
                            </td>
                        </tr>
                    ) : (
                        subjects.map(subject => (
                            <tr key={subject.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="px-5 py-3.5 text-sm text-gray-400 dark:text-gray-500 transition-colors">
                                    {subject.id}
                                </td>
                                <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-white transition-colors">
                                    {subject.name}
                                </td>
                                <td className="px-5 py-3.5">
                                        <span className="text-xs font-mono px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg transition-colors">
                                            {subject.code}
                                        </span>
                                </td>
                                <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-400 transition-colors">
                                    {subject.order || 0}
                                </td>
                                <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-400 transition-colors">
                                    {subject.tasks_count || 0}
                                </td>
                                <td className="px-5 py-3.5">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                            subject.is_active
                                                ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${subject.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                                            {subject.is_active ? 'Активен' : 'Неактивен'}
                                        </span>
                                </td>
                                <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleEdit(subject)}
                                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium transition-colors"
                                        >
                                            Изменить
                                        </button>
                                        <button
                                            onClick={() => subject.id && handleDelete(subject.id)}
                                            className="text-xs text-red-500 dark:text-red-400 hover:text-red-400 dark:hover:text-red-300 font-medium transition-colors"
                                        >
                                            Удалить
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SubjectsPanel;