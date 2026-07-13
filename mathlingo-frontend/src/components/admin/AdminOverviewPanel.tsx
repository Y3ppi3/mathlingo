// src/components/admin/AdminOverviewPanel.tsx
import { useEffect, useState } from 'react';
import { fetchTasks, fetchUsers, Task } from '../../utils/adminApi';

const STATUS_LABELS: Record<string, string> = {
    draft: 'Черновики',
    in_review: 'На проверке',
    needs_revision: 'Возвращены',
    approved: 'Одобрены',
    published: 'Опубликованы',
    archived: 'В архиве',
};

// Лёгкий обзор для R1 — считает то, что уже есть в API. Полноценный
// dashboard (активность, качество AI-контента, очередь проверок и т.д.)
// строится в R3, когда появятся данные из всех предыдущих релизов —
// см. docs/roadmap/product-technical-plan.md, R3 §3.
const AdminOverviewPanel = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [usersCount, setUsersCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const [tasksData, usersData] = await Promise.all([fetchTasks(), fetchUsers()]);
                setTasks(tasksData);
                setUsersCount(usersData.length);
            } catch {
                setError('Не удалось загрузить сводку');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Загрузка сводки...
            </div>
        </div>
    );

    const byStatus = tasks.reduce<Record<string, number>>((acc, t) => {
        const status = t.status ?? 'published';
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
    }, {});

    return (
        <div className="p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Обзор</h2>

            {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl">
                    <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{tasks.length}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Всего заданий</div>
                </div>
                <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{usersCount ?? '—'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Учащихся</div>
                </div>
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                    byStatus[status] ? (
                        <div key={status} className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{byStatus[status]}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
                        </div>
                    ) : null
                ))}
            </div>
        </div>
    );
};

export default AdminOverviewPanel;
