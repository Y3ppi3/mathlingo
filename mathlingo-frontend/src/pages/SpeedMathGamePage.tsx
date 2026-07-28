// src/pages/SpeedMathGamePage.tsx
//
// Обвязка игры «Скоростной счёт» (Ф4): выбор блока, прогресс с бэкенда и
// телеметрия. Сам игровой цикл — в SpeedMathGame; здесь сеть.
//
// Одна сессия телеметрии на заход. Ответы шлём батчем в конце забега, а не по
// одному: за минуту их набирается два десятка, и слать двадцать запросов на
// спринте — гарантированные лаги ровно там, где важна отзывчивость.
//
// game_id = 'speed-math'; метрика рекорда — число ошибок (меньше лучше),
// звёзды — от набранного счёта.
//
// Navbar здесь не рендерим: App.tsx ставит его глобально.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SpeedMathGame from '../components/games/SpeedMathGame';
import { SPEED_MATH_LEVELS } from '../games/speedMath/levels';
import { type SpeedTask } from '../games/speedMath/engine';
import {
    getGameProgress, postGameEvents, upsertGameProgress,
    type GameEvent, type GameProgress,
} from '../api/studentApi';

const GAME_ID = 'speed-math' as const;

const SpeedMathGamePage = () => {
    const navigate = useNavigate();

    const [progress, setProgress] = useState<Record<string, GameProgress>>({});
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const sessionRef = useRef<number | undefined>(undefined);
    // Копим ответы забега и отправляем одним батчем на финише.
    const pendingRef = useRef<GameEvent[]>([]);

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
        const level = SPEED_MATH_LEVELS[index];
        sessionRef.current = undefined; // новая сессия на каждый заход
        pendingRef.current = [];
        setActiveIndex(index);
        emit([{ event_type: 'level_start', payload: { level_id: level.level_id }, client_ts: new Date().toISOString() }]);
    };

    // По разбору ответов видно, на чём именно спотыкаются: какие примеры чаще
    // всего берут неверный вариант (admin/games-analytics).
    const handleAnswer = (task: SpeedTask, chosen: number, correct: boolean) => {
        if (activeIndex === null) return;
        const level = SPEED_MATH_LEVELS[activeIndex];
        pendingRef.current.push({
            event_type: 'move_made',
            payload: { level_id: level.level_id, prompt: task.prompt, chosen, answer: task.answer, correct },
            client_ts: new Date().toISOString(),
        });
    };

    const handleComplete = async (result: {
        score: number; stars: 1 | 2 | 3; wrong: number; bestStreak: number; timeMs: number;
    }) => {
        if (activeIndex === null) return;
        const level = SPEED_MATH_LEVELS[activeIndex];
        const events = [...pendingRef.current, {
            event_type: 'level_complete',
            payload: {
                level_id: level.level_id, score: result.score, stars: result.stars,
                wrong: result.wrong, best_streak: result.bestStreak, time_ms: result.timeMs,
            },
            client_ts: new Date().toISOString(),
        }];
        pendingRef.current = [];
        await emit(events, true);
        try {
            const saved = await upsertGameProgress(GAME_ID, level.level_id, result.stars, result.wrong);
            setProgress((prev) => ({ ...prev, [level.level_id]: saved }));
        } catch {
            /* прогресс не сохранился — рекорд просто не обновится */
        }
    };

    const handleExit = (finished: boolean) => {
        if (!finished && activeIndex !== null) {
            const level = SPEED_MATH_LEVELS[activeIndex];
            // Бросил забег на середине — ответы всё равно донесём, они
            // рассказывают о сложности не меньше завершённых.
            emit([...pendingRef.current, {
                event_type: 'level_abandon',
                payload: { level_id: level.level_id },
                client_ts: new Date().toISOString(),
            }], true);
        }
        pendingRef.current = [];
        sessionRef.current = undefined;
        setActiveIndex(null);
    };

    const handleNextLevel = () => {
        if (activeIndex === null) return;
        const next = activeIndex + 1;
        if (next < SPEED_MATH_LEVELS.length) {
            startLevel(next);
        } else {
            setActiveIndex(null);
        }
    };

    const activeLevel = activeIndex !== null ? SPEED_MATH_LEVELS[activeIndex] : null;

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <div className="max-w-3xl mx-auto px-4 py-10 mt-16">
                {activeLevel ? (
                    <SpeedMathGame
                        key={activeLevel.level_id}
                        level={activeLevel}
                        bestStars={progress[activeLevel.level_id]?.best_stars}
                        bestMetric={progress[activeLevel.level_id]?.best_metric}
                        hasNextLevel={activeIndex! < SPEED_MATH_LEVELS.length - 1}
                        onAnswer={handleAnswer}
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
                        <h1 className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">Скоростной счёт</h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            Минута на устный счёт. Серия верных ответов поднимает множитель — ошибка сбрасывает его,
                            но времени не отнимает. Выбирай любой блок.
                        </p>

                        <ul className="mt-6 space-y-3">
                            {SPEED_MATH_LEVELS.map((level, index) => {
                                const best = progress[level.level_id];
                                return (
                                    <li key={level.level_id}>
                                        <button
                                            type="button"
                                            onClick={() => startLevel(index)}
                                            data-testid={`level-${level.level_id}`}
                                            className="w-full flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors text-left"
                                        >
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">{level.title}</div>
                                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                                    {level.hint} · {level.durationSec} с · цель {level.target}
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

export default SpeedMathGamePage;
