// src/components/games/LimitsApproach.tsx
//
// R4: игра "Приближение" (первая из новых игр по опросу пользователя —
// пределы/ряды/диф.уравнения/матрицы). Раньше MathLab был плоским
// 60-секундным спринтом с печатью формулы как ответа — неясно, "как
// доиграть до конца", и легко получить "неверно" из-за синтаксиса, а не
// незнания математики. Здесь: фиксированное число раундов с видимым
// прогрессом, ответ — выбор варианта (не ввод), и адаптивная сложность
// по серии верных/неверных ответов, а не глобальный таймер на всю игру.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as math from 'mathjs';
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, XAxis, YAxis } from 'recharts';
import Button from '../ui/Button';

export interface LimitTask {
    id: string;
    question: string;
    functionExpression: string;
    approachX: string; // "2" | "infinity" | "-infinity"
    correctAnswer: string;
    options: string[];
    difficulty: number;
    hints: string[];
}

interface LimitsApproachProps {
    difficulty?: number;
    tasksSource: LimitTask[];
    onComplete: (score: number, maxScore: number) => void;
}

const TOTAL_ROUNDS = 8;
const POINTS_PER_ROUND = 10;
const STREAK_TO_LEVEL_UP = 3;
const ZOOM_STEPS = 24;
const ZOOM_STEP_MS = 60;

function evaluateAt(expr: string, x: number): number | null {
    try {
        const result = math.evaluate(expr, { x });
        if (typeof result !== 'number' || !isFinite(result)) return null;
        return result;
    } catch {
        return null;
    }
}

/**
 * Точки графика в окрестности approachX, "сжимающейся" по мере роста
 * zoomStep — так и выглядит визуальное приближение. Для approachX =
 * ±infinity вместо сжатия домена расширяем его (дальше по x = "ближе"
 * к бесконечности), логика та же: чем выше zoomStep, тем нагляднее тренд.
 */
function buildPoints(expr: string, approachX: string, zoomStep: number): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    const pointsPerSide = 12;

    if (approachX === 'infinity' || approachX === '-infinity') {
        const sign = approachX === 'infinity' ? 1 : -1;
        const reach = 5 + zoomStep * 4; // растёт с каждым шагом "приближения" к бесконечности
        for (let i = 1; i <= pointsPerSide * 2; i++) {
            const x = sign * (reach * i) / (pointsPerSide * 2);
            const y = evaluateAt(expr, x);
            if (y !== null) points.push({ x, y });
        }
        return points;
    }

    const target = parseFloat(approachX);
    const span = Math.max(0.05, 3 / Math.pow(1.35, zoomStep)); // сужается с каждым шагом
    for (let side = -1; side <= 1; side += 2) {
        for (let i = 1; i <= pointsPerSide; i++) {
            const x = target + side * span * (i / pointsPerSide);
            const y = evaluateAt(expr, x);
            if (y !== null) points.push({ x, y });
        }
    }
    return points;
}

const DIFFICULTY_LABEL: Record<number, string> = {
    1: 'Совсем просто', 2: 'Просто', 3: 'Средне', 4: 'Сложно', 5: 'Очень сложно',
};

const LimitsApproach = ({ difficulty = 3, tasksSource, onComplete }: LimitsApproachProps) => {
    const [started, setStarted] = useState(false);
    const [roundIndex, setRoundIndex] = useState(0);
    const [currentTier, setCurrentTier] = useState(difficulty);
    const [streak, setStreak] = useState(0);
    const [score, setScore] = useState(0);
    const [usedTaskIds, setUsedTaskIds] = useState<Set<string>>(new Set());
    const [currentTask, setCurrentTask] = useState<LimitTask | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [zoomStep, setZoomStep] = useState(0);
    const zoomTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const totalRounds = Math.min(TOTAL_ROUNDS, tasksSource.length || TOTAL_ROUNDS);
    const maxScore = totalRounds * POINTS_PER_ROUND;

    const pickNextTask = (tier: number, used: Set<string>): LimitTask | null => {
        const pool = tasksSource.filter(t => !used.has(t.id));
        if (pool.length === 0) return null;
        // Ближайшая по сложности к текущему уровню, а не только точное совпадение —
        // иначе на маленьком банке заданий игра могла бы "застрять" без вариантов.
        const sorted = [...pool].sort((a, b) => Math.abs(a.difficulty - tier) - Math.abs(b.difficulty - tier));
        return sorted[0];
    };

    const startRound = (tier: number, used: Set<string>) => {
        const task = pickNextTask(tier, used);
        setCurrentTask(task);
        setSelected(null);
        setShowFeedback(false);
        setZoomStep(0);
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

    // Анимация "приближения" — сжимаем окрестность вокруг approachX по шагам.
    useEffect(() => {
        if (!started || !currentTask || showFeedback) return;
        setZoomStep(0);
        zoomTimerRef.current = setInterval(() => {
            setZoomStep(prev => (prev >= ZOOM_STEPS ? prev : prev + 1));
        }, ZOOM_STEP_MS);
        return () => {
            if (zoomTimerRef.current) clearInterval(zoomTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTask, started]);

    const points = useMemo(() => {
        if (!currentTask) return [];
        return buildPoints(currentTask.functionExpression, currentTask.approachX, zoomStep);
    }, [currentTask, zoomStep]);

    const handleAnswer = (option: string) => {
        if (showFeedback || !currentTask) return;
        if (zoomTimerRef.current) clearInterval(zoomTimerRef.current);

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
                        <span className="text-3xl text-white font-serif leading-none">lim</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">Приближение</h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 transition-colors">
                        График приближается к точке — смотрите, к чему стремится функция,
                        и выбирайте предел. {totalRounds} раундов, сложность подстраивается под вас.
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

    const zoomProgress = zoomStep / ZOOM_STEPS;
    const isInfinite = currentTask.approachX === 'infinity' || currentTask.approachX === '-infinity';
    const approachLabel = currentTask.approachX === 'infinity' ? '+∞'
        : currentTask.approachX === '-infinity' ? '-∞'
        : currentTask.approachX;

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
                    f(x) = {currentTask.functionExpression}, &nbsp; x → {approachLabel}
                </p>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white transition-colors">
                    {currentTask.question}
                </h3>
            </div>

            {/* Граф приближения */}
            <div className="flex-1 min-h-0 px-2">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 11 }} />
                        <YAxis dataKey="y" type="number" tick={{ fontSize: 11 }} />
                        {!isInfinite && (
                            <ReferenceLine
                                x={parseFloat(currentTask.approachX)}
                                stroke="#818CF8"
                                strokeDasharray="4 4"
                                label={{ value: `x=${approachLabel}`, position: 'top', fontSize: 11, fill: '#818CF8' }}
                            />
                        )}
                        <Scatter data={points} fill="#6366F1" />
                    </ScatterChart>
                </ResponsiveContainer>
                {!showFeedback && (
                    <p className="text-center text-xs text-gray-400 dark:text-slate-500 -mt-2 transition-colors">
                        {zoomProgress < 1 ? 'Приближаемся…' : 'Куда стремится график?'}
                    </p>
                )}
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

export default LimitsApproach;
