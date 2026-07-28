import { describe, it, expect } from 'vitest';
import {
    type Question, type RoundResult,
    errorOf, formatValue, gradeRound, judge, metricForRun, starsForRun,
} from './engine';
import { NUMBER_LINE_LEVELS, generateQuestions, getLevelById } from './levels';

const q = (value: number, tick = 1, min = 0, max = 4): Question =>
    ({ id: 'т', label: String(value), value, min, max, tick });

const results = (grades: Array<'exact' | 'close' | 'miss'>): RoundResult[] =>
    grades.map((grade) => ({ question: q(1), guess: 1, error: 0, grade }));

describe('formatValue', () => {
    it('пишет по-русски: запятая и настоящий минус', () => {
        expect(formatValue(1.75)).toBe('1,75');
        expect(formatValue(-2.5)).toBe('−2,5');
        expect(formatValue(3)).toBe('3');
    });
});

describe('errorOf / gradeRound', () => {
    it('точное попадание', () => {
        expect(errorOf(q(1.75), 1.75)).toBe(0);
        expect(gradeRound(q(1.75), 1.75)).toBe('exact');
    });

    it('в пределах десятой доли деления — ещё точно', () => {
        expect(gradeRound(q(1.75), 1.8)).toBe('exact');
    });

    it('в пределах четверти деления — близко', () => {
        expect(gradeRound(q(1.75), 1.9)).toBe('close');
    });

    it('дальше четверти деления — мимо', () => {
        expect(gradeRound(q(1.75), 2.5)).toBe('miss');
    });

    it('точность считается в долях деления, а не в абсолюте', () => {
        // Один и тот же промах 0,2 — «близко» на прямой с делением 1
        // и «мимо» на мелкой прямой с делением 0,5.
        expect(gradeRound(q(2, 1), 2.2)).toBe('close');
        expect(gradeRound(q(2, 0.5), 2.2)).toBe('miss');
    });

    it('judge собирает промах и оценку вместе', () => {
        const r = judge(q(1.75), 2);
        expect(r.error).toBeCloseTo(0.25);
        expect(r.grade).toBe('close');
        expect(r.guess).toBe(2);
    });
});

describe('starsForRun', () => {
    it('без промахов и с большинством точных — три звезды', () => {
        expect(starsForRun(results(['exact', 'exact', 'exact', 'close']))).toBe(3);
    });

    it('без промахов, но точных мало — две звезды', () => {
        expect(starsForRun(results(['close', 'close', 'close', 'exact']))).toBe(2);
    });

    it('один промах — всё ещё две звезды: ошибиться не страшно', () => {
        expect(starsForRun(results(['exact', 'exact', 'exact', 'miss']))).toBe(2);
    });

    it('много промахов — одна звезда, но не ноль', () => {
        expect(starsForRun(results(['miss', 'miss', 'miss', 'exact']))).toBe(1);
    });

    it('пустой заход не роняет расчёт', () => {
        expect(starsForRun([])).toBe(1);
    });
});

describe('metricForRun', () => {
    it('идеальный заход — ноль', () => {
        expect(metricForRun([judge(q(1.75), 1.75), judge(q(2), 2)])).toBe(0);
    });

    it('средний промах считается в сотых деления', () => {
        // Промахи 0,5 и 0,1 при делении 1 → в среднем 0,3 → 30 сотых.
        expect(metricForRun([judge(q(1), 1.5), judge(q(2), 2.1)])).toBe(30);
    });

    it('масштаб прямой учтён: мелкое деление штрафуется сильнее', () => {
        expect(metricForRun([judge(q(2, 0.5), 2.25)])).toBe(50);
        expect(metricForRun([judge(q(2, 1), 2.25)])).toBe(25);
    });

    it('пустой заход — ноль, а не деление на ноль', () => {
        expect(metricForRun([])).toBe(0);
    });
});

describe('NUMBER_LINE_LEVELS', () => {
    it('четыре уровня, сложность растёт', () => {
        expect(NUMBER_LINE_LEVELS).toHaveLength(4);
        const diffs = NUMBER_LINE_LEVELS.map((l) => l.difficulty);
        expect(diffs).toEqual([...diffs].sort((a, b) => a - b));
    });

    it('getLevelById находит уровень и возвращает undefined для неизвестного', () => {
        expect(getLevelById('nl-3')?.title).toBe('Отрицательные');
        expect(getLevelById('нет-такого')).toBeUndefined();
    });
});

describe('generateQuestions', () => {
    it('набор детерминирован: два вызова дают одно и то же', () => {
        for (const level of NUMBER_LINE_LEVELS) {
            expect(generateQuestions(level)).toEqual(generateQuestions(level));
        }
    });

    it('на каждом уровне ровно столько вопросов, сколько раундов', () => {
        for (const level of NUMBER_LINE_LEVELS) {
            expect(generateQuestions(level)).toHaveLength(level.rounds);
        }
    });

    it('каждое значение попадает внутрь своей прямой', () => {
        for (const level of NUMBER_LINE_LEVELS) {
            for (const question of generateQuestions(level)) {
                expect(question.value).toBeGreaterThanOrEqual(question.min);
                expect(question.value).toBeLessThanOrEqual(question.max);
            }
        }
    });

    it('дроби не сокращаемы и не целые', () => {
        for (const question of generateQuestions(NUMBER_LINE_LEVELS[0])) {
            const [n, d] = question.label.split('/').map(Number);
            expect(d).toBeGreaterThan(1);
            expect(n % d).not.toBe(0);           // не целое
            expect(question.value).toBeCloseTo(n / d);
            // Несократимая: НОД(n, d) = 1.
            const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
            expect(gcd(n, d)).toBe(1);
        }
    });

    it('десятичные не круглые — 3,0 не тренирует ничего', () => {
        for (const question of generateQuestions(NUMBER_LINE_LEVELS[1])) {
            expect(Number.isInteger(question.value)).toBe(false);
        }
    });

    it('в блоке отрицательных есть числа по обе стороны нуля и нет самого нуля', () => {
        const values = generateQuestions(NUMBER_LINE_LEVELS[2]).map((q) => q.value);
        expect(values).not.toContain(0);
        expect(values.some((v) => v < 0)).toBe(true);
    });

    it('смешанный блок и правда перемешивает записи: есть и дроби, и десятичные', () => {
        const labels = generateQuestions(NUMBER_LINE_LEVELS[3]).map((q) => q.label);
        expect(labels.some((l) => l.includes('/'))).toBe(true);
        expect(labels.some((l) => l.includes(','))).toBe(true);
    });

    it('подпись всегда соответствует значению', () => {
        // Иначе игрок целится в одно число, а засчитывается другое.
        for (const question of generateQuestions(NUMBER_LINE_LEVELS[3])) {
            const label = question.label.replace('−', '-');
            let expected: number;
            if (label.includes('/')) {
                const [wholePart, fracPart] = label.includes(' ') ? label.split(' ') : ['0', label];
                const [n, d] = fracPart.split('/').map(Number);
                const whole = Number(wholePart);
                const magnitude = Math.abs(whole) + n / d;
                expected = wholePart.startsWith('-') ? -magnitude : magnitude;
            } else {
                expected = Number(label.replace(',', '.'));
            }
            expect(expected).toBeCloseTo(question.value);
        }
    });

    it('неизвестный уровень падает громко, а не отдаёт пустой набор', () => {
        expect(() => generateQuestions({
            level_id: 'нет', title: 'т', hint: 'т', difficulty: 1, seed: 1, rounds: 3,
        })).toThrow();
    });
});
