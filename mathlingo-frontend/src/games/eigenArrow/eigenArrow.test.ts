import { describe, it, expect } from 'vitest';
import {
    type Mat2, type Vec2,
    angleDeg, lineAngleDiffDeg, matVec, normalize, vecFromAngle,
} from './vector';
import { hasConverged, iterate, powerStep, stepChangeDeg } from './engine';
import {
    analyzeMatrix, parTicks, predictionErrorDeg, starsForPrediction, validateLevel,
} from './solver';

// Утилита: сходятся ли направления как линии (с точностью до знака) в пределах eps°.
const sameLine = (a: Vec2, b: Vec2, epsDeg = 0.5) => lineAngleDiffDeg(a, b) <= epsDeg;

describe('векторные примитивы', () => {
    it('matVec считает A·v', () => {
        expect(matVec([[2, 0], [0, 3]], [1, 1])).toEqual([2, 3]);
    });

    it('normalize даёт единичную длину, нулевой вектор — ошибка', () => {
        const u = normalize([3, 4]);
        expect(Math.hypot(u[0], u[1])).toBeCloseTo(1);
        expect(() => normalize([0, 0])).toThrow(/нулевой/);
    });

    it('lineAngleDiffDeg считает v и −v одним направлением (линия, не луч)', () => {
        expect(lineAngleDiffDeg([1, 0], [-1, 0])).toBeCloseTo(0);
        expect(lineAngleDiffDeg([1, 0], [0, 1])).toBeCloseTo(90);
        expect(lineAngleDiffDeg([1, 0], [1, 1])).toBeCloseTo(45);
    });

    it('vecFromAngle и angleDeg — взаимно обратные', () => {
        expect(angleDeg(vecFromAngle(30))).toBeCloseTo(30);
    });
});

describe('степенная итерация', () => {
    it('powerStep нормирует результат A·v', () => {
        const v = powerStep([[2, 0], [0, 1]], [1, 1]);
        expect(Math.hypot(v[0], v[1])).toBeCloseTo(1);
    });

    it('iterate возвращает ticks+1 направлений, включая старт', () => {
        const path = iterate([[2, 0], [0, 1]], [1, 1], 5);
        expect(path).toHaveLength(6);
        expect(sameLine(path[0], [1, 1])).toBe(true);
    });

    it('стрелка сходится к главному собственному вектору', () => {
        // A=[[2,0],[0,1]] тянет всё к оси X ([1,0]).
        const path = iterate([[2, 0], [0, 1]], [1, 1], 30);
        expect(sameLine(path[path.length - 1], [1, 0])).toBe(true);
    });

    it('поворот за тик убывает по мере сходимости', () => {
        const A: Mat2 = [[2, 0], [0, 1]];
        const early = stepChangeDeg(A, normalize([1, 1]));
        const late = stepChangeDeg(A, iterate(A, [1, 1], 10)[10]);
        expect(late).toBeLessThan(early);
    });

    it('hasConverged истинно у собственного вектора и ложно вдали', () => {
        const A: Mat2 = [[2, 0], [0, 1]];
        expect(hasConverged(A, [1, 0], 1)).toBe(true);   // уже судьба
        expect(hasConverged(A, [1, 1], 1)).toBe(false);  // ещё крутится
    });

    it('отрицательное число тиков — ошибка', () => {
        expect(() => iterate([[2, 0], [0, 1]], [1, 1], -1)).toThrow(RangeError);
    });
});

describe('analyzeMatrix', () => {
    it('симметричная [[2,1],[1,2]]: судьба по диагонали, λ=3 доминирует', () => {
        const info = analyzeMatrix([[2, 1], [1, 2]])!;
        expect(info).not.toBeNull();
        expect(info.dominantValue).toBeCloseTo(3);
        expect(sameLine(info.dominantVector, [1, 1])).toBe(true);
        expect(info.ratio).toBeCloseTo(1 / 3);
    });

    it('верхнетреугольная [[2,3],[0,4]]: судьба косая [3,2]', () => {
        const info = analyzeMatrix([[2, 3], [0, 4]])!;
        expect(info.dominantValue).toBeCloseTo(4);
        expect(sameLine(info.dominantVector, [3, 2])).toBe(true);
    });

    it('отрицательное λ₂: [[0,1],[2,1]] → λ=2 доминирует, судьба [1,2]', () => {
        const info = analyzeMatrix([[0, 1], [2, 1]])!;
        expect(info.dominantValue).toBeCloseTo(2);
        expect(info.secondValue).toBeCloseTo(-1);
        expect(sameLine(info.dominantVector, [1, 2])).toBe(true);
    });

    it('комплексные корни (поворот) → null', () => {
        // [[0,-1],[1,0]] — чистый поворот, собственные значения ±i.
        expect(analyzeMatrix([[0, -1], [1, 0]])).toBeNull();
    });

    it('равные модули |λ₁|=|λ₂| → null (нет доминанты)', () => {
        // [[1,0],[0,-1]]: λ = 1 и −1, модули равны.
        expect(analyzeMatrix([[1, 0], [0, -1]])).toBeNull();
    });
});

describe('parTicks согласован с движком', () => {
    it('пар — это число тиков, за которое стрелка реально подходит к судьбе', () => {
        const A: Mat2 = [[2, 1], [1, 2]];
        const start: Vec2 = [1, 0];
        const par = parTicks(A, start, 3);
        const info = analyzeMatrix(A)!;
        const landed = iterate(A, start, par)[par];
        expect(lineAngleDiffDeg(landed, info.dominantVector)).toBeLessThanOrEqual(3);
    });
});

describe('predictionErrorDeg', () => {
    it('нулевая ошибка при точном прицеле в судьбу', () => {
        expect(predictionErrorDeg([[2, 1], [1, 2]], [1, 1])).toBeCloseTo(0);
    });
    it('90° при прицеле поперёк судьбы', () => {
        expect(predictionErrorDeg([[2, 1], [1, 2]], [1, -1])).toBeCloseTo(90);
    });
});

describe('starsForPrediction (гольф: точность + тики)', () => {
    it('3★ — точный прогноз и уложился в пар', () => {
        expect(starsForPrediction(2, 5, 5)).toBe(3);
    });
    it('2★ — близкий прогноз или перебор тиков', () => {
        expect(starsForPrediction(10, 6, 5)).toBe(2); // близко, но тиков многовато
        expect(starsForPrediction(3, 7, 5)).toBe(2);  // точно, но тиков > пар (в пределах 1.5×)
    });
    it('1★ — мимо', () => {
        expect(starsForPrediction(30, 20, 5)).toBe(1);
    });
});

describe('validateLevel', () => {
    const base = { level_id: 'x', title: 'x', difficulty: 1 };
    it('валидный уровень возвращает пар', () => {
        const v = validateLevel({ ...base, matrix: [[2, 1], [1, 2]], start: [1, 0] });
        expect(v.valid).toBe(true);
        expect(v.par).toBeGreaterThan(0);
    });
    it('отклоняет не-2×2', () => {
        const v = validateLevel({ ...base, matrix: [[1, 2, 3]], start: [1, 0] });
        expect(v.valid).toBe(false);
        expect(v.reason).toMatch(/2×2/);
    });
    it('отклоняет матрицу без доминирующей судьбы (поворот)', () => {
        const v = validateLevel({ ...base, matrix: [[0, -1], [1, 0]], start: [1, 0] });
        expect(v.valid).toBe(false);
    });
    it('отклоняет старт вдоль второго собственного вектора (не сходится)', () => {
        // Для [[2,3],[0,4]] второй собственный вектор — [1,0]; старт вдоль него не сойдётся.
        const v = validateLevel({ ...base, matrix: [[2, 3], [0, 4]], start: [1, 0] });
        expect(v.valid).toBe(false);
    });
});
