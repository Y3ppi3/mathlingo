import { describe, it, expect } from 'vitest';
import { EIGEN_ARROW_LEVELS, getLevelById } from './levels';
import { type Mat2, type Vec2, lineAngleDiffDeg } from './vector';
import { analyzeMatrix } from './solver';
import { iterate } from './engine';

describe('EIGEN_ARROW_LEVELS', () => {
    it('все 5 уровней валидны и имеют положительный конечный пар', () => {
        expect(EIGEN_ARROW_LEVELS).toHaveLength(5);
        for (const lvl of EIGEN_ARROW_LEVELS) {
            expect(lvl.par).toBeGreaterThan(0);
            expect(lvl.par).toBeLessThan(40);
        }
    });

    it('в каждом уровне старт реально сходится к судьбе за пар тиков', () => {
        for (const lvl of EIGEN_ARROW_LEVELS) {
            const A = lvl.matrix as unknown as Mat2;
            const start = lvl.start as unknown as Vec2;
            const info = analyzeMatrix(A)!;
            const landed = iterate(A, start, lvl.par)[lvl.par];
            expect(lineAngleDiffDeg(landed, info.dominantVector)).toBeLessThanOrEqual(3);
        }
    });

    it('сложность растёт от 1 к 5', () => {
        const diffs = EIGEN_ARROW_LEVELS.map((l) => l.difficulty);
        expect(diffs).toEqual([...diffs].sort((a, b) => a - b));
    });

    it('getLevelById находит уровень и возвращает undefined для неизвестного', () => {
        expect(getLevelById('ea-2')?.title).toBe('Диагональ судьбы');
        expect(getLevelById('нет-такого')).toBeUndefined();
    });
});
