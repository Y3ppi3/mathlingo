import { describe, it, expect } from 'vitest';
import { BALANCE_LEVELS, getLevelById } from './levels';
import { applyOp, isSolved, solvedValue } from './engine';
import { candidateOps, isProgress, parMoves, validateLevel } from './solver';

describe('BALANCE_LEVELS', () => {
    it('все 5 уровней валидны и имеют положительный конечный пар', () => {
        expect(BALANCE_LEVELS).toHaveLength(5);
        for (const lvl of BALANCE_LEVELS) {
            expect(validateLevel(lvl).valid).toBe(true);
            expect(lvl.par).toBeGreaterThan(0);
            expect(lvl.par).toBeLessThan(6);
        }
    });

    it('каждый уровень реально проходится за пар ходов, если каждый раз брать полезный ход', () => {
        for (const lvl of BALANCE_LEVELS) {
            let state = lvl.start;
            let moves = 0;
            while (!isSolved(state) && moves < 10) {
                const op = candidateOps(state).find((o) => isProgress(state, o));
                expect(op, `${lvl.level_id}: нет полезного хода`).toBeDefined();
                state = applyOp(state, op!)!;
                moves++;
            }
            expect(isSolved(state), `${lvl.level_id} не решился`).toBe(true);
            expect(moves).toBe(lvl.par);
            expect(solvedValue(state)).toBe(lvl.answer);
        }
    });

    it('подписанный ответ совпадает с корнем уравнения', () => {
        // Ответы вынесены в уровень для итогового экрана — они не должны
        // разъезжаться с тем, что реально получается на весах.
        expect(BALANCE_LEVELS.map((l) => l.answer)).toEqual([5, 5, 4, 5, -5]);
    });

    it('сложность растёт от 1 к 5', () => {
        const diffs = BALANCE_LEVELS.map((l) => l.difficulty);
        expect(diffs).toEqual([...diffs].sort((a, b) => a - b));
    });

    it('пар не убывает по ходу лесенки — уровни идут от простого к длинному', () => {
        const pars = BALANCE_LEVELS.map((l) => l.par);
        expect(pars).toEqual([...pars].sort((a, b) => a - b));
    });

    it('на каждом старте есть из чего выбрать: полезный ход не единственный вариант', () => {
        for (const lvl of BALANCE_LEVELS) {
            expect(candidateOps(lvl.start).length, lvl.level_id).toBeGreaterThan(1);
        }
    });

    it('пар уровня совпадает с расчётом солвера', () => {
        for (const lvl of BALANCE_LEVELS) {
            expect(parMoves(lvl.start)).toBe(lvl.par);
        }
    });

    it('getLevelById находит уровень и возвращает undefined для неизвестного', () => {
        expect(getLevelById('bs-4')?.title).toBe('x с обеих сторон');
        expect(getLevelById('нет-такого')).toBeUndefined();
    });
});
