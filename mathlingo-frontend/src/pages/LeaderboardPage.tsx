// src/pages/LeaderboardPage.tsx
//
// Рейтинг по сумме звёзд (данные — user_game_progress). Вкладки: сводный по
// всем играм + по каждой матричной игре. Всегда показываем позицию текущего
// игрока, даже если он вне топа. Тон спокойный, соревнование — необязательное.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLeaderboard, type Leaderboard, type LeaderboardEntry } from '../api/studentApi';

const TABS: Array<{ label: string; gameId?: string }> = [
    { label: 'Все игры' },
    { label: 'Гаусс-Жордан', gameId: 'gauss_jordan' },
    { label: 'Стрелка Судьбы', gameId: 'eigen_arrow' },
];

const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`);

// Мягкая подсветка призовых мест — тёплая, не крикливая.
const rankTint: Record<number, string> = {
    1: 'bg-gradient-to-br from-bee/25 to-fox/15 dark:from-bee/15 dark:to-fox/10',
    2: 'bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700/40 dark:to-gray-800/40',
    3: 'bg-gradient-to-br from-fox/20 to-fox/5 dark:from-fox/10 dark:to-fox/5',
};

const Row = ({ e, me }: { e: LeaderboardEntry; me: boolean }) => (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-colors ${
        me ? 'border-brand/40 bg-brand/5 dark:bg-brand/10'
            : `border-transparent ${rankTint[e.rank] ?? ''}`
    }`}>
        <div className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-sm font-extrabold ${
            e.rank <= 3 ? 'bg-white/70 dark:bg-gray-900/40' : 'text-gray-400 dark:text-gray-500'
        }`}>{medal(e.rank)}</div>
        <div className="flex-1 text-sm font-bold text-gray-900 dark:text-white truncate">
            {e.username}{me && <span className="ml-2 text-xs font-bold text-brand dark:text-brand-light">это ты</span>}
        </div>
        <div className="text-sm text-bee-shade dark:text-bee font-extrabold">★ {e.stars}</div>
        <div className="w-24 text-right text-xs text-gray-400 dark:text-gray-500">{e.levels_completed} ур.</div>
    </div>
);

const LeaderboardPage = () => {
    const navigate = useNavigate();
    const [tab, setTab] = useState(0);
    const [data, setData] = useState<Leaderboard | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getLeaderboard(TABS[tab].gameId, 50)
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [tab]);

    const meInTop = data?.me && data.entries.some((e) => e.user_id === data.me!.user_id);

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <div className="max-w-2xl mx-auto px-4 py-10 mt-16">
                <button
                    type="button"
                    onClick={() => navigate('/games')}
                    className="text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-brand dark:hover:text-brand-light transition-colors"
                >
                    ← К играм
                </button>
                <h1 className="mt-3 text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                    <span aria-hidden="true">🏆</span> Лидерборд
                </h1>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Рейтинг по сумме звёзд за уровни. Соревноваться — по желанию.</p>

                <div className="mt-5 flex gap-1.5 p-1.5 rounded-2xl bg-gray-100 dark:bg-gray-800 w-fit max-w-full overflow-x-auto">
                    {TABS.map((t, i) => (
                        <button
                            key={t.label}
                            type="button"
                            onClick={() => setTab(i)}
                            className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                tab === i
                                    ? 'bg-white dark:bg-gray-700 text-brand dark:text-white shadow-card'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="mt-5">
                    {loading ? (
                        <div className="text-sm text-gray-400 dark:text-gray-500">Загрузка...</div>
                    ) : !data || data.entries.length === 0 ? (
                        <div className="card-soft p-8 text-center text-gray-500 dark:text-gray-400">
                            Пока никто не набрал звёзд. Сыграй первым — и займёшь вершину!
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {data.entries.map((e) => (
                                <Row key={e.user_id} e={e} me={data.me?.user_id === e.user_id} />
                            ))}
                            {data.me && !meInTop && (
                                <>
                                    <div className="text-center text-gray-300 dark:text-gray-600 text-xs py-1">···</div>
                                    <Row e={data.me} me />
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeaderboardPage;
