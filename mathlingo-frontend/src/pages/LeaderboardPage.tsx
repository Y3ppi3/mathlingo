// src/pages/LeaderboardPage.tsx
//
// Рейтинг по сумме звёзд (данные — user_game_progress). Вкладки: сводный по
// всем играм + по каждой матричной игре. Всегда показываем позицию текущего
// игрока, даже если он вне топа. Тон спокойный, соревнование — необязательное.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import { getLeaderboard, type Leaderboard, type LeaderboardEntry } from '../api/studentApi';

const TABS: Array<{ label: string; gameId?: string }> = [
    { label: 'Все игры' },
    { label: 'Гаусс-Жордан', gameId: 'gauss_jordan' },
    { label: 'Стрелка Судьбы', gameId: 'eigen_arrow' },
];

const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`);

const Row = ({ e, me }: { e: LeaderboardEntry; me: boolean }) => (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
        me ? 'bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30'
            : 'border border-transparent'
    }`}>
        <div className="w-8 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">{medal(e.rank)}</div>
        <div className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">
            {e.username}{me && <span className="ml-2 text-xs text-indigo-500">это ты</span>}
        </div>
        <div className="text-sm text-amber-500 font-semibold">★ {e.stars}</div>
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
            <Navbar />
            <div className="max-w-2xl mx-auto px-4 py-10 mt-16">
                <button
                    type="button"
                    onClick={() => navigate('/games')}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    ← К играм
                </button>
                <h1 className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">🏆 Лидерборд</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Рейтинг по сумме звёзд за уровни.</p>

                <div className="mt-5 flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800 w-fit">
                    {TABS.map((t, i) => (
                        <button
                            key={t.label}
                            type="button"
                            onClick={() => setTab(i)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                tab === i
                                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
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
                        <div className="p-8 rounded-2xl border border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400">
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
