// src/components/games/SeriesFilling.tsx
//
// R4: игра "Наполнение" (вторая из новых игр — Ряды). Частичные суммы
// ряда показываются как уровень жидкости в сосуде: растёт с каждым
// добавленным членом. Если ряд сходится — уровень замедляется и
// устаканивается ниже края; если расходится — уровень доходит до края
// и "переливается". Тот же принцип, что в LimitsApproach: визуальное
// поведение вместо печати формулы, MC-ответ, фиксированные раунды с
// видимым прогрессом, адаптивная сложность по серии.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as math from 'mathjs';
import Button from '../ui/Button';

export interface SeriesTask {
    id: string;
    question: string;
    termExpression: string; // формула a(n), переменная n (не x)
    correctAnswer: string;
    options: string[];
    difficulty: number;
    hints: string[];
}

interface SeriesFillingProps {
    difficulty?: number;
    tasksSource: SeriesTask[];
    onComplete: (score: number, maxScore: number) => void;
}

const TOTAL_ROUNDS = 8;
const POINTS_PER_ROUND = 10;
const STREAK_TO_LEVEL_UP = 3;
const TERMS_TO_SHOW = 8;
const TERM_REVEAL_MS = 450;

function evaluateTerm(expr: string, n: number): number | null {
    try {
        const result = math.evaluate(expr, { n });
        if (typeof result !== 'number' || !isFinite(result)) return null;
        return result;
    } catch {
        return null;
    }
}

function buildPartialSums(expr: string, count: number): number[] {
    const sums: number[] = [];
    let running = 0;
    for (let n = 1; n <= count; n++) {
        const term = evaluateTerm(expr, n);
        running += term ?? 0;
        sums.push(running);
    }
    return sums;
}

const DIFFICULTY_LABEL: Record<number, string> = {
    1: 'Совсем просто', 2: 'Просто', 3: 'Средне', 4: 'Сложно', 5: 'Очень сложно',
};

const SeriesFilling = ({ difficulty = 3, tasksSource, onComplete }: SeriesFillingProps) => {
    const [started, setStarted] = useState(false);
    const [roundIndex, setRoundIndex] = useState(0);
    const [currentTier, setCurrentTier] = useState(difficulty);
    const [streak, setStreak] = useState(0);
    const [score, setScore] = useState(0);
    const [usedTaskIds, setUsedTaskIds] = useState<Set<string>>(new Set());
    const [currentTask, setCurrentTask] = useState<SeriesTask | null>(null);
    const [visibleTerms, setVisibleTerms] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const totalRounds = Math.min(TOTAL_ROUNDS, tasksSource.length || TOTAL_ROUNDS);
    const maxScore = totalRounds * POINTS_PER_ROUND;

    const pickNextTask = (tier: number, used: Set<string>): SeriesTask | null => {
        const pool = tasksSource.filter(t => !used.has(t.id));
        if (pool.length === 0) return null;
        const sorted = [...pool].sort((a, b) => Math.abs(a.difficulty - tier) - Math.abs(b.difficulty - tier));
        return sorted[0];
    };

    const startRound = (tier: number, used: Set<string>) => {
        const task = pickNextTask(tier, used);
        setCurrentTask(task);
        setSelected(null);
        setShowFeedback(false);
        setVisibleTerms(0);
    };

    const handleStart = () => {
        setStarted(true);
        setRoundIndex(0);
        setCurrentTier(difficulty);
        setStreak(0);
        setScore(0);
        setUsedTaskIds(new Set());
        startRound(difficulty, new Set());
    };

    // Раскрываем члены ряда по одному — так видно, КАК уровень растёт/замедляется.
    useEffect(() => {
        if (!started || !currentTask || showFeedback) return;
        setVisibleTerms(0);
        revealTimerRef.current = setInterval(() => {
            setVisibleTerms(prev => (prev >= TERMS_TO_SHOW ? prev : prev + 1));
        }, TERM_REVEAL_MS);
        return () => {
            if (revealTimerRef.current) clearInterval(revealTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTask, started]);

    const partialSums = useMemo(() => {
        if (!currentTask) return [];
        return buildPartialSums(currentTask.termExpression, TERMS_TO_SHOW);
    }, [currentTask]);

    // Масштаб сосуда: для сходящегося ряда — с запасом над предполагаемым
    // пределом (видно, что уровень устаканивается НИЖЕ края); для
    // расходящегося/неопределённого ответа — по факту роста самих сумм
    // (тогда уровень естественно доходит до края = "переливается").
    const scale = useMemo(() => {
        if (!currentTask) return 1;
        const parsedAnswer = parseFloat(currentTask.correctAnswer);
        if (!isNaN(parsedAnswer) && isFinite(parsedAnswer) && parsedAnswer !== 0) {
            return Math.max(Math.abs(parsedAnswer) * 1.6, 0.1);
        }
        const maxSum = Math.max(...partialSums.map(s => Math.abs(s)), 0.1);
        return maxSum;
    }, [currentTask, partialSums]);

    const currentSum = partialSums[visibleTerms - 1] ?? 0;
    const fillRatio = Math.min(Math.abs(currentSum) / scale, 1);
    const isOverflowing = Math.abs(currentSum) >= scale * 0.98;

    const handleAnswer = (option: string) => {
        if (showFeedback || !currentTask) return;
        if (revealTimerRef.current) clearInterval(revealTimerRef.current);
        setVisibleTerms(TERMS_TO_SHOW);

        setSelected(option);
        setShowFeedback(true);

        const isCorrect = option === currentTask.correctAnswer;
        if (isCorrect) {
            setScore(s => s + POINTS_PER_ROUND);
            setStreak(s => {
                const next = s + 1;
                if (next >= STREAK_TO_LEVEL_UP) {
                    setCurrentTier(t => Math.min(5, t + 1));
                    return 0;
                }
                return next;
            });
        } else {
            setStreak(0);
            setCurrentTier(t => Math.max(1, t - 1));
        }
    };

    const handleNext = () => {
        const nextUsed = new Set(usedTaskIds);
        if (currentTask) nextUsed.add(currentTask.id);
        setUsedTaskIds(nextUsed);

        const nextIndex = roundIndex + 1;
        if (nextIndex >= totalRounds) {
            onComplete(score, maxScore);
            return;
        }
        setRoundIndex(nextIndex);
        startRound(currentTier, nextUsed);
    };

    if (!started) {
        return (
            <div className="h-full flex items-center justify-center bg-white dark:bg-gray-900 transition-colors px-4">
                <div className="max-w-sm w-full text-center">
                    <div className="brand-icon-badge w-16 h-16 mb-5 mx-auto">
                        <span className="text-3xl text-white font-serif leading-none">Σ</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">Наполнение</h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 transition-colors">
                        Смотрите, как растёт сумма ряда — уровень в сосуде. Устаканивается
                        ниже края — ряд сходится; доходит до края — расходится.
                        {' '}{totalRounds} раундов, сложность подстраивается под вас.
                    </p>
                    <Button onClick={handleStart} fullWidth>Начать</Button>
                </div>
            </div>
        );
    }

    if (!currentTask) {
        return (
            <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-slate-500 px-4 text-center">
                Заданий для этой сложности не нашлось — попробуйте позже.
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white dark:bg-gray-900 transition-colors">
            {/* Прогресс раунда */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 text-xs text-gray-400 dark:text-slate-500 transition-colors">
                <span>Раунд {roundIndex + 1} из {totalRounds}</span>
                <span className="flex items-center gap-1">
                    {streak > 0 && <span title="Серия верных ответов">🔥 {streak}</span>}
                    <span className="text-indigo-500 dark:text-indigo-400 font-medium">{DIFFICULTY_LABEL[currentTier]}</span>
                </span>
            </div>
            <div className="flex-shrink-0 h-1.5 bg-gray-100 dark:bg-slate-800 mx-4 rounded-full overflow-hidden">
                <div
                    className="h-full brand-gradient rounded-full transition-all duration-500"
                    style={{ width: `${((roundIndex + (showFeedback ? 1 : 0)) / totalRounds) * 100}%` }}
                />
            </div>

            {/* Вопрос */}
            <div className="flex-shrink-0 px-4 pt-3 text-center">
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-1 transition-colors">
                    Σ a(n), &nbsp; a(n) = {currentTask.termExpression}
                </p>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white transition-colors">
                    {currentTask.question}
                </h3>
            </div>

            {/* Сосуд */}
            <div className="flex-1 min-h-0 flex items-center justify-center gap-6 px-4">
                <div className="relative w-24 h-full max-h-56 border-2 border-gray-300 dark:border-slate-600 rounded-b-2xl rounded-t-md overflow-hidden bg-gray-50 dark:bg-slate-800/50">
                    <div
                        className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${
                            isOverflowing
                                ? 'bg-gradient-to-t from-red-500 to-orange-400'
                                : 'bg-gradient-to-t from-indigo-500 to-violet-400'
                        }`}
                        style={{ height: `${fillRatio * 100}%` }}
                    />
                    {!isOverflowing && (
                        <div
                            className="absolute left-0 right-0 border-t-2 border-dashed border-indigo-300 dark:border-indigo-400/60"
                            style={{ bottom: `${Math.min(1 / 1.6, 1) * 100}%` }}
                        />
                    )}
                </div>
                <div className="text-sm text-gray-500 dark:text-slate-400 transition-colors">
                    <p className="font-mono text-gray-900 dark:text-white text-base mb-1">
                        S{visibleTerms || 1} = {currentSum.toFixed(3)}
                    </p>
                    {isOverflowing && visibleTerms >= TERMS_TO_SHOW && (
                        <p className="text-red-500 dark:text-red-400 text-xs">переливается…</p>
                    )}
                    {!isOverflowing && visibleTerms < TERMS_TO_SHOW && (
                        <p className="text-xs">добавляем члены…</p>
                    )}
                    {!isOverflowing && visibleTerms >= TERMS_TO_SHOW && (
                        <p className="text-xs">к чему стремится сумма?</p>
                    )}
                </div>
            </div>

            {/* Варианты ответа */}
            <div className="flex-shrink-0 p-4 grid grid-cols-2 gap-2">
                {currentTask.options.map(option => {
                    const isSelected = selected === option;
                    const isCorrectOption = option === currentTask.correctAnswer;
                    let variantClass = 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-white';
                    if (showFeedback && isCorrectOption) {
                        variantClass = 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400 text-emerald-700 dark:text-emerald-300';
                    } else if (showFeedback && isSelected && !isCorrectOption) {
                        variantClass = 'bg-red-50 dark:bg-red-500/10 border-red-400 text-red-700 dark:text-red-300';
                    }
                    return (
                        <button
                            key={option}
                            type="button"
                            disabled={showFeedback}
                            onClick={() => handleAnswer(option)}
                            style={{ padding: '0.75rem' }}
                            className={`border rounded-xl text-sm font-medium transition-colors ${variantClass} ${!showFeedback ? 'hover:border-indigo-400' : ''}`}
                        >
                            {option}
                        </button>
                    );
                })}
            </div>

            {showFeedback && (
                <div className="flex-shrink-0 px-4 pb-4">
                    <Button onClick={handleNext} fullWidth>
                        {roundIndex + 1 >= totalRounds ? 'Завершить' : 'Дальше'}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default SeriesFilling;
