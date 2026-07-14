// src/components/games/SlopeField.tsx
//
// R4: игра "Наклон" — дифференциальные уравнения первого порядка
// dy/dx = f(x,y). Ответ — выбор кривой, которая проходит через отмеченную
// точку старта вдоль поля направлений, а не решение уравнения аналитически —
// тот же принцип "визуальная интуиция, не ввод формулы", что и в
// "Приближении"/"Наполнении" (см. LimitsApproach.tsx/SeriesFilling.tsx).
import { useMemo, useState } from 'react';
import * as math from 'mathjs';
import Button from '../ui/Button';

export interface SlopeFieldTask {
    id: string;
    question: string;
    fieldExpression: string; // f(x,y) в dy/dx = f(x,y)
    startPoint: [number, number];
    correctAnswer: string;
    options: string[]; // явные формулы y(x) кандидатных кривых
    difficulty: number;
    hints: string[];
}

interface SlopeFieldProps {
    difficulty?: number;
    tasksSource: SlopeFieldTask[];
    onComplete: (score: number, maxScore: number) => void;
}

const TOTAL_ROUNDS = 8;
const POINTS_PER_ROUND = 10;
const STREAK_TO_LEVEL_UP = 3;
const HALF_RANGE = 4;
const GRID_N = 9;
const VIEW_SIZE = 300;
const CURVE_SAMPLES = 60;

const OPTION_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#F43F5E', '#0EA5E9'];
const OPTION_LETTERS = ['А', 'Б', 'В', 'Г', 'Д'];

const DIFFICULTY_LABEL: Record<number, string> = {
    1: 'Совсем просто', 2: 'Просто', 3: 'Средне', 4: 'Сложно', 5: 'Очень сложно',
};

function safeEvaluate(expr: string, scope: Record<string, number>): number | null {
    try {
        const result = math.evaluate(expr, scope);
        if (typeof result !== 'number' || !isFinite(result)) return null;
        return result;
    } catch {
        return null;
    }
}

interface Bounds { xMin: number; xMax: number; yMin: number; yMax: number; }

// Область — фиксированный квадрат вокруг точки старта: пиксель-на-единицу
// одинаков по X и Y (иначе штрихи поля направлений визуально искажались бы
// и не отражали реальный угол наклона).
function toPx(x: number, b: Bounds): number {
    return ((x - b.xMin) / (b.xMax - b.xMin)) * VIEW_SIZE;
}
function toPy(y: number, b: Bounds): number {
    return VIEW_SIZE - ((y - b.yMin) / (b.yMax - b.yMin)) * VIEW_SIZE;
}

function buildTicks(fieldExpression: string, b: Bounds) {
    const ticks: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const dataHalfLen = (b.xMax - b.xMin) / (GRID_N * 2.6);
    for (let i = 0; i < GRID_N; i++) {
        const x = b.xMin + ((i + 0.5) / GRID_N) * (b.xMax - b.xMin);
        for (let j = 0; j < GRID_N; j++) {
            const y = b.yMin + ((j + 0.5) / GRID_N) * (b.yMax - b.yMin);
            const slope = safeEvaluate(fieldExpression, { x, y });
            if (slope === null) continue;
            const norm = Math.sqrt(1 + slope * slope);
            const dx = dataHalfLen / norm;
            const dy = (slope * dataHalfLen) / norm;
            ticks.push({
                x1: toPx(x - dx, b), y1: toPy(y - dy, b),
                x2: toPx(x + dx, b), y2: toPy(y + dy, b),
            });
        }
    }
    return ticks;
}

// Строит "d" для <path>, разрывая линию (новый "M") там, где формула не
// определена или улетает далеко за видимую область — иначе разрыв рисовался
// бы как прямая через весь график.
function buildCurvePath(expr: string, b: Bounds): string {
    let d = '';
    let drawing = false;
    const yMargin = b.yMax - b.yMin;
    for (let i = 0; i <= CURVE_SAMPLES; i++) {
        const x = b.xMin + (i / CURVE_SAMPLES) * (b.xMax - b.xMin);
        const y = safeEvaluate(expr, { x });
        if (y === null || y < b.yMin - yMargin || y > b.yMax + yMargin) {
            drawing = false;
            continue;
        }
        const px = toPx(x, b);
        const py = toPy(y, b);
        d += `${drawing ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)} `;
        drawing = true;
    }
    return d.trim();
}

const SlopeField = ({ difficulty = 3, tasksSource, onComplete }: SlopeFieldProps) => {
    const [started, setStarted] = useState(false);
    const [roundIndex, setRoundIndex] = useState(0);
    const [currentTier, setCurrentTier] = useState(difficulty);
    const [streak, setStreak] = useState(0);
    const [score, setScore] = useState(0);
    const [usedTaskIds, setUsedTaskIds] = useState<Set<string>>(new Set());
    const [currentTask, setCurrentTask] = useState<SlopeFieldTask | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);

    const totalRounds = Math.min(TOTAL_ROUNDS, tasksSource.length || TOTAL_ROUNDS);
    const maxScore = totalRounds * POINTS_PER_ROUND;

    const pickNextTask = (tier: number, used: Set<string>): SlopeFieldTask | null => {
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

    const bounds: Bounds | null = useMemo(() => {
        if (!currentTask) return null;
        const [sx, sy] = currentTask.startPoint;
        return { xMin: sx - HALF_RANGE, xMax: sx + HALF_RANGE, yMin: sy - HALF_RANGE, yMax: sy + HALF_RANGE };
    }, [currentTask]);

    const ticks = useMemo(() => {
        if (!currentTask || !bounds) return [];
        return buildTicks(currentTask.fieldExpression, bounds);
    }, [currentTask, bounds]);

    const curvePaths = useMemo(() => {
        if (!currentTask || !bounds) return [];
        return currentTask.options.map(opt => buildCurvePath(opt, bounds));
    }, [currentTask, bounds]);

    const handleAnswer = (option: string) => {
        if (showFeedback || !currentTask) return;
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
                        <span className="text-3xl text-white font-serif leading-none">y'</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">Наклон</h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 transition-colors">
                        Поле направлений показывает, куда «течёт» решение уравнения. Смотрите,
                        куда указывают штрихи из отмеченной точки, и выбирайте кривую, которая
                        действительно идёт вдоль них. {totalRounds} раундов, сложность
                        подстраивается под вас.
                    </p>
                    <Button onClick={handleStart} fullWidth>Начать</Button>
                </div>
            </div>
        );
    }

    if (!currentTask || !bounds) {
        return (
            <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-slate-500 px-4 text-center">
                Заданий для этой сложности не нашлось — попробуйте позже.
            </div>
        );
    }

    const startPx = toPx(currentTask.startPoint[0], bounds);
    const startPy = toPy(currentTask.startPoint[1], bounds);
    const showAxisX = bounds.yMin <= 0 && bounds.yMax >= 0;
    const showAxisY = bounds.xMin <= 0 && bounds.xMax >= 0;

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
                    y' = {currentTask.fieldExpression}, &nbsp; старт: ({currentTask.startPoint[0]}, {currentTask.startPoint[1]})
                </p>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white transition-colors">
                    {currentTask.question}
                </h3>
            </div>

            {/* Поле направлений + кандидатные кривые */}
            <div className="flex-1 min-h-0 flex items-center justify-center px-2 py-1">
                <svg
                    viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
                    className="w-full h-full max-w-[340px] max-h-[340px]"
                    style={{ aspectRatio: '1 / 1' }}
                >
                    {showAxisY && (
                        <line x1={toPx(0, bounds)} y1={0} x2={toPx(0, bounds)} y2={VIEW_SIZE} stroke="currentColor" className="text-gray-200 dark:text-slate-700" strokeWidth={1} />
                    )}
                    {showAxisX && (
                        <line x1={0} y1={toPy(0, bounds)} x2={VIEW_SIZE} y2={toPy(0, bounds)} stroke="currentColor" className="text-gray-200 dark:text-slate-700" strokeWidth={1} />
                    )}
                    {ticks.map((t, i) => (
                        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="currentColor" className="text-gray-300 dark:text-slate-600" strokeWidth={1.5} strokeLinecap="round" />
                    ))}
                    {currentTask.options.map((opt, i) => {
                        const dimmed = showFeedback && opt !== selected && opt !== currentTask.correctAnswer;
                        return (
                            <path
                                key={opt}
                                d={curvePaths[i]}
                                fill="none"
                                stroke={OPTION_COLORS[i % OPTION_COLORS.length]}
                                strokeWidth={dimmed ? 1 : 2.5}
                                opacity={dimmed ? 0.25 : 1}
                            />
                        );
                    })}
                    <circle cx={startPx} cy={startPy} r={5} fill="#1F2937" className="dark:fill-white" />
                    <circle cx={startPx} cy={startPy} r={8} fill="none" stroke="#1F2937" className="dark:stroke-white" strokeWidth={1.5} opacity={0.4} />
                </svg>
            </div>

            {/* Варианты ответа */}
            <div className="flex-shrink-0 p-4 grid grid-cols-1 gap-2">
                {currentTask.options.map((option, i) => {
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
                            style={{ padding: '0.6rem 0.75rem' }}
                            className={`flex items-center gap-2.5 border rounded-xl text-sm font-medium transition-colors ${variantClass} ${!showFeedback ? 'hover:border-indigo-400' : ''}`}
                        >
                            <span
                                className="w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                                style={{ backgroundColor: OPTION_COLORS[i % OPTION_COLORS.length] }}
                            >
                                {OPTION_LETTERS[i % OPTION_LETTERS.length]}
                            </span>
                            <span className="truncate">y = {option}</span>
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

export default SlopeField;
