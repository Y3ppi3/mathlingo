import { describe, it, expect } from 'vitest';
import { mulberry32, pick, randInt, shuffle } from './rng';

describe('mulberry32', () => {
    it('один seed — одна последовательность', () => {
        const a = mulberry32(42);
        const b = mulberry32(42);
        expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    });

    it('разные seed расходятся', () => {
        expect(mulberry32(1)()).not.toBe(mulberry32(2)());
    });

    it('выдаёт числа из [0, 1)', () => {
        const rng = mulberry32(7);
        for (let i = 0; i < 500; i++) {
            const v = rng();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it('не залипает на одном значении', () => {
        const rng = mulberry32(3);
        const seen = new Set(Array.from({ length: 50 }, () => rng()));
        expect(seen.size).toBeGreaterThan(40);
    });
});

describe('randInt', () => {
    it('не выходит за границы и достаёт оба края', () => {
        const rng = mulberry32(5);
        const seen = new Set<number>();
        for (let i = 0; i < 300; i++) {
            const v = randInt(rng, 1, 3);
            expect(v).toBeGreaterThanOrEqual(1);
            expect(v).toBeLessThanOrEqual(3);
            seen.add(v);
        }
        expect(seen).toEqual(new Set([1, 2, 3]));
    });

    it('вырожденный диапазон отдаёт единственное значение', () => {
        expect(randInt(mulberry32(1), 4, 4)).toBe(4);
    });
});

describe('pick', () => {
    it('возвращает элемент массива', () => {
        const rng = mulberry32(9);
        for (let i = 0; i < 50; i++) {
            expect(['а', 'б', 'в']).toContain(pick(rng, ['а', 'б', 'в']));
        }
    });

    it('на пустом массиве падает громко, а не отдаёт undefined', () => {
        expect(() => pick(mulberry32(1), [])).toThrow(RangeError);
    });
});

describe('shuffle', () => {
    it('сохраняет состав и не трогает исходный массив', () => {
        const source = [1, 2, 3, 4, 5];
        const mixed = shuffle(mulberry32(11), source);
        expect([...mixed].sort((a, b) => a - b)).toEqual(source);
        expect(source).toEqual([1, 2, 3, 4, 5]);
    });

    it('и правда перемешивает', () => {
        const source = [1, 2, 3, 4, 5, 6, 7, 8];
        const rng = mulberry32(13);
        const orders = new Set(Array.from({ length: 20 }, () => shuffle(rng, source).join()));
        expect(orders.size).toBeGreaterThan(1);
    });

    it('детерминирован по seed', () => {
        const source = [1, 2, 3, 4, 5];
        expect(shuffle(mulberry32(21), source)).toEqual(shuffle(mulberry32(21), source));
    });
});
