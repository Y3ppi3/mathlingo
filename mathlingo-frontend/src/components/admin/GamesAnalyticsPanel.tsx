// src/components/admin/GamesAnalyticsPanel.tsx
//
// Фаза 5: read-only витрина вовлечённости матричных мини-игр. Данные —
// агрегаты телеметрии с /admin/games/analytics (см.
// app/services/game_analytics.py). Панель ничего не меняет, только показывает
// три оси: доходят ли до конца (воронка), залипают ли (сессии), растёт ли
// мастерство (звёзды). Ось «качество усвоения» (pre/post) будет отдельно.
import { useEffect, useState } from 'react';
import {
    fetchGamesAnalytics, fetchLearningAnalytics,
    type GameEngagementStats, type GamesAnalytics, type LearningAnalytics,
} from '../../api/adminApi';

const GAME_LABEL: Record<string, string> = {
    gauss_jordan: 'Побег Гаусса-Жордана',
    eigen_arrow: 'Стрелка Судьбы',
    '—': 'Без явной игры',
};

const WINDOWS: Array<{ label: string; days?: number }> = [
    { label: 'За всё время' },
    { label: '30 дней', days: 30 },
    { label: '7 дней', days: 7 },
];

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v: number | null, d = 1) => (v == null ? '—' : v.toFixed(d));

const Metric = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
        <div className="text-xs text-gray-400 dark:text-gray-500">{label}</div>
        <div className="text-lg font-semibold text-gray-900 dark:text-white">{value}</div>
        {hint && <div className="text-xs text-gray-400 dark:text-gray-500">{hint}</div>}
    </div>
);

const GameCard = ({ g }: { g: GameEngagementStats }) => {
    const sessionMin = g.avg_session_seconds != null ? Math.round(g.avg_session_seconds / 6) / 10 : null;
    return (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {GAME_LABEL[g.game_id] ?? g.game_id}
                </h3>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    {g.players} игроков · {g.sessions_total} сессий
                </span>
            </div>

            {g.sessions_total === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Пока никто не играл в этом окне.</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Metric label="Доходят до конца" value={pct(g.completion_rate)}
                            hint={`${g.level_completes} из ${g.level_starts} заходов`} />
                        <Metric label="Средние звёзды" value={num(g.avg_stars, 2)}
                            hint={`${pct(g.three_star_share)} на 3★`} />
                        <Metric label="Средняя сессия" value={sessionMin != null ? `${sessionMin} мин` : '—'} />
                        <Metric label="Освоено уровней" value={String(g.levels_mastered)}
                            hint={`${g.players_with_mastery} игроков с 3★`} />
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>✅ завершено сессий: {g.sessions_completed}</span>
                        <span>🚪 брошено: {g.sessions_abandoned}</span>
                        <span>⏳ не закрыто: {g.sessions_open}</span>
                    </div>

                    {g.per_level.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
                                        <th className="py-2 pr-3 font-medium">Уровень</th>
                                        <th className="py-2 px-3 font-medium">Заходов</th>
                                        <th className="py-2 px-3 font-medium">Прошли</th>
                                        <th className="py-2 px-3 font-medium">Доходимость</th>
                                        <th className="py-2 px-3 font-medium">Ср. звёзды</th>
                                        <th className="py-2 pl-3 font-medium">Ср. усилие</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {g.per_level.map((lv) => {
                                        // Узкое место — красным: низкая доходимость при заметном числе заходов.
                                        const weak = lv.completion_rate != null && lv.completion_rate < 0.5 && lv.starts >= 3;
                                        return (
                                            <tr key={lv.level_id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                                                <td className="py-2 pr-3 font-mono text-gray-700 dark:text-gray-300">{lv.level_id}</td>
                                                <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{lv.starts}</td>
                                                <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{lv.completes}</td>
                                                <td className={`py-2 px-3 ${weak ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                                                    {pct(lv.completion_rate)}
                                                </td>
                                                <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{num(lv.avg_stars, 2)}</td>
                                                <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">{num(lv.avg_metric, 1)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// Ось «качество усвоения»: pre/post-замеры и их дельта (Фаза 6). Отдельно от
// вовлечённости и не зависит от окна наблюдения — это накопленный сигнал.
const LearningSection = ({ data }: { data: LearningAnalytics }) => {
    const delta = (v: number | null) => {
        if (v == null) return '—';
        const sign = v > 0 ? '+' : '';
        return `${sign}${v.toFixed(2)}`;
    };
    const deltaClass = (v: number | null) =>
        v == null ? 'text-gray-500 dark:text-gray-400'
            : v > 0 ? 'text-green-600 dark:text-green-400'
                : v < 0 ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-500 dark:text-gray-400';

    return (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Качество усвоения</h3>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    pre: {data.pre_count} · post: {data.post_count} · пар: {data.paired_users} · макс. балл {data.max_score}
                </span>
            </div>

            {data.paired_users === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">
                    Пока нет пользователей, сдавших и вводный, и итоговый замер.
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-3 gap-3">
                        <Metric label="Средний балл до" value={num(data.avg_pre, 2)} />
                        <Metric label="Средний балл после" value={num(data.avg_post, 2)} />
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                            <div className="text-xs text-gray-400 dark:text-gray-500">Δ рост</div>
                            <div className={`text-lg font-semibold ${deltaClass(data.avg_delta)}`}>{delta(data.avg_delta)}</div>
                        </div>
                    </div>

                    {data.by_game.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
                                        <th className="py-2 pr-3 font-medium">Больше играл в</th>
                                        <th className="py-2 px-3 font-medium">Пар</th>
                                        <th className="py-2 px-3 font-medium">Балл до</th>
                                        <th className="py-2 px-3 font-medium">Балл после</th>
                                        <th className="py-2 pl-3 font-medium">Δ рост</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.by_game.map((g) => (
                                        <tr key={g.primary_game} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                                            <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{GAME_LABEL[g.primary_game] ?? g.primary_game}</td>
                                            <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{g.paired_users}</td>
                                            <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{num(g.avg_pre, 2)}</td>
                                            <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{num(g.avg_post, 2)}</td>
                                            <td className={`py-2 pl-3 font-medium ${deltaClass(g.avg_delta)}`}>{delta(g.avg_delta)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const GamesAnalyticsPanel = () => {
    const [data, setData] = useState<GamesAnalytics | null>(null);
    const [learning, setLearning] = useState<LearningAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [windowIdx, setWindowIdx] = useState(0);

    useEffect(() => {
        setLoading(true);
        fetchGamesAnalytics(WINDOWS[windowIdx].days)
            .then(setData)
            .catch(() => setError('Не удалось загрузить аналитику вовлечённости'))
            .finally(() => setLoading(false));
    }, [windowIdx]);

    useEffect(() => {
        // Замеры обучения не зависят от окна — грузим один раз.
        fetchLearningAnalytics().then(setLearning).catch(() => undefined);
    }, []);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Вовлечённость игр</h2>
                <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
                    {WINDOWS.map((w, i) => (
                        <button
                            key={w.label}
                            onClick={() => setWindowIdx(i)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                windowIdx === i
                                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                        >
                            {w.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="text-sm text-gray-400 dark:text-gray-500">Загрузка...</div>
            ) : (
                <div className="space-y-4">
                    {learning && <LearningSection data={learning} />}
                    {data?.games.map((g) => <GameCard key={g.game_id} g={g} />)}
                </div>
            )}
        </div>
    );
};

export default GamesAnalyticsPanel;
