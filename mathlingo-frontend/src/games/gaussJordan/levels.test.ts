import { describe, it, expect } from 'vitest';
import { GAUSS_JORDAN_LEVELS, getLevelById } from './levels';
import { solve, validateLevel } from './solver';

describe('уровни Гаусса-Жордана', () => {
    it('все 5 уровней валидны, невырождены и имеют положительный пар', () => {
        expect(GAUSS_JORDAN_LEVELS).toHaveLength(5);
        for (const level of GAUSS_JORDAN_LEVELS) {
            const v = validateLevel(level);
            expect(v.valid, `${level.level_id}: ${v.reason}`).toBe(true);
            expect(level.par).toBeGreaterThan(0);
            expect(solve(level.matrix)).not.toBeNull();
        }
    });

    it('прогрессия сложности не убывает, от 2×2 к 3×3', () => {
        const sizes = GAUSS_JORDAN_LEVELS.map((l) => l.matrix.length);
        expect(sizes[0]).toBe(2);
        expect(sizes[sizes.length - 1]).toBe(3);
        for (let i = 1; i < GAUSS_JORDAN_LEVELS.length; i++) {
            expect(GAUSS_JORDAN_LEVELS[i].difficulty).toBeGreaterThanOrEqual(GAUSS_JORDAN_LEVELS[i - 1].difficulty);
        }
    });

    it('getLevelById находит уровень и возвращает undefined для неизвестного', () => {
        expect(getLevelById('gj-1')?.title).toBeDefined();
        expect(getLevelById('nope')).toBeUndefined();
    });
});
