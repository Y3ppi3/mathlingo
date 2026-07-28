// src/pages/EigenArrowGamePage.tsx
//
// Обвязка игры «Стрелка Судьбы» (Фаза 4): выбор уровня, прогресс с бэкенда и
// телеметрия. Сам игровой цикл — в EigenArrowGame; здесь сеть.
//
// Одна сессия телеметрии на заход: level_start открывает сессию (сервер
// возвращает session_id), move_made(op:tick)/level_complete/level_abandon идут
// в неё, завершение закрывает сессию. Всё через общий api-инстанс — CSRF
// проставляется автоматически, поэтому очки/события не теряются на 403.
//
// game_id = 'eigen_arrow'; метрика рекорда — число подсмотренных тиков (меньше
// лучше), как у «гольфа» игры A метрика — число ходов.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EigenArrowGame from '../components/games/EigenArrowGame';
import { EIGEN_ARROW_LEVELS } from '../games/eigenArrow/levels';
import {
    getGameProgress, postGameEvents, upsertGameProgress,
    type GameEvent, type GameProgress,
} from '../api/studentApi';

const GAME_ID = 'eigen_arrow' as const;

const EigenArrowGamePage = () => {
    const navigate = useNavigate();

    const [progress, setProgress] = useState<Record<string, GameProgress>>({});
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const sessionRef = useRef<number | undefined>(undefined);

    const loadProgress = useCallback(async () => {
        try {
            const rows = await getGameProgress(GAME_ID);
            setProgress(Object.fromEntries(rows.map((p) => [p.level_id, p])));
        } catch {
            // Прогресс не критичен для игры — молча продолжаем без рекордов.
        }
    }, []);

    useEffect(() => {
        loadProgress();
    }, [loadProgress]);

    // Единая точка отправки телеметрии. Держит session_id между батчами;
    // телеметрия никогда не роняет геймплей (ошибки глотаются).
    const emit = useCallback(async (events: GameEvent[], endSession = false) => {
        try {
            const result = await postGameEvents({
                game_id: GAME_ID,
                session_id: sessionRef.current,
                events,
                end_session: endSession,
            });
            sessionRef.current = result.session_id;
        } catch {
            /* нет сети/403 — телеметрия best-effort */
        }
    }, []);

    const startLevel = (index: number) => {
        const level = EIGEN_ARROW_LEVELS[index];
        sessionRef.current = undefined; // новая сессия на каждый заход
        setActiveIndex(index);
        emit([{ event_type: 'level_start', payload: { level_id: level.level_id }, client_ts: new Date().toISOString() }]);
    };

    const handleTick = () => {
        if (activeIndex === null) return;
        const level = EIGEN_ARROW_LEVELS[activeIndex];
        emit([{ event_type: 'move_made', payload: { level_id: level.level_id, op: 'tick' }, client_ts: new Date().toISOString() }]);
    };

    const handleComplete = async (result: { ticks: number; stars: 1 | 2 | 3; errorDeg: number; timeMs: number }) => {
        if (activeIndex === null) return;
        const level = EIGEN_ARROW_LEVELS[activeIndex];
        await emit(
            [{
                event_type: 'level_complete',
                payload: {
                    level_id: level.level_id, ticks: result.ticks,
                    stars: result.stars, error_deg: result.errorDeg, time_ms: result.timeMs,
                },
                client_ts: new Date().toISOString(),
            }],
            true,
        );
        try {
            // Метрика рекорда — число подсмотренных тиков (меньше = лучше).
            const saved = await upsertGameProgress(GAME_ID, level.level_id, result.stars, result.ticks);
            setProgress((prev) => ({ ...prev, [level.level_id]: saved }));
        } catch {
            /* прогресс не сохранился — рекорд просто не обновится */
        }
    };

    const handleExit = (solved: boolean) => {
        if (!solved && activeIndex !== null) {
            const level = EIGEN_ARROW_LEVELS[activeIndex];
            emit([{ event_type: 'level_abandon', payload: { level_id: level.level_id }, client_ts: new Date().toISOString() }], true);
        }
        sessionRef.current = undefined;
        setActiveIndex(null);
    };

    const handleNextLevel = () => {
        if (activeIndex === null) return;
        const next = activeIndex + 1;
        if (next < EIGEN_ARROW_LEVELS.length) {
            startLevel(next);
        } else {
            setActiveIndex(null);
        }
    };

    const activeLevel = activeIndex !== null ? EIGEN_ARROW_LEVELS[activeIndex] : null;

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <div className="max-w-3xl mx-auto px-4 py-10 mt-16">
                {activeLevel ? (
                    <EigenArrowGame
                        key={activeLevel.level_id}
                        level={activeLevel}
                        bestStars={progress[activeLevel.level_id]?.best_stars}
                        bestMetric={progress[activeLevel.level_id]?.best_metric}
                        hasNextLevel={activeIndex! < EIGEN_ARROW_LEVELS.length - 1}
                        onTick={handleTick}
                        onComplete={handleComplete}
                        onExit={handleExit}
                        onNextLevel={handleNextLevel}
                    />
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => navigate('/games')}
                            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        >
                            ← Ко всем играм
                        </button>
                        <h1 className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">Стрелка Судьбы</h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            Предскажите, куда укажет стрелка после многократного умножения на матрицу — к главному
                            собственному вектору. Выберите уровень — все открыты.
                        </p>

                        <ul className="mt-6 space-y-3">
                            {EIGEN_ARROW_LEVELS.map((level, index) => {
                                const best = progress[level.level_id];
                                return (
                                    <li key={level.level_id}>
                                        <button
                                            type="button"
                                            onClick={() => startLevel(index)}
                                            className="w-full flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors text-left"
                                        >
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">{level.title}</div>
                                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                                    Сложность {level.difficulty} · пар {level.par} тиков
                                                </div>
                                            </div>
                                            <div className="text-amber-500 text-sm shrink-0">
                                                {best && best.best_stars > 0
                                                    ? `${'★'.repeat(best.best_stars)}${'☆'.repeat(3 - best.best_stars)}`
                                                    : <span className="text-gray-300 dark:text-gray-600">☆☆☆</span>}
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
};

export default EigenArrowGamePage;
