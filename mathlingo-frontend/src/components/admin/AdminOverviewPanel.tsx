// src/components/admin/AdminOverviewPanel.tsx
import { useEffect, useState } from 'react';
import { fetchDashboardOverview, DashboardOverview } from '../../api/adminApi';

const TEMPLATE_LABEL: Record<string, string> = {
    derivfall: 'DerivFall',
    integralbuilder: 'IntegralBuilder',
    mathlab: 'MathLab',
};

const LEVEL_LABEL: Record<string, string> = {
    basic: 'Базовый', standard: 'Стандартный', advanced: 'Продвинутый',
};

const StatCard = ({ value, label }: { value: string | number; label: string }) => (
    <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
    </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
        {children}
    </section>
);

// R3 task 7: финальный dashboard поверх данных, накопленных в R1 (audit_log)
// и R2/R3 (attempts, mastery_state, ai_generation_items) — заменяет
// облегчённую R1-сводку (см. docs/roadmap/product-technical-plan.md, R3 §3).
const AdminOverviewPanel = () => {
    const [data, setData] = useState<DashboardOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDashboardOverview()
            .then(setData)
            .catch(() => setError('Не удалось загрузить сводку'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Загрузка сводки...
            </div>
        </div>
    );

    if (error || !data) return (
        <div className="p-6">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl">
                <span className="text-sm text-red-600 dark:text-red-400">{error || 'Нет данных'}</span>
            </div>
        </div>
    );

    return (
        <div className="p-6 space-y-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Обзор</h2>

            <Section title={`Активность за последние ${data.activity.window_days} дней`}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <StatCard value={data.activity.total_attempts} label="Всего попыток" />
                    <StatCard value={data.activity.active_users} label="Активных учеников" />
                    {Object.entries(data.activity.by_content_type).map(([contentType, stats]) => (
                        <StatCard key={contentType} value={stats.attempts} label={`Попыток: ${contentType}`} />
                    ))}
                </div>
            </Section>

            <Section title="Прогресс по темам">
                {data.skill_progress.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">Пока нет данных mastery_state</p>
                ) : (
                    <div className="space-y-2">
                        {data.skill_progress.map(sp => (
                            <div key={sp.skill_id} className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{sp.skill_name}</span>
                                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                    {Object.entries(sp.levels).map(([level, count]) => (
                                        <span key={level}>{LEVEL_LABEL[level] ?? level}: {count}</span>
                                    ))}
                                    <span>ученики: {sp.student_count}</span>
                                    <span>увер.: {sp.avg_confidence}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            <Section title="Завершаемость игр">
                {data.game_completion.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">Пока нет сыгранных сессий</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {data.game_completion.map(gc => (
                            <div key={gc.template_key} className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                                <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">{TEMPLATE_LABEL[gc.template_key] ?? gc.template_key}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Сессий: {gc.sessions}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Успешность: {gc.pass_rate != null ? `${Math.round(gc.pass_rate * 100)}%` : '—'}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Среднее время: {gc.avg_time_spent_ms != null ? `${Math.round(gc.avg_time_spent_ms / 1000)}с` : '—'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            <Section title="Качество AI-контента и очередь проверок">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <StatCard value={data.ai_quality.published_ai_tasks} label="Опубликовано AI-заданий" />
                    <StatCard value={data.ai_quality.open_anomaly_flags} label="Открытых аномалий" />
                    <StatCard value={data.ai_quality.open_complaint_flags} label="Открытых жалоб" />
                    <StatCard value={data.review_queue.tasks_in_review} label="Заданий на проверке" />
                    <StatCard value={data.review_queue.ai_items_pending} label="AI-заданий в очереди" />
                </div>
            </Section>

            <Section title="Ошибки публикаций (AI-конвейер)">
                {Object.keys(data.publish_errors).length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">Ошибок нет</p>
                ) : (
                    <div className="flex flex-wrap gap-3">
                        {Object.entries(data.publish_errors).map(([status, count]) => (
                            <span key={status} className="text-xs px-3 py-1.5 rounded-full font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
                                {status}: {count}
                            </span>
                        ))}
                    </div>
                )}
            </Section>

            {data.admin_actions && (
                <Section title="Последние действия администраторов">
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        {data.admin_actions.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-gray-500 p-4">Пока нет записей аудита</p>
                        ) : data.admin_actions.map((a, i) => (
                            <div key={a.id} className={`flex items-center justify-between gap-2 px-4 py-2.5 text-xs ${i > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}`}>
                                <span className="text-gray-700 dark:text-gray-300">
                                    <span className="font-medium">{a.actor_username ?? 'система'}</span>
                                    {' '}{a.method} {a.path}
                                </span>
                                <span className="text-gray-400 dark:text-gray-500">{new Date(a.created_at).toLocaleString('ru-RU')}</span>
                            </div>
                        ))}
                    </div>
                </Section>
            )}
        </div>
    );
};

export default AdminOverviewPanel;
