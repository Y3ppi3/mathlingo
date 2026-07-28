import { describe, it, expect } from 'vitest';
import {
    type EqState, type Op,
    applyOp, formatSide, formatState, isSolved, opLabel, solvedValue,
} from './engine';
import { candidateOps, hintOp, isProgress, parMoves, solutionOf, starsForSolve, validateLevel } from './solver';

// 3x + 4 = 19  (x = 5) — рабочая лошадка тестов.
const eq = (lx: number, lc: number, rx: number, rc: number): EqState => ({
    left: { x: lx, c: lc },
    right: { x: rx, c: rc },
});

describe('applyOp', () => {
    it('применяет операцию к обеим чашам сразу', () => {
        const next = applyOp(eq(3, 4, 0, 19), { kind: 'sub', term: 'const', n: 4 });
        expect(next).toEqual(eq(3, 0, 0, 15));
    });

    it('вычитание x-члена гасит x на обеих чашах', () => {
        const next = applyOp(eq(4, 3, 1, 18), { kind: 'sub', term: 'x', n: 1 });
        expect(next).toEqual(eq(3, 3, 0, 18));
    });

    it('деление делит все четыре числа', () => {
        expect(applyOp(eq(3, 0, 0, 15), { kind: 'div', n: 3 })).toEqual(eq(1, 0, 0, 5));
    });

    it('запрещает деление, уводящее в дроби', () => {
        // 3x + 4 = 19 ÷ 3 дало бы 4/3 — на школьном уровне такого хода нет.
        expect(applyOp(eq(3, 4, 0, 19), { kind: 'div', n: 3 })).toBeNull();
    });

    it('запрещает деление на ноль и пустое деление на единицу', () => {
        expect(applyOp(eq(3, 0, 0, 15), { kind: 'div', n: 0 })).toBeNull();
        expect(applyOp(eq(3, 0, 0, 15), { kind: 'div', n: 1 })).toBeNull();
    });

    it('деление на отрицательный коэффициент разрешено: −x = 5 → x = −5', () => {
        expect(applyOp(eq(-1, 0, 0, 5), { kind: 'div', n: -1 })).toEqual(eq(1, 0, 0, -5));
    });

    it('не мутирует исходное состояние', () => {
        const state = eq(3, 4, 0, 19);
        applyOp(state, { kind: 'sub', term: 'const', n: 4 });
        expect(state).toEqual(eq(3, 4, 0, 19));
    });
});

describe('isSolved / solvedValue', () => {
    it('x = 5 — решено', () => {
        expect(isSolved(eq(1, 0, 0, 5))).toBe(true);
        expect(solvedValue(eq(1, 0, 0, 5))).toBe(5);
    });

    it('5 = x — тоже решено, x может остаться справа', () => {
        expect(isSolved(eq(0, 5, 1, 0))).toBe(true);
        expect(solvedValue(eq(0, 5, 1, 0))).toBe(5);
    });

    it('3x = 15 ещё не решено — коэффициент не убран', () => {
        expect(isSolved(eq(3, 0, 0, 15))).toBe(false);
        expect(solvedValue(eq(3, 0, 0, 15))).toBeNull();
    });

    it('x + 7 = 12 не решено — на чаше с x есть лишнее число', () => {
        expect(isSolved(eq(1, 7, 0, 12))).toBe(false);
    });
});

describe('formatSide / formatState', () => {
    it('записывает чашу по-школьному', () => {
        expect(formatSide({ x: 3, c: 4 })).toBe('3x + 4');
        expect(formatSide({ x: 5, c: -8 })).toBe('5x − 8');
        expect(formatSide({ x: 0, c: 19 })).toBe('19');
        expect(formatSide({ x: 3, c: 0 })).toBe('3x');
    });

    it('единичный коэффициент не пишет «1x»', () => {
        expect(formatSide({ x: 1, c: 0 })).toBe('x');
        expect(formatSide({ x: -1, c: 0 })).toBe('−x');
    });

    it('собирает уравнение целиком', () => {
        expect(formatState(eq(3, 4, 0, 19))).toBe('3x + 4 = 19');
    });
});

describe('opLabel', () => {
    it('подписывает ходы так, как их читает ученик', () => {
        expect(opLabel({ kind: 'sub', term: 'const', n: 4 })).toBe('−4');
        expect(opLabel({ kind: 'add', term: 'const', n: 8 })).toBe('+8');
        expect(opLabel({ kind: 'sub', term: 'x', n: 1 })).toBe('−1x');
        expect(opLabel({ kind: 'div', n: 3 })).toBe('÷3');
    });
});

describe('candidateOps', () => {
    it('предлагает ходы, гасящие константу, и не предлагает дробящее деление', () => {
        const ops = candidateOps(eq(3, 4, 0, 19));
        const labels = ops.map(opLabel);
        expect(labels).toContain('−4');   // погасить 4 слева — верный ход
        expect(labels).toContain('−19');  // погасить 19 справа — законный, но бесполезный
        expect(labels).not.toContain('÷3'); // ушло бы в 4/3
    });

    it('после снятия константы деление появляется', () => {
        expect(candidateOps(eq(3, 0, 0, 15)).map(opLabel)).toContain('÷3');
    });

    it('на минус отвечает прибавлением: 5x − 8 = 12', () => {
        expect(candidateOps(eq(5, -8, 0, 12)).map(opLabel)).toContain('+8');
    });

    it('не выдаёт дублей', () => {
        // Обе чаши по 4 — «−4» не должно появиться дважды.
        const labels = candidateOps(eq(2, 4, 0, 4)).map(opLabel);
        expect(labels.length).toBe(new Set(labels).size);
    });

    it('каждый предложенный ход применим', () => {
        const state = eq(4, 3, 1, 18);
        for (const op of candidateOps(state)) {
            expect(applyOp(state, op)).not.toBeNull();
        }
    });
});

describe('parMoves', () => {
    it('решённые весы — ноль ходов', () => {
        expect(parMoves(eq(1, 0, 0, 5))).toBe(0);
    });

    it('x + 7 = 12 решается одним ходом', () => {
        expect(parMoves(eq(1, 7, 0, 12))).toBe(1);
    });

    it('3x + 4 = 19 решается двумя ходами', () => {
        expect(parMoves(eq(3, 4, 0, 19))).toBe(2);
    });

    it('4x + 3 = x + 18 решается тремя ходами', () => {
        expect(parMoves(eq(4, 3, 1, 18))).toBe(3);
    });
});

describe('isProgress', () => {
    const state = eq(3, 4, 0, 19);

    it('снятие своей константы приближает к ответу', () => {
        expect(isProgress(state, { kind: 'sub', term: 'const', n: 4 })).toBe(true);
    });

    it('снятие константы не с той чаши — ход впустую, но весы целы', () => {
        const op: Op = { kind: 'sub', term: 'const', n: 19 };
        expect(applyOp(state, op)).not.toBeNull(); // равновесие не нарушено
        expect(isProgress(state, op)).toBe(false); // но ближе не стало
    });

    it('неприменимый ход прогрессом не считается', () => {
        expect(isProgress(state, { kind: 'div', n: 3 })).toBe(false);
    });
});

describe('hintOp', () => {
    it('подсказывает ход, который действительно приближает к ответу', () => {
        const state = eq(4, 3, 1, 18);
        const hint = hintOp(state)!;
        expect(hint).not.toBeNull();
        expect(isProgress(state, hint)).toBe(true);
    });

    it('на решённых весах подсказывать нечего', () => {
        expect(hintOp(eq(1, 0, 0, 5))).toBeNull();
    });
});

describe('starsForSolve', () => {
    it('чистое прохождение — три звезды', () => {
        expect(starsForSolve(0)).toBe(3);
    });

    it('пара промахов ещё оставляет две звезды — ошибаться не страшно', () => {
        expect(starsForSolve(1)).toBe(2);
        expect(starsForSolve(2)).toBe(2);
    });

    it('дальше звёзды не падают ниже одной: уровень всё равно пройден', () => {
        expect(starsForSolve(3)).toBe(1);
        expect(starsForSolve(99)).toBe(1);
    });
});

describe('solutionOf', () => {
    it('находит корень', () => {
        expect(solutionOf(eq(3, 4, 0, 19))).toBe(5);
        expect(solutionOf(eq(3, 14, 1, 4))).toBe(-5);
    });

    it('возвращает null, когда корень не единственный', () => {
        expect(solutionOf(eq(2, 1, 2, 9))).toBeNull(); // 2x+1 = 2x+9 — корней нет
    });
});

describe('validateLevel', () => {
    const level = (start: EqState) => ({ level_id: 'т', title: 'т', difficulty: 1, start });

    it('пропускает нормальное уравнение', () => {
        expect(validateLevel(level(eq(3, 4, 0, 19))).valid).toBe(true);
    });

    it('отклоняет дробный корень', () => {
        expect(validateLevel(level(eq(2, 0, 0, 5))).valid).toBe(false); // x = 2.5
    });

    it('отклоняет уравнение без единственного корня', () => {
        expect(validateLevel(level(eq(2, 1, 2, 9))).valid).toBe(false);
    });

    it('отклоняет уже решённое уравнение', () => {
        expect(validateLevel(level(eq(1, 0, 0, 5))).valid).toBe(false);
    });
});
