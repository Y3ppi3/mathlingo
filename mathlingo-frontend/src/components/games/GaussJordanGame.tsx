// src/components/games/GaussJordanGame.tsx
//
// UI игры «Побег Гаусса-Жордана» (Фаза 2 + крючок Фазы 2.5). Один уровень:
// игрок элементарными операциями над строками превращает левый блок [A|I] в
// единичную матрицу, после чего в правом блоке проступает A⁻¹.
//
// Крючок — «гольф»: решить как можно короче. Чтобы это ощущалось игрой, а не
// редукцией матрицы, добавлены (а) видимый прогресс — столбцы «защёлкиваются»
// зелёным по мере решения, (б) празднование результата относительно пара и
// личного рекорда, (в) вводный экран «как играть» (fix «непонятно как»).
//
// Вся математика — в чистом движке src/games/gaussJordan. Компонент не ходит
// в API сам: телеметрию/прогресс дёргает страница через onMove/onComplete.
import { useMemo, useRef, useState } from 'react';
import {
    Board, buildAugmented, combineRows, isSolved, rightBlock, scaleRow, solvedColumns, swapRows,
} from '../../games/gaussJordan/engine';
import { fr, frFormat, frIsZero, type Frac } from '../../games/gaussJordan/fraction';
import { starsForMoves } from '../../games/gaussJordan/solver';

export type RowOpType = 'combine' | 'scale' | 'swap';

export interface GaussJordanLevelProp {
    level_id: string;
    title: string;
    matrix: number[][];
    par: number;
}

interface GaussJordanGameProps {
    level: GaussJordanLevelProp;
    bestStars?: number;
    bestMetric?: number | null; // прошлый рекорд по ходам (для «гольфа»)
    hasNextLevel?: boolean;
    onMove?: (opType: RowOpType) => void;
    onComplete?: (result: { moves: number; stars: 1 | 2 | 3; timeMs: number }) => void;
    onExit?: (solved: boolean) => void;
    onNextLevel?: () => void;
}

// Показываем вводный экран один раз за сессию, а не на каждый уровень.
let introSeenThisSession = false;

const QUICK_FACTORS: Array<[number, number]> = [
    [1, 2], [1, 3], [2, 1], [3, 1], [-1, 1], [-1, 2], [-2, 1],
];

const MODE_LABEL: Record<RowOpType, string> = {
    combine: 'Сложить',
    scale: 'Умножить',
    swap: 'Поменять',
};

const rowLabel = (i: number) => `R${i + 1}`;

const GaussJordanGame = ({
    level, bestMetric, hasNextLevel, onMove, onComplete, onExit, onNextLevel,
}: GaussJordanGameProps) => {
    const initialBoard = useMemo(() => buildAugmented(level.matrix), [level.matrix]);
    const n = initialBoard.size;

    const [board, setBoard] = useState<Board>(initialBoard);
    const [history, setHistory] = useState<Board[]>([]);
    const [moves, setMoves] = useState(0);

    const [mode, setMode] = useState<RowOpType | null>(null);
    const [target, setTarget] = useState<number | null>(null);
    const [source, setSource] = useState<number | null>(null);

    const [num, setNum] = useState('');
    const [den, setDen] = useState('');

    const [showIntro, setShowIntro] = useState(!introSeenThisSession);
    const [flash, setFlash] = useState<string | null>(null);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const startRef = useRef<number>(Date.now());
    const completedRef = useRef(false);
    const [solvedResult, setSolvedResult] = useState<{ moves: number; stars: 1 | 2 | 3 } | null>(null);

    const solved = solvedColumns(board);
    const solvedCount = solved.filter(Boolean).length;

    const dismissIntro = () => {
        introSeenThisSession = true;
        setShowIntro(false);
        startRef.current = Date.now(); // не штрафуем время за чтение правил
    };

    const showFlash = (msg: string) => {
        setFlash(msg);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 1100);
    };

    const resetSelection = () => {
        setTarget(null);
        setSource(null);
        setNum('');
        setDen('');
    };

    const pickMode = (m: RowOpType) => {
        setMode((prev) => (prev === m ? null : m));
        resetSelection();
    };

    const applyBoard = (next: Board, opType: RowOpType) => {
        const before = solvedCount;
        setHistory((h) => [...h, board]);
        setBoard(next);
        setMoves((m) => m + 1);
        onMove?.(opType);
        resetSelection();

        const nextSolved = solvedColumns(next);
        const nowSolved = nextSolved.filter(Boolean).length;

        if (isSolved(next) && !completedRef.current) {
            completedRef.current = true;
            const finalMoves = moves + 1;
            const stars = starsForMoves(finalMoves, level.par);
            setSolvedResult({ moves: finalMoves, stars });
            onComplete?.({ moves: finalMoves, stars, timeMs: Date.now() - startRef.current });
        } else if (nowSolved > before) {
            // Защёлкнулся новый столбец — маленькая победа по пути.
            showFlash(nowSolved === 1 ? '✓ Первый столбец закрыт!' : `✓ Столбцов закрыто: ${nowSolved} из ${n}`);
        }
    };

    const buildFactor = (chip?: [number, number]): Frac | null => {
        if (chip) return fr(chip[0], chip[1]);
        const nRaw = num.trim();
        const dRaw = den.trim() === '' ? '1' : den.trim();
        if (!/^-?\d+$/.test(nRaw) || !/^-?\d+$/.test(dRaw)) return null;
        const d = parseInt(dRaw, 10);
        if (d === 0) return null;
        return fr(parseInt(nRaw, 10), d);
    };

    const handleRowTap = (row: number) => {
        if (solvedResult || !mode) return;

        if (mode === 'swap') {
            if (target === null) setTarget(row);
            else if (row !== target) applyBoard(swapRows(board, target, row), 'swap');
            return;
        }

        if (target === null) {
            setTarget(row);
            return;
        }
        if (mode === 'combine' && source === null) {
            if (row === target) return;
            setSource(row);
        }
    };

    const applyWithFactor = (chip?: [number, number]) => {
        if (target === null) return;
        const factor = buildFactor(chip);
        if (factor === null) return;

        if (mode === 'scale') {
            if (frIsZero(factor)) return;
            applyBoard(scaleRow(board, target, factor), 'scale');
        } else if (mode === 'combine' && source !== null) {
            applyBoard(combineRows(board, target, source, factor), 'combine');
        }
    };

    const undo = () => {
        if (history.length === 0 || solvedResult) return;
        const prev = history[history.length - 1];
        setHistory((h) => h.slice(0, -1));
        setBoard(prev);
        setMoves((m) => Math.max(0, m - 1));
        resetSelection();
    };

    const restart = () => {
        setBoard(initialBoard);
        setHistory([]);
        setMoves(0);
        setMode(null);
        resetSelection();
        setSolvedResult(null);
        completedRef.current = false;
        startRef.current = Date.now();
        setFlash(null);
    };

    const needsFactor =
        !solvedResult && mode !== 'swap' && mode !== null && target !== null &&
        (mode === 'scale' || (mode === 'combine' && source !== null));

    const hint = (() => {
        if (solvedResult) return 'Готово!';
        if (!mode) return 'Выберите операцию';
        if (mode === 'swap') {
            return target === null ? 'Выберите первую строку' : 'Выберите вторую строку для обмена';
        }
        if (target === null) return `${MODE_LABEL[mode]}: выберите строку-приёмник`;
        if (mode === 'combine' && source === null) return 'Выберите строку-источник';
        if (mode === 'combine') return `${rowLabel(target)} += k · ${rowLabel(source!)} — задайте k`;
        return `${rowLabel(target)} × k — задайте множитель k`;
    })();

    const cellClass = (rowIdx: number, colIdx: number) => {
        const isRight = colIdx >= n;
        const colSolved = !isRight && solved[colIdx];
        const base = 'flex items-center justify-center h-11 min-w-[3rem] px-2 text-sm font-mono rounded-lg border transition-all';
        let tint: string;
        if (colSolved) {
            tint = 'bg-green-50 dark:bg-green-500/10 border-green-300 dark:border-green-500/40 text-green-700 dark:text-green-300';
        } else if (isRight) {
            tint = 'bg-indigo-50/60 dark:bg-indigo-500/5 border-indigo-100 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300';
        } else {
            tint = 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100';
        }
        const highlight =
            rowIdx === target ? ' ring-2 ring-indigo-400'
                : rowIdx === source ? ' ring-2 ring-amber-400'
                    : '';
        return `${base} ${tint}${highlight}`;
    };

    const rowSelectable = !solvedResult && mode !== null;

    const beatPar = solvedResult && solvedResult.moves <= level.par;
    const newRecord = solvedResult && (bestMetric == null || solvedResult.moves < bestMetric);

    return (
        <div className="max-w-xl mx-auto">
            {/* Вводный экран «как играть» */}
            {showIntro && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
                    <div className="max-w-sm w-full p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Как играть</h3>
                        <div className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-300">
                            <p><span className="font-medium text-gray-900 dark:text-white">🎯 Цель:</span> сделать левый блок единичной матрицей (1 по диагонали, 0 вокруг). Тогда справа сама появится обратная матрица.</p>
                            <p><span className="font-medium text-gray-900 dark:text-white">🕹 Операции над строками:</span></p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><b>Умножить</b> строку на число</li>
                                <li><b>Сложить</b>: к одной строке прибавить другую × число</li>
                                <li><b>Поменять</b> две строки местами</li>
                            </ul>
                            <p><span className="font-medium text-gray-900 dark:text-white">🏁 Гольф:</span> чем меньше ходов, тем больше звёзд. Столбцы загораются зелёным, когда «закрыты».</p>
                            <p className="text-gray-500 dark:text-gray-400">Подсказка: обычно первый ход — сделать верхний-левый элемент единицей.</p>
                        </div>
                        <button
                            type="button"
                            onClick={dismissIntro}
                            className="mt-5 w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                        >
                            Понятно, поехали
                        </button>
                    </div>
                </div>
            )}

            {/* Верхняя панель */}
            <div className="flex items-center justify-between mb-3">
                <button
                    type="button"
                    onClick={() => onExit?.(!!solvedResult)}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    ← К уровням
                </button>
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <span>Ходов: <span className="font-semibold text-gray-900 dark:text-white">{moves}</span></span>
                    <span>·</span>
                    <span>пар {level.par}</span>
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

            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{level.title}</h2>

            {/* Цель + прогресс по столбцам (всегда на виду) */}
            <div className="mb-3 flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                    🎯 Левый блок → единичная матрица. Короче = больше звёзд.
                </span>
                <span className="flex items-center gap-1 shrink-0" aria-label={`Закрыто столбцов: ${solvedCount} из ${n}`}>
                    {solved.map((s, j) => (
                        <span
                            key={j}
                            className={`w-3 h-3 rounded-sm ${s ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'} transition-colors`}
                        />
                    ))}
                </span>
            </div>

            {/* Доска [A | I] */}
            <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                <div className="space-y-2">
                    {board.rows.map((row, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={!rowSelectable}
                                onClick={() => handleRowTap(i)}
                                className={`w-10 h-11 shrink-0 rounded-lg text-sm font-semibold transition-colors ${
                                    rowSelectable
                                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                                } ${i === target ? 'ring-2 ring-indigo-400' : i === source ? 'ring-2 ring-amber-400' : ''}`}
                            >
                                {rowLabel(i)}
                            </button>
                            <div className="flex items-center gap-1.5">
                                {row.map((cell, j) => (
                                    <div key={j} className="flex items-center">
                                        {j === n && <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1.5" aria-hidden="true" />}
                                        <div
                                            className={cellClass(i, j)}
                                            onClick={() => rowSelectable && handleRowTap(i)}
                                        >
                                            {frFormat(cell)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Фидбэк «столбец закрыт» / подсказка шага */}
            {!solvedResult && (
                <div className="mt-4 text-sm text-center min-h-[1.25rem]">
                    {flash
                        ? <span className="text-green-600 dark:text-green-400 font-medium">{flash}</span>
                        : <span className="text-gray-600 dark:text-gray-300">{hint}</span>}
                </div>
            )}

            {/* Пикер множителя */}
            {needsFactor && (
                <div className="mt-3 p-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {QUICK_FACTORS.map(([qn, qd]) => (
                            <button
                                key={`${qn}/${qd}`}
                                type="button"
                                onClick={() => applyWithFactor([qn, qd])}
                                className="px-3 h-10 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-mono text-gray-800 dark:text-gray-100 hover:border-indigo-400 transition-colors"
                            >
                                {qd === 1 ? `${qn}` : `${qn}/${qd}`}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 justify-center mt-3">
                        <input
                            inputMode="numeric"
                            value={num}
                            onChange={(e) => setNum(e.target.value)}
                            placeholder="a"
                            className="w-14 h-10 text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                        <span className="text-gray-400">/</span>
                        <input
                            inputMode="numeric"
                            value={den}
                            onChange={(e) => setDen(e.target.value)}
                            placeholder="b"
                            className="w-14 h-10 text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                        <button
                            type="button"
                            onClick={() => applyWithFactor()}
                            className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                        >
                            Применить
                        </button>
                    </div>
                </div>
            )}

            {/* Панель операций */}
            {!solvedResult && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                    {(['combine', 'scale', 'swap'] as RowOpType[]).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => pickMode(m)}
                            className={`h-11 rounded-xl text-sm font-medium border-2 transition-colors ${
                                mode === m
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                        >
                            {MODE_LABEL[m]}
                        </button>
                    ))}
                </div>
            )}

            {/* Undo / Reset */}
            {!solvedResult && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={undo}
                        disabled={history.length === 0}
                        className="h-10 rounded-xl text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
                    >
                        ↩ Отменить ход
                    </button>
                    <button
                        type="button"
                        onClick={restart}
                        className="h-10 rounded-xl text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        ⟲ Сброс
                    </button>
                </div>
            )}

            {/* Экран победы */}
            {solvedResult && (
                <div className="mt-6 p-6 rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-center">
                    <div className="text-3xl mb-2">{'★'.repeat(solvedResult.stars)}{'☆'.repeat(3 - solvedResult.stars)}</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                        Решено за {solvedResult.moves} {solvedResult.moves === 1 ? 'ход' : 'ходов'}
                    </div>
                    <div className="text-sm mt-1">
                        {beatPar
                            ? <span className="text-green-600 dark:text-green-400 font-medium">🎉 Короче некуда — идеально!</span>
                            : newRecord
                                ? <span className="text-green-600 dark:text-green-400 font-medium">🏆 Новый личный рекорд!</span>
                                : <span className="text-gray-500 dark:text-gray-400">Пар уровня: {level.par}{typeof bestMetric === 'number' ? ` · твой рекорд: ${bestMetric}` : ''}</span>}
                    </div>

                    <div className="mt-4 inline-block text-left">
                        <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Обратная матрица A⁻¹:</div>
                        <div className="space-y-1">
                            {rightBlock(board).map((row, i) => (
                                <div key={i} className="flex gap-1.5">
                                    {row.map((cell, j) => (
                                        <div key={j} className="flex items-center justify-center h-9 min-w-[3rem] px-2 text-sm font-mono rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                                            {frFormat(cell)}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2 justify-center">
                        {!beatPar && (
                            <button
                                type="button"
                                onClick={restart}
                                className="h-11 px-5 rounded-xl bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 text-sm font-medium hover:border-indigo-400 transition-colors"
                            >
                                А можно короче? ↺
                            </button>
                        )}
                        {hasNextLevel && (
                            <button
                                type="button"
                                onClick={() => onNextLevel?.()}
                                className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                            >
                                Следующий уровень →
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => onExit?.(true)}
                            className="h-11 px-5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                        >
                            К уровням
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GaussJordanGame;
