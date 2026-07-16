import { describe, it, expect } from 'vitest';
import { fr, frAdd, frMul, frDiv, frEquals, frFormat, frIsZero, type Frac } from './fraction';
import {
    buildAugmented, combineRows, isSolved, rightBlock, scaleRow, solvedColumns, swapRows,
} from './engine';
import { solve, validateLevel, starsForMoves } from './solver';

const fmt = (rows: Frac[][]): string[][] => rows.map((r) => r.map(frFormat));

describe('fraction wrapper', () => {
    it('складывает и умножает точно, без float', () => {
        expect(frFormat(frAdd(fr(1, 2), fr(1, 3)))).toBe('5/6');
        expect(frFormat(frMul(fr(2, 3), fr(3, 4)))).toBe('1/2'); // сокращается
        expect(frFormat(frDiv(fr(1), fr(3)))).toBe('1/3');
    });

    it('форматирует целые и отрицательные дроби', () => {
        expect(frFormat(fr(5))).toBe('5');
        expect(frFormat(fr(-7, 4))).toBe('-7/4');
    });

    it('сравнивает по сокращённой форме', () => {
        expect(frEquals(fr(2, 4), fr(1, 2))).toBe(true);
        expect(frIsZero(fr(0, 5))).toBe(true);
    });
});

describe('buildAugmented', () => {
    it('строит [A | I]', () => {
        const board = buildAugmented([[2, 1], [1, 1]]);
        expect(board.size).toBe(2);
        expect(fmt(board.rows)).toEqual([
            ['2', '1', '1', '0'],
            ['1', '1', '0', '1'],
        ]);
    });

    it('отклоняет неквадратную матрицу', () => {
        expect(() => buildAugmented([[1, 2, 3], [4, 5, 6]])).toThrow(/квадратной/);
    });
});

describe('элементарные операции', () => {
    it('scaleRow умножает строку и не трогает исходную доску (иммутабельность)', () => {
        const board = buildAugmented([[3, 0], [0, 1]]);
        const next = scaleRow(board, 0, fr(1, 3));
        expect(fmt(next.rows)[0]).toEqual(['1', '0', '1/3', '0']);
        // исходная доска не изменилась
        expect(fmt(board.rows)[0]).toEqual(['3', '0', '1', '0']);
    });

    it('scaleRow запрещает нулевой множитель', () => {
        const board = buildAugmented([[1, 0], [0, 1]]);
        expect(() => scaleRow(board, 0, fr(0))).toThrow(/нулём/);
    });

    it('combineRows считает target += factor·source точно на дробях', () => {
        const board = buildAugmented([[2, 1], [1, 1]]);
        // row1 += (-1/2)·row0
        const next = combineRows(board, 1, 0, fr(-1, 2));
        expect(fmt(next.rows)[1]).toEqual(['0', '1/2', '-1/2', '1']);
    });

    it('combineRows запрещает target === source', () => {
        const board = buildAugmented([[1, 0], [0, 1]]);
        expect(() => combineRows(board, 0, 0, fr(2))).toThrow(/различаться/);
    });

    it('swapRows меняет строки местами', () => {
        const board = buildAugmented([[1, 2], [3, 4]]);
        const next = swapRows(board, 0, 1);
        expect(fmt(next.rows)).toEqual([
            ['3', '4', '0', '1'],
            ['1', '2', '1', '0'],
        ]);
    });

    it('операции с индексом вне диапазона бросают исключение', () => {
        const board = buildAugmented([[1, 0], [0, 1]]);
        expect(() => scaleRow(board, 5, fr(2))).toThrow(RangeError);
    });
});

describe('isSolved', () => {
    it('true, когда левый блок — единичная матрица', () => {
        expect(isSolved(buildAugmented([[1, 0], [0, 1]]))).toBe(true);
    });
    it('false для не-единичного левого блока', () => {
        expect(isSolved(buildAugmented([[2, 1], [1, 1]]))).toBe(false);
    });
});

describe('solvedColumns', () => {
    it('отмечает закрытые столбцы левого блока', () => {
        // Левый блок [[1,5],[0,1]] — столбец 0 закрыт (1/0), столбец 1 нет (5≠0).
        const board = buildAugmented([[1, 5], [0, 1]]);
        expect(solvedColumns(board)).toEqual([true, false]);
    });
    it('на единичной матрице все столбцы закрыты', () => {
        expect(solvedColumns(buildAugmented([[1, 0], [0, 1]]))).toEqual([true, true]);
    });
    it('нулевой ведущий элемент — столбец не закрыт', () => {
        expect(solvedColumns(buildAugmented([[0, 1], [1, 0]]))).toEqual([false, false]);
    });
});

describe('прохождение уровня руками даёт обратную матрицу', () => {
    it('[[2,1],[1,1]] -> A⁻¹ = [[1,-1],[-1,2]]', () => {
        let board = buildAugmented([[2, 1], [1, 1]]);
        board = scaleRow(board, 0, fr(1, 2));
        board = combineRows(board, 1, 0, fr(-1));
        board = scaleRow(board, 1, fr(2));
        board = combineRows(board, 0, 1, fr(-1, 2));
        expect(isSolved(board)).toBe(true);
        expect(fmt(rightBlock(board))).toEqual([
            ['1', '-1'],
            ['-1', '2'],
        ]);
    });
});

describe('solver', () => {
    it('находит обратную и пар для 2×2', () => {
        const result = solve([[2, 1], [1, 1]]);
        expect(result).not.toBeNull();
        expect(fmt(result!.inverse)).toEqual([
            ['1', '-1'],
            ['-1', '2'],
        ]);
        expect(result!.par).toBeGreaterThan(0);
    });

    it('обратная с дробями точна: [[1,2],[3,4]] -> [[-2,1],[3/2,-1/2]]', () => {
        const result = solve([[1, 2], [3, 4]]);
        expect(fmt(result!.inverse)).toEqual([
            ['-2', '1'],
            ['3/2', '-1/2'],
        ]);
    });

    it('ops солвера реально приводят доску к решённому виду', () => {
        const matrix = [[0, 1, 1], [1, 0, 1], [1, 1, 0]];
        const result = solve(matrix)!;
        let board = buildAugmented(matrix);
        for (const op of result.ops) {
            if (op.kind === 'swap') board = swapRows(board, op.i, op.j);
            else if (op.kind === 'scale') board = scaleRow(board, op.row, op.factor);
            else board = combineRows(board, op.target, op.source, op.factor);
        }
        expect(isSolved(board)).toBe(true);
        expect(fmt(rightBlock(board))).toEqual(fmt(result.inverse));
    });

    it('вырожденная матрица (det=0) -> null', () => {
        expect(solve([[1, 2], [2, 4]])).toBeNull();
    });

    it('уровень, где нужна перестановка строк (нулевой ведущий элемент)', () => {
        // Первый ведущий элемент 0 -> солвер обязан сделать swap, иначе бы упал.
        const result = solve([[0, 1], [1, 0]]);
        expect(result).not.toBeNull();
        expect(fmt(result!.inverse)).toEqual([
            ['0', '1'],
            ['1', '0'],
        ]);
    });
});

describe('validateLevel', () => {
    const base = { level_id: 'x', title: 'x', difficulty: 1 };

    it('валидный уровень возвращает пар', () => {
        const v = validateLevel({ ...base, matrix: [[2, 1], [1, 1]] });
        expect(v.valid).toBe(true);
        expect(v.par).toBeGreaterThan(0);
    });

    it('отклоняет вырожденную матрицу', () => {
        const v = validateLevel({ ...base, matrix: [[1, 2], [2, 4]] });
        expect(v.valid).toBe(false);
        expect(v.reason).toMatch(/вырожден/);
    });

    it('отклоняет неквадратную матрицу', () => {
        const v = validateLevel({ ...base, matrix: [[1, 2, 3], [4, 5, 6]] });
        expect(v.valid).toBe(false);
        expect(v.reason).toMatch(/квадратной/);
    });
});

describe('starsForMoves', () => {
    it('3 звезды за укладывание в пар, 2 за полтора пара, иначе 1', () => {
        expect(starsForMoves(4, 4)).toBe(3);
        expect(starsForMoves(3, 4)).toBe(3);
        expect(starsForMoves(6, 4)).toBe(2); // ceil(4*1.5)=6
        expect(starsForMoves(7, 4)).toBe(1);
    });
});
