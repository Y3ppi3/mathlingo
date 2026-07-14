// src/components/admin/QualityPanel.tsx
import { useEffect, useState } from 'react';
import {
    fetchAiTaskQuality, fileContentComplaint, updateContentFlag, returnTaskToReview,
    TaskQuality,
} from '../../api/adminApi';
import { adminHasRole } from '../../utils/auth';

const STATUS_LABEL: Record<string, string> = {
    draft: 'Черновик', in_review: 'На проверке', needs_revision: 'На доработке',
    approved: 'Одобрено', published: 'Опубликовано', archived: 'В архиве',
};

// R2 task 7: пост-публикационный мониторинг AI-заданий. Аномалии (низкая
// точность на достаточной выборке) система находит и возвращает задание в
// in_review сама — здесь это видно постфактум как открытый флаг anomaly.
// Жалобы (complaint) сами статус не меняют — решение принимает reviewer
// через "Вернуть на проверку" ниже.
const QualityPanel = () => {
    const [rows, setRows] = useState<TaskQuality[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [complaintTaskId, setComplaintTaskId] = useState<number | null>(null);
    const [complaintText, setComplaintText] = useState('');
    const canResolve = adminHasRole('superadmin', 'content_manager', 'teacher');
    const canReturnToReview = adminHasRole('superadmin', 'content_manager');

    const load = () => {
        setLoading(true);
        fetchAiTaskQuality()
            .then(setRows)
            .catch(() => setError('Не удалось загрузить аналитику качества'))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const handleFileComplaint = async (e: React.FormEvent) => {
        e.preventDefault();
        if (complaintTaskId == null || !complaintText.trim()) return;
        try {
            await fileContentComplaint(complaintTaskId, complaintText.trim());
            setComplaintTaskId(null);
            setComplaintText('');
            load();
        } catch {
            setError('Не удалось отправить жалобу');
        }
    };

    const handleResolveFlag = async (flagId: number, status: 'resolved' | 'dismissed') => {
        try {
            await updateContentFlag(flagId, status);
            load();
        } catch {
            setError('Не удалось обновить флаг');
        }
    };

    const handleReturnToReview = async (taskId: number) => {
        try {
            await returnTaskToReview(taskId);
            load();
        } catch {
            setError('Не удалось вернуть задание на проверку');
        }
    };

    if (loading) {
        return <div className="p-6 text-sm text-gray-400 dark:text-gray-500">Загрузка...</div>;
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Аналитика качества</h2>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    Только AI-сгенерированные задания
                </span>
            </div>

            {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl">
                    <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                </div>
            )}

            {rows.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Пока нет опубликованных AI-заданий.</p>
            ) : (
                <div className="space-y-3">
                    {rows.map(row => (
                        <div key={row.task_id} className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{row.title}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                        {STATUS_LABEL[row.status] ?? row.status}
                                    </span>
                                    {row.open_flags > 0 && (
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
                                            {row.open_flags} открытых сигналов
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { setComplaintTaskId(row.task_id); setComplaintText(''); }}
                                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                                    >
                                        Пожаловаться
                                    </button>
                                    {canReturnToReview && row.status === 'published' && (
                                        <button
                                            onClick={() => handleReturnToReview(row.task_id)}
                                            className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                                        >
                                            Вернуть на проверку
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-500 dark:text-gray-400">
                                <div>Точность: {row.accuracy != null ? `${(row.accuracy * 100).toFixed(0)}%` : '—'}</div>
                                <div>Выборка: {row.sample_size}</div>
                                <div>Среднее время: {row.avg_time_spent_ms != null ? `${Math.round(row.avg_time_spent_ms / 1000)}с` : '—'}</div>
                                <div>Подсказки: {row.avg_hints_used != null ? row.avg_hints_used.toFixed(1) : '—'}</div>
                            </div>

                            {complaintTaskId === row.task_id && (
                                <form onSubmit={handleFileComplaint} className="flex items-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                    <input
                                        autoFocus
                                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl text-sm"
                                        placeholder="В чём проблема?"
                                        value={complaintText}
                                        onChange={e => setComplaintText(e.target.value)}
                                        required
                                    />
                                    <button type="submit" className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium">
                                        Отправить
                                    </button>
                                </form>
                            )}

                            {row.flags.length > 0 && (
                                <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-gray-600">
                                    {row.flags.map(flag => (
                                        <div key={flag.id} className="flex items-center justify-between text-xs">
                                            <span className="text-gray-600 dark:text-gray-300">
                                                <span className="font-medium">{flag.flag_type === 'anomaly' ? 'Аномалия' : 'Жалоба'}</span>
                                                {flag.flag_type === 'complaint' && flag.details?.comment ? `: ${flag.details.comment}` : ''}
                                                {flag.flag_type === 'anomaly' && flag.details?.accuracy != null
                                                    ? `: точность ${Math.round((flag.details.accuracy as number) * 100)}%`
                                                    : ''}
                                            </span>
                                            {flag.status === 'open' ? (
                                                canResolve ? (
                                                    <span className="flex items-center gap-2">
                                                        <button onClick={() => handleResolveFlag(flag.id, 'resolved')} className="text-green-600 dark:text-green-400 hover:underline">
                                                            Решено
                                                        </button>
                                                        <button onClick={() => handleResolveFlag(flag.id, 'dismissed')} className="text-gray-400 dark:text-gray-500 hover:underline">
                                                            Отклонить
                                                        </button>
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 dark:text-gray-500">открыт</span>
                                                )
                                            ) : (
                                                <span className="text-gray-400 dark:text-gray-500">
                                                    {flag.status === 'resolved' ? 'решено' : 'отклонено'}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default QualityPanel;
