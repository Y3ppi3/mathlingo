// src/components/games/NumberLineGame.tsx
//
// UI игры «Числовая прямая» (Ф4, школьный уровень). Раунд: показываем число,
// игрок ставит маркер на прямую, после ответа прямая показывает настоящую
// точку рядом с поставленной — видно не «неверно», а насколько и в какую
// сторону промахнулся. Это и есть обучение: чувство величины строится на том,
// что ошибку видно глазами.
//
// Управление двойное намеренно: клик/тап по прямой — быстро, ползунок —
// точно и доступно (работает с клавиатуры и пальцем, в отличие от drag).
//
// Крючок — личный рекорд средней точности за заход (bestMetric, меньше лучше).
//
// Вся математика — в чистом движке src/games/numberLine. Компонент не ходит в
// API сам: телеметрию/прогресс дёргает страница через onRound/onComplete.
import { useMemo, useRef, useState } from 'react';
import { type Question, type RoundResult, formatValue, judge, metricForRun, starsForRun } from '../../games/numberLine/engine';
import { type NumberLineLevel, generateQuestions } from '../../games/numberLine/levels';

export interface NumberLineGameProps {
    level: NumberLineLevel;
    bestStars?: number;
    bestMetric?: number | null; // прошлый рекорд средней точности (сотые деления)
    hasNextLevel?: boolean;
    onRound?: (result: RoundResult) => void;
    onComplete?: (result: { stars: 1 | 2 | 3; metric: number; timeMs: number }) => void;
    onExit?: (finished: boolean) => void;
    onNextLevel?: () => void;
}

// Показываем вводный экран один раз за сессию, а не на каждый уровень.
let introSeenThisSession = false;

const GRADE_TEXT: Record<RoundResult['grade'], string> = {
    exact: 'Точно',
    close: 'Близко',
    miss: 'Мимо',
};

const GRADE_CLASS: Record<RoundResult['grade'], string> = {
    exact: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5',
    close: 'border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/5',
    miss: 'border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5',
};

/** Подписанные деления прямой. */
const ticksOf = (q: Question): number[] => {
    const out: number[] = [];
    for (let v = q.min; v <= q.max + 1e-9; v += q.tick) out.push(Math.round(v * 1000) / 1000);
    return out;
};

const NumberLineGame = ({
    level, bestMetric, hasNextLevel, onRound, onComplete, onExit, onNextLevel,
}: NumberLineGameProps) => {
    const questions = useMemo(() => generateQuestions(level), [level]);

    // Фаза явная, а не выведенная из числа ответов: иначе последний раунд
    // «схлопывается» — итоги показываются сразу после ответа, разбор последнего
    // числа проглатывается, а onComplete не вызывается вовсе.
    const [phase, setPhase] = useState<'aim' | 'reveal' | 'summary'>('aim');
    const [index, setIndex] = useState(0);
    const [guess, setGuess] = useState<number>(questions[0].min);
    const [results, setResults] = useState<RoundResult[]>([]);
    const [revealed, setRevealed] = useState<RoundResult | null>(null);
    const [showIntro, setShowIntro] = useState(!introSeenThisSession);

    const lineRef = useRef<HTMLDivElement | null>(null);
    const startRef = useRef<number>(Date.now());

    const question = questions[index];
    const finished = phase === 'summary';
    const step = question.tick / 100;

    const pct = (value: number) => ((value - question.min) / (question.max - question.min)) * 100;

    const closeIntro = () => {
        introSeenThisSession = true;
        setShowIntro(false);
    };

    // Клик по прямой — быстрый способ прицелиться; ползунок ниже уточняет.
    const placeFromClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (revealed || !lineRef.current) return;
        const rect = lineRef.current.getBoundingClientRect();
        const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
        const raw = question.min + ratio * (question.max - question.min);
        setGuess(Math.round(raw / step) * step);
    };

    const submit = () => {
        if (phase !== 'aim') return;
        const result = judge(question, guess);
        setRevealed(result);
        setResults((prev) => [...prev, result]);
        setPhase('reveal');
        onRound?.(result);
    };

    const next = () => {
        if (phase !== 'reveal') return;
        if (index + 1 >= questions.length) {
            // results здесь уже включает последний раунд — он записан в submit.
            const stars = starsForRun(results);
            const metric = metricForRun(results);
            setPhase('summary');
            setRevealed(null);
            onComplete?.({ stars, metric, timeMs: Date.now() - startRef.current });
            return;
        }
        setIndex((i) => i + 1);
        setGuess(questions[index + 1].min);
        setRevealed(null);
        setPhase('aim');
    };

    const restart = () => {
        setIndex(0);
        setGuess(questions[0].min);
        setResults([]);
        setRevealed(null);
        setPhase('aim');
        startRef.current = Date.now();
    };

    const stars = finished ? starsForRun(results) : 1;
    const metric = finished ? metricForRun(results) : 0;
    const isRecord = finished && (bestMetric === null || bestMetric === undefined || metric < bestMetric);
    const exacts = results.filter((r) => r.grade === 'exact').length;

    return (
        <div className="max-w-xl mx-auto">
            {/* Вводный экран «как играть» */}
            {showIntro && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
                    <div className="max-w-sm w-full p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Как играть</h3>
                        <div className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-300">
                            <p><span className="font-medium text-gray-900 dark:text-white">📏 Идея:</span> у каждого числа есть своё место на прямой. Считать не нужно — нужно почувствовать, где именно.</p>
                            <p><span className="font-medium text-gray-900 dark:text-white">🎯 Цель:</span> поставить маркер как можно ближе к настоящей точке.</p>
                            <p><span className="font-medium text-gray-900 dark:text-white">🕹 Ход игры:</span></p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><b>Ткни</b> в прямую — маркер встанет туда</li>
                                <li><b>Ползунком</b> снизу можно уточнить</li>
                                <li><b>Поставить</b> — и прямая покажет, где число было на самом деле</li>
                            </ul>
                            <p className="text-gray-500 dark:text-gray-400">Промах видно глазами — в этом и смысл.</p>
                        </div>
                        <button
                            type="button"
                            onClick={closeIntro}
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
                    onClick={() => onExit?.(finished)}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    ← К уровням
                </button>
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <span>Раунд <span className="font-semibold text-gray-900 dark:text-white">{Math.min(index + 1, questions.length)}</span>/{questions.length}</span>
                    {typeof bestMetric === 'number' && (
                        <span className="text-gray-400 dark:text-gray-500">· рекорд {bestMetric}</span>
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

            {!finished ? (
                <>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{level.title}</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{level.hint}</p>

                    <div className="mt-6 text-center">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Куда встанет</div>
                        <div data-testid="nl-label" className="mt-1 text-4xl font-semibold text-gray-900 dark:text-white">
                            {question.label}
                        </div>
                    </div>

                    {/* Прямая */}
                    <div className="mt-8 px-2">
                        <div
                            ref={lineRef}
                            onClick={placeFromClick}
                            data-testid="nl-line"
                            className={`relative h-16 ${revealed ? '' : 'cursor-pointer'}`}
                        >
                            {/* Ось */}
                            <div className="absolute left-0 right-0 top-8 h-0.5 bg-gray-300 dark:bg-gray-600" />

                            {/* Деления с подписями */}
                            {ticksOf(question).map((t) => (
                                <div key={t} className="absolute top-6 -translate-x-1/2" style={{ left: `${pct(t)}%` }}>
                                    <div className="w-0.5 h-4 bg-gray-300 dark:bg-gray-600 mx-auto" />
                                    <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">{formatValue(t)}</div>
                                </div>
                            ))}

                            {/* Настоящая точка — только после ответа */}
                            {revealed && (
                                <div
                                    data-testid="nl-truth"
                                    className="absolute top-2 -translate-x-1/2 flex flex-col items-center"
                                    style={{ left: `${pct(question.value)}%` }}
                                >
                                    <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                        {question.label}
                                    </div>
                                    <div className="w-0.5 h-8 bg-emerald-500" />
                                </div>
                            )}

                            {/* Маркер игрока */}
                            <div
                                data-testid="nl-marker"
                                className="absolute top-4 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                                style={{ left: `${pct(guess)}%` }}
                            >
                                <div className={`w-3 h-3 rounded-full ${revealed ? 'bg-indigo-400' : 'bg-indigo-600'}`} />
                                <div className={`w-0.5 h-6 ${revealed ? 'bg-indigo-400' : 'bg-indigo-600'}`} />
                            </div>
                        </div>

                        {/* Ползунок: точное наведение, работает с клавиатуры и пальцем */}
                        <input
                            type="range"
                            min={question.min}
                            max={question.max}
                            step={step}
                            value={guess}
                            disabled={revealed !== null}
                            onChange={(e) => setGuess(Number(e.target.value))}
                            data-testid="nl-slider"
                            aria-label="Положение числа на прямой"
                            className="mt-4 w-full accent-indigo-600 disabled:opacity-50"
                        />
                        <div className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
                            Твой выбор: <span className="font-medium text-gray-900 dark:text-white">{formatValue(guess)}</span>
                        </div>
                    </div>

                    {/* Разбор раунда */}
                    {revealed ? (
                        <div data-testid="nl-result" className={`mt-6 p-4 rounded-2xl border ${GRADE_CLASS[revealed.grade]}`}>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {GRADE_TEXT[revealed.grade]} — {question.label} стоит на {formatValue(question.value)}
                            </div>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                {revealed.error === 0
                                    ? 'Точно в точку.'
                                    : `Промах на ${formatValue(Math.round(revealed.error * 100) / 100)} — ${revealed.guess < question.value ? 'левее' : 'правее'}, чем нужно.`}
                            </p>
                            <button
                                type="button"
                                onClick={next}
                                data-testid="nl-next"
                                className="mt-3 h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                            >
                                {index + 1 >= questions.length ? 'Итоги' : 'Дальше'}
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={submit}
                            data-testid="nl-submit"
                            className="mt-6 w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                        >
                            Поставить
                        </button>
                    )}
                </>
            ) : (
                /* Итоги захода */
                <div data-testid="nl-summary" className="mt-4 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5">
                    <div className="text-amber-500 text-xl">
                        {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                        Точно в цель: {exacts} из {results.length}
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        Средний промах — {metric} сотых деления. {metric === 0 ? 'Идеально.' : 'Чем меньше, тем лучше.'}
                    </p>
                    {isRecord && (
                        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">Личный рекорд точности.</p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                        {hasNextLevel && (
                            <button
                                type="button"
                                onClick={() => onNextLevel?.()}
                                data-testid="nl-next-level"
                                className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                            >
                                Следующий уровень
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={restart}
                            className="h-11 px-5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-indigo-400 transition-colors"
                        >
                            Ещё заход
                        </button>
                        <button
                            type="button"
                            onClick={() => onExit?.(true)}
                            className="h-11 px-5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-indigo-400 transition-colors"
                        >
                            К уровням
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NumberLineGame;
