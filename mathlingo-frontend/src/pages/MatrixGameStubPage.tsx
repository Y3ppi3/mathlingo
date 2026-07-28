// src/pages/MatrixGameStubPage.tsx
//
// Заглушка конкретной матричной игры (Фаза 0). Настоящие движки — Фазы 1–4;
// пока экран доказывает, что вся цепочка Фазы 0 работает из браузера:
// подтягивает конфиг уровней (GET /levels), прогресс (GET /progress) и даёт
// прогнать «демо-заход» (POST /events батчем + POST /progress). Всё идёт
// через общий api-инстанс, поэтому CSRF проставляется автоматически.
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    getGameLevels, getGameProgress, postGameEvents, upsertGameProgress,
    type GameLevelConfig, type GameProgress,
} from '../api/studentApi';

// Заглушка обслуживает только матричные игры — у остальных есть свои движки.
// Поэтому здесь свой узкий тип, а не общий GameId из каталога.
type MatrixGameId = 'gauss_jordan' | 'eigen_arrow';

const TITLES: Record<MatrixGameId, string> = {
    gauss_jordan: 'Побег Гаусса-Жордана',
    eigen_arrow: 'Стрелка Судьбы',
};

const isMatrixGameId = (v: string | undefined): v is MatrixGameId =>
    v === 'gauss_jordan' || v === 'eigen_arrow';

const MatrixGameStubPage = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const navigate = useNavigate();

    const [levels, setLevels] = useState<GameLevelConfig[]>([]);
    const [progress, setProgress] = useState<Record<string, GameProgress>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyLevel, setBusyLevel] = useState<string | null>(null);

    const load = useCallback(async (id: MatrixGameId) => {
        setLoading(true);
        setError(null);
        try {
            const [levelsResp, progressResp] = await Promise.all([
                getGameLevels(id),
                getGameProgress(id),
            ]);
            setLevels(levelsResp.levels);
            setProgress(Object.fromEntries(progressResp.map((p) => [p.level_id, p])));
        } catch {
            setError('Не удалось загрузить уровни. Попробуйте обновить страницу.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isMatrixGameId(gameId)) {
            setError('Неизвестная игра.');
            setLoading(false);
            return;
        }
        load(gameId);
    }, [gameId, load]);

    // Демо-заход: одна сессия с двумя событиями + запись результата. Заменится
    // реальным игровым циклом в Фазах 2/4 — сейчас это ручной смоук цепочки.
    const runDemoRound = async (level: GameLevelConfig) => {
        if (!isMatrixGameId(gameId)) return;
        setBusyLevel(level.level_id);
        try {
            const stars = 1 + Math.floor(Math.random() * 3); // 1..3
            const metric = 3 + Math.floor(Math.random() * 8); // ходы/итерации
            await postGameEvents({
                game_id: gameId,
                events: [
                    { event_type: 'level_start', payload: { level_id: level.level_id }, client_ts: new Date().toISOString() },
                    { event_type: 'level_complete', payload: { level_id: level.level_id, stars, metric }, client_ts: new Date().toISOString() },
                ],
                end_session: true,
            });
            const updated = await upsertGameProgress(gameId, level.level_id, stars, metric);
            setProgress((prev) => ({ ...prev, [level.level_id]: updated }));
        } catch {
            setError('Не удалось записать демо-заход.');
        } finally {
            setBusyLevel(null);
        }
    };

    const title = isMatrixGameId(gameId) ? TITLES[gameId] : 'Игра';

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <div className="max-w-3xl mx-auto px-4 py-10 mt-16">
                <button
                    type="button"
                    onClick={() => navigate('/games')}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    ← Ко всем играм
                </button>

                <h1 className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>

                <div className="mt-3 mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-300">
                    Движок игры появится в Фазах&nbsp;1–4. Пока это фундамент: уровни, прогресс
                    и телеметрия уже работают — «демо-заход» записывает результат по-настоящему.
                </div>

                {loading && (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-8">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        Загрузка уровней…
                    </div>
                )}

                {error && !loading && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
                        {error}
                    </div>
                )}

                {!loading && !error && (
                    <ul className="space-y-3">
                        {levels.map((level) => {
                            const best = progress[level.level_id];
                            const busy = busyLevel === level.level_id;
                            return (
                                <li
                                    key={level.level_id}
                                    className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors"
                                >
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">{level.title}</div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500">
                                            Сложность {level.difficulty}
                                            {best
                                                ? ` · рекорд: ${'★'.repeat(best.best_stars)}${'☆'.repeat(3 - best.best_stars)}` +
                                                  (best.best_metric != null ? ` · ${best.best_metric}` : '')
                                                : ' · ещё не пройден'}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => runDemoRound(level)}
                                        className="shrink-0 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                                    >
                                        {busy ? '…' : 'Демо-заход'}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default MatrixGameStubPage;
