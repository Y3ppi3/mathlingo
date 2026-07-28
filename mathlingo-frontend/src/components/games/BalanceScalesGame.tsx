// src/components/games/BalanceScalesGame.tsx
//
// UI игры «Уравнение-весы» (Ф4, школьный уровень). Один уровень — одно
// уравнение на весах: игрок выбирает операцию, она применяется сразу к обеим
// чашам, и так пока слева не останется голый x.
//
// Ключевое решение по тону (project_vision_design): промах — не наказание.
// Сломать равновесие нельзя в принципе (операция всегда идёт на обе чаши), а
// бесполезный ход весы «качает» и откатывает, объясняя словами, почему он не
// помог. Ученик не может загнать себя в тупик — только потратить звезду.
//
// Крючок — гольф без промахов: пройти лесенку из 5 уравнений, ни разу не ткнув
// мимо и не открыв подсказку. Вводный экран «как играть» — сразу, как в
// остальных играх.
//
// Вся математика — в чистом движке src/games/balanceScales. Компонент не ходит
// в API сам: телеметрию/прогресс дёргает страница через onMove/onComplete.
import { useMemo, useRef, useState } from 'react';
import { type EqState, type Op, applyOp, formatSide, isSolved, opKey, opLabel, solvedValue } from '../../games/balanceScales/engine';
import { candidateOps, hintOp, isProgress, starsForSolve } from '../../games/balanceScales/solver';

export interface BalanceLevelProp {
    level_id: string;
    title: string;
    difficulty: number;
    start: EqState;
    par: number;
    answer: number;
}

export interface BalanceScalesGameProps {
    level: BalanceLevelProp;
    bestStars?: number;
    bestMetric?: number | null; // прошлый рекорд по числу промахов
    hasNextLevel?: boolean;
    onMove?: (op: Op, helpful: boolean) => void;
    onHint?: () => void;
    onComplete?: (result: { mistakes: number; hints: number; stars: 1 | 2 | 3; timeMs: number }) => void;
    onExit?: (solved: boolean) => void;
    onNextLevel?: () => void;
}

// Показываем вводный экран один раз за сессию, а не на каждый уровень.
let introSeenThisSession = false;

/** Почему ход не помог — словами, а не «неверно». */
const explainUseless = (op: Op): string => {
    if (op.kind === 'div') return 'Поделить можно, но сейчас это только запутает: сначала убери с чаши лишнее число.';
    if (op.term === 'x') return 'Иксы так не соберёшь: убирать нужно тот x-член, который мешает, — с другой чаши.';
    return 'Равновесие цело, но ближе к ответу не стало: это число не мешает иксу.';
};

const Pan = ({ text, tipped }: { text: string; tipped: boolean }) => (
    <div className="flex-1 min-w-0">
        <div
            className={`flex items-center justify-center h-20 px-3 rounded-2xl border-2 text-xl font-semibold text-gray-900 dark:text-white transition-transform duration-300 ${
                tipped ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/5' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
            }`}
        >
            <span className="truncate">{text}</span>
        </div>
    </div>
);

const BalanceScalesGame = ({
    level, bestStars, bestMetric, hasNextLevel, onMove, onHint, onComplete, onExit, onNextLevel,
}: BalanceScalesGameProps) => {
    const [state, setState] = useState<EqState>(level.start);
    const [history, setHistory] = useState<Op[]>([]);
    const [mistakes, setMistakes] = useState(0);
    const [hints, setHints] = useState(0);
    const [wobble, setWobble] = useState<{ op: Op; why: string } | null>(null);
    const [hinted, setHinted] = useState<string | null>(null);
    const [result, setResult] = useState<{ mistakes: number; hints: number; stars: 1 | 2 | 3 } | null>(null);
    const [showIntro, setShowIntro] = useState(!introSeenThisSession);

    const startRef = useRef<number>(Date.now());

    const ops = useMemo(() => candidateOps(state), [state]);
    const solved = result !== null;

    const closeIntro = () => {
        introSeenThisSession = true;
        setShowIntro(false);
    };

    const play = (op: Op) => {
        if (solved) return;
        const helpful = isProgress(state, op);
        onMove?.(op, helpful);

        if (!helpful) {
            // Весы качнулись: ход законен (равновесие цело), но впустую — откат.
            setMistakes((m) => m + 1);
            setWobble({ op, why: explainUseless(op) });
            return;
        }

        const next = applyOp(state, op)!;
        setWobble(null);
        setHinted(null);
        setState(next);
        setHistory((h) => [...h, op]);

        if (isSolved(next)) {
            const total = mistakes + hints;
            const stars = starsForSolve(total);
            setResult({ mistakes, hints, stars });
            onComplete?.({ mistakes, hints, stars, timeMs: Date.now() - startRef.current });
        }
    };

    const askHint = () => {
        if (solved) return;
        const op = hintOp(state);
        if (!op) return;
        setHints((h) => h + 1);
        setHinted(opKey(op));
        setWobble(null);
        onHint?.();
    };

    const restart = () => {
        setState(level.start);
        setHistory([]);
        setMistakes(0);
        setHints(0);
        setWobble(null);
        setHinted(null);
        setResult(null);
        startRef.current = Date.now();
    };

    const total = mistakes + hints;
    const isRecord = result !== null && (bestMetric === null || bestMetric === undefined || total < bestMetric);

    return (
        <div className="max-w-xl mx-auto">
            {/* Вводный экран «как играть» */}
            {showIntro && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
                    <div className="max-w-sm w-full p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Как играть</h3>
                        <div className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-300">
                            <p><span className="font-medium text-gray-900 dark:text-white">⚖️ Идея:</span> уравнение — это весы в равновесии. Что делаешь с одной чашей, то же делай и с другой — тогда равенство сохраняется.</p>
                            <p><span className="font-medium text-gray-900 dark:text-white">🎯 Цель:</span> оставить слева голый <b>x</b>, а справа — число. Это и есть ответ.</p>
                            <p><span className="font-medium text-gray-900 dark:text-white">🕹 Ход игры:</span></p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Жми операцию — она применится <b>сразу к обеим чашам</b></li>
                                <li>Сначала убирай лишние числа, потом дели на коэффициент</li>
                                <li>Ход мимо не ломает весы — они качнутся, и ход откатится</li>
                            </ul>
                            <p className="text-gray-500 dark:text-gray-400">Три звезды — пройти без промахов и подсказок.</p>
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
                    onClick={() => onExit?.(solved)}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    ← К уровням
                </button>
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <span>Промахов: <span className="font-semibold text-gray-900 dark:text-white">{total}</span></span>
                    {typeof bestMetric === 'number' && (
                        <span className="text-gray-400 dark:text-gray-500">· рекорд {bestMetric}</span>
                    )}
                    {typeof bestStars === 'number' && bestStars > 0 && (
                        <span className="text-amber-500">{'★'.repeat(bestStars)}</span>
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

            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{level.title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Оставь слева только x. Ходов по-хорошему: {level.par}.
            </p>

            {/* Весы */}
            <div data-testid="scales" className={wobble ? 'animate-pulse' : ''}>
                <div className="flex items-center gap-3">
                    <Pan text={formatSide(state.left)} tipped={wobble !== null} />
                    <div className="shrink-0 text-2xl text-gray-400 dark:text-gray-500">=</div>
                    <Pan text={formatSide(state.right)} tipped={wobble !== null} />
                </div>
                <div className="mt-2 flex items-center justify-center">
                    <div className={`h-1 w-2/3 rounded-full transition-colors ${wobble ? 'bg-amber-300 dark:bg-amber-500/50' : 'bg-gray-200 dark:bg-gray-700'}`} />
                </div>
                <div className="text-center text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {wobble ? 'весы качнулись — ход не засчитан' : 'в равновесии'}
                </div>
            </div>

            {/* Палитра ходов */}
            {!solved && (
                <>
                    <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">Что сделаем с обеими чашами?</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {ops.map((op) => {
                            const key = opKey(op);
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => play(op)}
                                    data-testid={`op-${key}`}
                                    className={`h-12 min-w-[4rem] px-4 rounded-xl border-2 text-base font-semibold transition-colors ${
                                        hinted === key
                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:border-indigo-400 dark:hover:border-indigo-500'
                                    }`}
                                >
                                    {opLabel(op)}
                                </button>
                            );
                        })}
                    </div>

                    {wobble && (
                        <div data-testid="wobble" className="mt-4 p-4 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {opLabel(wobble.op)} — равновесие цело, но ближе не стало
                            </div>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{wobble.why}</p>
                        </div>
                    )}

                    <div className="mt-4 flex items-center gap-4">
                        <button
                            type="button"
                            onClick={askHint}
                            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                            Подсказать ход
                        </button>
                        {history.length > 0 && (
                            <button
                                type="button"
                                onClick={restart}
                                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                            >
                                Начать уровень заново
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* История ходов — видно, что уравнение решалось по шагам */}
            {history.length > 0 && (
                <div className="mt-6 text-xs text-gray-400 dark:text-gray-500">
                    Ходы: {history.map(opLabel).join(' → ')}
                </div>
            )}

            {/* Итог */}
            {result && (
                <div data-testid="solved" className="mt-6 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5">
                    <div className="text-amber-500 text-xl">
                        {'★'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                        x = {solvedValue(state)}
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {total === 0
                            ? 'Ровно по делу — ни одного лишнего хода.'
                            : `Промахов и подсказок: ${total}. Уравнение решено — это главное.`}
                    </p>
                    {isRecord && total === 0 && (
                        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">Личный рекорд.</p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                        {hasNextLevel && (
                            <button
                                type="button"
                                onClick={() => onNextLevel?.()}
                                data-testid="next-level"
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
                            Пройти чище
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

export default BalanceScalesGame;
