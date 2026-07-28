// src/components/games/SpeedMathGame.tsx
//
// UI игры «Скоростной счёт» (Ф4, школьный уровень). Забег на минуту: задача —
// три варианта — сразу следующая. Серия верных ответов поднимает множитель.
//
// Тон (project_vision_design): ошибка сбрасывает множитель, но не отнимает
// время и не обрывает забег — счёт в уме ставится спокойным повторением, а не
// страхом ошибиться. Поэтому и «неверно» пишем нейтрально, показывая верный
// ответ, а не красный крест.
//
// Крючок — комбо: ×5 за длинную серию видно на экране и хочется удержать.
//
// Вся математика и подсчёт очков — в чистом движке src/games/speedMath.
// Компонент владеет только таймером и вводом.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    type RunState, type SpeedTask,
    applyAnswer, emptyRun, multiplierFor, starsForScore,
} from '../../games/speedMath/engine';
import { type SpeedMathLevel, generateTasks } from '../../games/speedMath/levels';

export interface SpeedMathGameProps {
    level: SpeedMathLevel;
    bestStars?: number;
    bestMetric?: number | null; // прошлый рекорд по числу ошибок
    hasNextLevel?: boolean;
    onAnswer?: (task: SpeedTask, chosen: number, correct: boolean) => void;
    onComplete?: (result: { score: number; stars: 1 | 2 | 3; wrong: number; bestStreak: number; timeMs: number }) => void;
    onExit?: (finished: boolean) => void;
    onNextLevel?: () => void;
}

// Показываем вводный экран один раз за сессию, а не на каждый уровень.
let introSeenThisSession = false;

const SpeedMathGame = ({
    level, bestMetric, hasNextLevel, onAnswer, onComplete, onExit, onNextLevel,
}: SpeedMathGameProps) => {
    const [phase, setPhase] = useState<'ready' | 'running' | 'done'>('ready');
    const [tasks, setTasks] = useState<SpeedTask[]>([]);
    const [index, setIndex] = useState(0);
    const [run, setRun] = useState<RunState>(emptyRun);
    const [remainingMs, setRemainingMs] = useState(level.durationSec * 1000);
    const [flash, setFlash] = useState<{ correct: boolean; answer: number } | null>(null);
    const [showIntro, setShowIntro] = useState(!introSeenThisSession);

    const deadlineRef = useRef<number>(0);
    const startedAtRef = useRef<number>(0);
    // onComplete обязан сработать ровно один раз: таймер и «кончились задания»
    // могут финишировать забег наперегонки.
    const finishedRef = useRef(false);

    const finish = useCallback((final: RunState) => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        setPhase('done');
        onComplete?.({
            score: final.score,
            stars: starsForScore(final.score, level.target),
            wrong: final.wrong,
            bestStreak: final.bestStreak,
            timeMs: Date.now() - startedAtRef.current,
        });
    }, [level.target, onComplete]);

    // Таймер считает от дедлайна, а не вычитанием по тику: интервал в фоновой
    // вкладке загрубляется, и накопленная разница уехала бы на секунды.
    useEffect(() => {
        if (phase !== 'running') return;
        const id = window.setInterval(() => {
            const left = Math.max(0, deadlineRef.current - Date.now());
            setRemainingMs(left);
            if (left === 0) setRun((current) => { finish(current); return current; });
        }, 100);
        return () => window.clearInterval(id);
    }, [phase, finish]);

    const start = () => {
        finishedRef.current = false;
        setTasks(generateTasks(level));
        setIndex(0);
        setRun(emptyRun());
        setFlash(null);
        setRemainingMs(level.durationSec * 1000);
        deadlineRef.current = Date.now() + level.durationSec * 1000;
        startedAtRef.current = Date.now();
        setPhase('running');
    };

    const answer = (chosen: number) => {
        if (phase !== 'running') return;
        const task = tasks[index];
        const correct = chosen === task.answer;
        const next = applyAnswer(run, correct);

        setRun(next);
        setFlash({ correct, answer: task.answer });
        onAnswer?.(task, chosen, correct);

        if (index + 1 >= tasks.length) {
            finish(next); // задания кончились раньше времени
            return;
        }
        setIndex((i) => i + 1);
    };

    // Подсветка ответа гаснет сама — забег не должен ждать игрока.
    useEffect(() => {
        if (!flash) return;
        const id = window.setTimeout(() => setFlash(null), 600);
        return () => window.clearTimeout(id);
    }, [flash]);

    const task = tasks[index];
    const seconds = Math.ceil(remainingMs / 1000);
    const stars = starsForScore(run.score, level.target);
    const multiplier = multiplierFor(run.streak + 1);
    const isRecord = phase === 'done' && (bestMetric === null || bestMetric === undefined || run.wrong < bestMetric);
    const progressPct = Math.max(0, Math.min(100, (remainingMs / (level.durationSec * 1000)) * 100));

    return (
        <div className="max-w-xl mx-auto">
            {/* Вводный экран «как играть» */}
            {showIntro && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
                    <div className="max-w-sm w-full p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Как играть</h3>
                        <div className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-300">
                            <p><span className="font-medium text-gray-900 dark:text-white">⚡ Идея:</span> минута на устный счёт. Чем длиннее серия верных ответов, тем дороже каждый следующий.</p>
                            <p><span className="font-medium text-gray-900 dark:text-white">🎯 Цель:</span> набрать {level.target} очков — это три звезды.</p>
                            <p><span className="font-medium text-gray-900 dark:text-white">🕹 Ход игры:</span></p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Три подряд — множитель <b>×2</b>, пять — <b>×3</b>, восемь — <b>×5</b></li>
                                <li>Ошибка сбрасывает множитель, но <b>не отнимает время</b></li>
                                <li>Забег идёт до конца — оборвать его ошибкой нельзя</li>
                            </ul>
                        </div>
                        <button
                            type="button"
                            onClick={() => { introSeenThisSession = true; setShowIntro(false); }}
                            className="mt-5 w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                        >
                            Понятно
                        </button>
                    </div>
                </div>
            )}

            {/* Верхняя панель */}
            <div className="flex items-center justify-between mb-3 gap-3">
                <button
                    type="button"
                    onClick={() => onExit?.(phase === 'done')}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    ← К блокам
                </button>
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    {typeof bestMetric === 'number' && (
                        <span className="text-gray-400 dark:text-gray-500">рекорд ошибок: {bestMetric}</span>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowIntro(true)}
                        aria-label="Как играть"
                        className="w-6 h-6 rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-indigo-400 transition-colors"
                    >
                        ?
                    </button>
                </div>
            </div>

            {phase === 'ready' && (
                <div className="text-center py-10">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{level.title}</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{level.hint}</p>
                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                        {level.durationSec} секунд. Цель — {level.target} очков.
                    </p>
                    <button
                        type="button"
                        onClick={start}
                        data-testid="sm-start"
                        className="mt-6 h-12 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-base font-medium transition-colors"
                    >
                        Поехали
                    </button>
                </div>
            )}

            {phase === 'running' && task && (
                <>
                    {/* Счёт, время, комбо */}
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                            ⏱ <span data-testid="sm-time" className="font-semibold text-gray-900 dark:text-white">{seconds}</span> с
                        </span>
                        {multiplier > 1 && (
                            <span data-testid="sm-combo" className="font-semibold text-amber-500">
                                комбо ×{multiplier}
                            </span>
                        )}
                        <span className="text-gray-500 dark:text-gray-400">
                            счёт <span data-testid="sm-score" className="font-semibold text-gray-900 dark:text-white">{run.score}</span>
                        </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className="h-full bg-indigo-500 transition-[width] duration-100 ease-linear" style={{ width: `${progressPct}%` }} />
                    </div>

                    {/* Задание */}
                    <div className="mt-10 text-center">
                        <div data-testid="sm-prompt" className="text-5xl font-semibold text-gray-900 dark:text-white">
                            {task.prompt}
                        </div>
                    </div>

                    {/* Варианты */}
                    <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {task.options.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => answer(option)}
                                data-testid={`sm-option-${option}`}
                                className="h-14 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xl font-semibold text-gray-900 dark:text-white hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                            >
                                {option}
                            </button>
                        ))}
                    </div>

                    {/* Мгновенная реакция: гаснет сама, забег не останавливается */}
                    <div className="mt-4 h-6 text-center text-sm">
                        {flash && (
                            <span data-testid="sm-flash" className={flash.correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                                {flash.correct ? 'Верно' : `Было ${flash.answer}`}
                            </span>
                        )}
                    </div>
                </>
            )}

            {phase === 'done' && (
                <div data-testid="sm-summary" className="mt-4 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5">
                    <div className="text-amber-500 text-xl">
                        {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{run.score} очков</div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        Верных: {run.correct} · ошибок: {run.wrong} · лучшая серия: {run.bestStreak}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {run.score >= level.target
                            ? 'Цель взята.'
                            : `До трёх звёзд — ещё ${level.target - run.score} очков.`}
                    </p>
                    {isRecord && run.wrong === 0 && (
                        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">Забег без единой ошибки.</p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={start}
                            data-testid="sm-again"
                            className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                        >
                            Ещё забег
                        </button>
                        {hasNextLevel && (
                            <button
                                type="button"
                                onClick={() => onNextLevel?.()}
                                className="h-11 px-5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-indigo-400 transition-colors"
                            >
                                Следующий блок
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => onExit?.(true)}
                            className="h-11 px-5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-indigo-400 transition-colors"
                        >
                            К блокам
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpeedMathGame;
