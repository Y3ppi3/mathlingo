// src/components/admin/AuditLogPanel.tsx
import { useEffect, useState } from 'react';
import { fetchAuditLog, AuditLogEntry } from '../../api/adminApi';

const inputCls = "px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";

const STATUS_COLOR = (code: number) =>
    code < 300 ? 'text-green-600 dark:text-green-400'
    : code < 500 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

// Superadmin видит всё, content_manager — только свои действия (backend это
// проверяет сам, entityTypeFilter тут просто UX-фильтр поверх).
const AuditLogPanel = () => {
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [entityType, setEntityType] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        try {
            setLoading(true);
            setEntries(await fetchAuditLog({ entity_type: entityType || undefined, limit: 200 }));
            setError('');
        } catch {
            setError('Не удалось загрузить журнал аудита');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [entityType]);

    return (
        <div className="p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Аудит
                    {entries.length > 0 && <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">{entries.length}</span>}
                </h2>
                <input
                    className={inputCls}
                    placeholder="Фильтр по типу сущности (tasks, skills, users...)"
                    value={entityType}
                    onChange={e => setEntityType(e.target.value)}
                />
            </div>

            {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl">
                    <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        Загрузка...
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50">
                            {['Время', 'Актёр', 'Роль', 'Метод', 'Путь', 'Статус'].map(h => (
                                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                        {entries.length === 0 ? (
                            <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400 dark:text-gray-500">Записей пока нет.</td></tr>
                        ) : entries.map(e => (
                            <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    {new Date(e.created_at).toLocaleString('ru-RU')}
                                </td>
                                <td className="px-5 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                    {e.actor_admin_id ?? <span className="text-gray-400 dark:text-gray-500">аноним</span>}
                                </td>
                                <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{e.actor_role ?? '—'}</td>
                                <td className="px-5 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">{e.method}</td>
                                <td className="px-5 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">{e.path}</td>
                                <td className={`px-5 py-3 text-sm font-medium whitespace-nowrap ${STATUS_COLOR(e.status_code)}`}>{e.status_code}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AuditLogPanel;
