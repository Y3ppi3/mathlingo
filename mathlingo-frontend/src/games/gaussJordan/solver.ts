// src/games/gaussJordan/solver.ts
//
// Эталонное решение уровня «Побег Гаусса-Жордана» (Фаза 1): детерминированный
// Гаусс-Жордан, который (а) считает «пар» — опорное число ходов, от которого
// начисляются звёзды, и (б) отклоняет вырожденные уровни (det = 0), чтобы
// игрок никогда не упёрся в неразрешимую матрицу (roadmap Фаза 1).
//
// Каждая элементарная операция = один «ход», ровно как у игрока: смена
// ведущей строки, нормировка ведущего элемента к 1 и обнуление каждого
// другого элемента столбца — по одному ходу. Так пар честно сопоставим с
// числом ходов игрока.
//
// Никаких импортов React/DOM.
import { Frac, fr, frDiv, frIsOne, frIsZero, frNeg } from './fraction';
import { Board, buildAugmented, combineRows, rightBlock, scaleRow, swapRows } from './engine';

export interface GaussJordanLevel {
    level_id: string;
    title: string;
    difficulty: number;
    matrix: number[][];
}

export type SolverOp =
    | { kind: 'swap'; i: number; j: number }
    | { kind: 'scale'; row: number; factor: Frac }
    | { kind: 'combine'; target: number; source: number; factor: Frac };

export interface SolveResult {
    par: number;        // число ходов эталонного решения
    inverse: Frac[][];  // A⁻¹
    ops: SolverOp[];    // последовательность ходов (для подсказок/тестов)
}

/**
 * Приводит [A|I] к [I|A⁻¹] каноническим Гауссом-Жорданом, протоколируя ходы.
 * Возвращает null, если матрица вырождена (в столбце не нашлось ненулевого
 * ведущего элемента) — такой уровень неразрешим.
 */
export const solve = (matrix: number[][]): SolveResult | null => {
    let board: Board = buildAugmented(matrix);
    const n = board.size;
    const ops: SolverOp[] = [];

    for (let c = 0; c < n; c++) {
        // Ищем ведущую строку с ненулевым элементом в столбце c, начиная с c.
        let pivot = -1;
        for (let r = c; r < n; r++) {
            if (!frIsZero(board.rows[r][c])) {
                pivot = r;
                break;
            }
        }
        if (pivot === -1) return null; // вырожденная матрица

        if (pivot !== c) {
            board = swapRows(board, c, pivot);
            ops.push({ kind: 'swap', i: c, j: pivot });
        }

        // Нормируем ведущий элемент к 1 (если он уже 1 — хода не тратим).
        const pivotVal = board.rows[c][c];
        if (!frIsOne(pivotVal)) {
            const factor = frDiv(fr(1), pivotVal);
            board = scaleRow(board, c, factor);
            ops.push({ kind: 'scale', row: c, factor });
        }

        // Обнуляем столбец c во всех остальных строках.
        for (let r = 0; r < n; r++) {
            if (r === c) continue;
            const val = board.rows[r][c];
            if (frIsZero(val)) continue; // уже ноль — хода не тратим
            const factor = frNeg(val); // ведущий уже 1, поэтому множитель = -val
            board = combineRows(board, r, c, factor);
            ops.push({ kind: 'combine', target: r, source: c, factor });
        }
    }

    return { par: ops.length, inverse: rightBlock(board), ops };
};

export interface LevelValidation {
    valid: boolean;
    reason?: string;
    par?: number;
}

/**
 * Проверяет уровень при загрузке конфигурации: матрица должна быть квадратной
 * и невырожденной. Возвращает пар для валидного уровня.
 */
export const validateLevel = (level: GaussJordanLevel): LevelValidation => {
    const m = level.matrix;
    if (!Array.isArray(m) || m.length === 0) {
        return { valid: false, reason: 'Матрица пуста' };
    }
    const n = m.length;
    if (m.some((row) => !Array.isArray(row) || row.length !== n)) {
        return { valid: false, reason: 'Матрица должна быть квадратной' };
    }

    let result: SolveResult | null;
    try {
        result = solve(m);
    } catch (err) {
        return { valid: false, reason: err instanceof Error ? err.message : 'Ошибка разбора матрицы' };
    }
    if (result === null) {
        return { valid: false, reason: 'Матрица вырождена (det = 0) — обратной не существует' };
    }
    return { valid: true, par: result.par };
};

/**
 * Звёзды за прохождение относительно пара уровня: 3 — уложился в пар, 2 — не
 * более чем в полтора пара, иначе 1. Пороги — точка баланса; вынесены сюда,
 * чтобы менять их в одном месте.
 */
export const starsForMoves = (moves: number, par: number): 1 | 2 | 3 => {
    if (moves <= par) return 3;
    if (moves <= Math.ceil(par * 1.5)) return 2;
    return 1;
};
