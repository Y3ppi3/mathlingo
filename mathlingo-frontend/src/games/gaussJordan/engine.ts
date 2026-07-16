// src/games/gaussJordan/engine.ts
//
// Ядро игры «Побег Гаусса-Жордана» (Фаза 1): расширенная матрица [A|I] и три
// элементарные операции над строками. Цель игрока — превратить левый блок в
// единичную матрицу; тогда в правом блоке сама собой оказывается A⁻¹.
//
// Операции ЧИСТЫЕ и ИММУТАБЕЛЬНЫЕ — каждая возвращает новую доску, не трогая
// исходную. Это нужно для Undo/Reset в UI (Фаза 2): историю ходов можно
// хранить как список досок, ничего не клонируя вручную. Дроби mathjs сами по
// себе иммутабельны (операции возвращают новый объект), поэтому строки можно
// переиспользовать по ссылке — мы копируем только массивы-контейнеры.
//
// Никаких импортов React/DOM.
import { Frac, fr, frAdd, frEquals, frIsZero, frMul } from './fraction';

export type Row = Frac[]; // длина 2n: [A-часть | I-часть]

export interface Board {
    size: number; // n — порядок матрицы
    rows: Row[];  // n строк по 2n дробей
}

const assertRowIndex = (board: Board, i: number, label: string): void => {
    if (!Number.isInteger(i) || i < 0 || i >= board.size) {
        throw new RangeError(`${label}: строка ${i} вне диапазона 0..${board.size - 1}`);
    }
};

/**
 * Строит расширенную матрицу [A | I] из квадратной числовой матрицы.
 * Бросает исключение, если матрица не квадратная (валидацию вырожденности
 * см. в solver.ts — здесь только форма).
 */
export const buildAugmented = (matrix: number[][]): Board => {
    const n = matrix.length;
    if (n === 0) throw new Error('Пустая матрица');
    for (const row of matrix) {
        if (row.length !== n) throw new Error('Матрица должна быть квадратной');
    }

    const rows: Row[] = matrix.map((row, i) => {
        const left = row.map((value) => fr(value));
        const right = Array.from({ length: n }, (_, j) => fr(i === j ? 1 : 0));
        return [...left, ...right];
    });

    return { size: n, rows };
};

/** Левый n×n блок (текущее состояние A). */
export const leftBlock = (board: Board): Frac[][] =>
    board.rows.map((row) => row.slice(0, board.size));

/** Правый n×n блок — это A⁻¹, когда доска решена. */
export const rightBlock = (board: Board): Frac[][] =>
    board.rows.map((row) => row.slice(board.size));

/**
 * Какие столбцы левого блока уже «закрыты» — совпадают с соответствующим
 * столбцом единичной матрицы (1 в строке j, 0 в остальных). Возвращает
 * массив длины n. Используется UI для видимого прогресса и подсветки
 * защёлкнувшихся столбцов (гольф-«сок»).
 */
export const solvedColumns = (board: Board): boolean[] => {
    const n = board.size;
    const result: boolean[] = [];
    for (let j = 0; j < n; j++) {
        let ok = true;
        for (let i = 0; i < n; i++) {
            const cell = board.rows[i][j];
            if (!(i === j ? frEquals(cell, fr(1)) : frIsZero(cell))) {
                ok = false;
                break;
            }
        }
        result.push(ok);
    }
    return result;
};

/** Доска решена, если левый блок — единичная матрица. */
export const isSolved = (board: Board): boolean => {
    const n = board.size;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const cell = board.rows[i][j];
            const expected = i === j ? frEquals(cell, fr(1)) : frIsZero(cell);
            if (!expected) return false;
        }
    }
    return true;
};

/**
 * Операция «Умножить»: строка i умножается на ненулевой множитель.
 * Нулевой множитель запрещён — он необратим (уничтожает информацию строки) и
 * не является элементарным преобразованием.
 */
export const scaleRow = (board: Board, i: number, factor: Frac): Board => {
    assertRowIndex(board, i, 'scaleRow');
    if (frIsZero(factor)) {
        throw new Error('scaleRow: множитель не может быть нулём');
    }
    const rows = board.rows.map((row, idx) =>
        idx === i ? row.map((cell) => frMul(cell, factor)) : row,
    );
    return { size: board.size, rows };
};

/**
 * Операция «Сложить»: к строке target прибавляется строка source, умноженная
 * на factor (target += factor · source). target и source обязаны различаться —
 * иначе это скрытое масштабирование, а не сложение строк.
 */
export const combineRows = (board: Board, target: number, source: number, factor: Frac): Board => {
    assertRowIndex(board, target, 'combineRows.target');
    assertRowIndex(board, source, 'combineRows.source');
    if (target === source) {
        throw new Error('combineRows: target и source должны различаться');
    }
    const srcRow = board.rows[source];
    const rows = board.rows.map((row, idx) =>
        idx === target ? row.map((cell, j) => frAdd(cell, frMul(srcRow[j], factor))) : row,
    );
    return { size: board.size, rows };
};

/** Операция «Поменять»: меняет местами строки i и j (i === j — no-op). */
export const swapRows = (board: Board, i: number, j: number): Board => {
    assertRowIndex(board, i, 'swapRows.i');
    assertRowIndex(board, j, 'swapRows.j');
    if (i === j) return board;
    const rows = board.rows.slice();
    [rows[i], rows[j]] = [rows[j], rows[i]];
    return { size: board.size, rows };
};
