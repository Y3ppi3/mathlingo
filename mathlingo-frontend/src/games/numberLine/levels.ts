// src/games/numberLine/levels.ts
//
// Четыре блока «Числовой прямой» — по нарастанию того, что именно сбивает
// школьника: сначала дроби (7/4 — это между 1 и 2), потом десятичные, потом
// минус (−2,5 левее −2, а не правее), и напоследок смешанный блок, где рядом
// стоят 1½ и 1,4 и надо понять, какое левее.
//
// Числа генерируются детерминированно от seed уровня: набор всегда один и тот
// же, поэтому рекорды сравнимы между заходами, а тесты не гадают.
import { mulberry32, randInt } from '../rng';
import { type Question, formatValue } from './engine';

export interface NumberLineLevel {
    level_id: string;
    title: string;
    hint: string;
    difficulty: number;
    seed: number;
    rounds: number;
}

export const NUMBER_LINE_LEVELS: NumberLineLevel[] = [
    { level_id: 'nl-1', title: 'Дроби', hint: 'Где живёт 7/4?', difficulty: 1, seed: 1001, rounds: 8 },
    { level_id: 'nl-2', title: 'Десятичные', hint: 'Запятая — не помеха', difficulty: 2, seed: 2002, rounds: 8 },
    { level_id: 'nl-3', title: 'Отрицательные', hint: 'Слева от нуля всё наоборот', difficulty: 3, seed: 3003, rounds: 8 },
    { level_id: 'nl-4', title: 'Вперемешку', hint: 'Что левее: 1½ или 1,4?', difficulty: 4, seed: 4004, rounds: 8 },
];

/** Несократимая дробь num/den — иначе 2/4 выглядит как отдельное число, хотя это 1/2. */
const reduce = (num: number, den: number): [number, number] => {
    const g = (a: number, b: number): number => (b === 0 ? a : g(b, a % b));
    const d = g(Math.abs(num), den);
    return [num / d, den / d];
};

const fractionQuestion = (rng: () => number, index: number): Question => {
    const den = [2, 3, 4][randInt(rng, 0, 2)];
    // Целые числа не берём: 8/4 — это не про чувство величины, а про деление.
    let num = randInt(rng, 1, 4 * den - 1);
    if (num % den === 0) num += 1;
    const [n, d] = reduce(num, den);
    return { id: `nl-1-${index}`, label: `${n}/${d}`, value: num / den, min: 0, max: 4, tick: 1 };
};

const decimalQuestion = (rng: () => number, index: number): Question => {
    // Десятые, но не круглые: 3,0 не тренирует ничего.
    let tenths = randInt(rng, 1, 99);
    if (tenths % 10 === 0) tenths += 1;
    return {
        id: `nl-2-${index}`, label: formatValue(tenths / 10),
        value: tenths / 10, min: 0, max: 10, tick: 1,
    };
};

const negativeQuestion = (rng: () => number, index: number): Question => {
    // Половинки от −5 до 5, ноль пропускаем — он не спорный.
    let half = randInt(rng, -10, 10);
    if (half === 0) half = -1;
    return {
        id: `nl-3-${index}`, label: formatValue(half / 2),
        value: half / 2, min: -5, max: 5, tick: 1,
    };
};

const mixedQuestion = (rng: () => number, index: number): Question => {
    const quarters = [1, 2, 3][randInt(rng, 0, 2)]; // 1/4, 1/2, 3/4
    const whole = randInt(rng, 0, 2);
    const sign = randInt(rng, 0, 1) === 0 ? -1 : 1;
    const value = sign * (whole + quarters / 4);

    // Одно и то же число то дробью, то десятичным — в этом весь блок:
    // «1½ или 1,4 — что левее» читается только если записи перемешаны.
    const asFraction = randInt(rng, 0, 1) === 0;
    let label: string;
    if (asFraction) {
        const [n, d] = reduce(quarters, 4);
        const body = whole === 0 ? `${n}/${d}` : `${whole} ${n}/${d}`;
        label = sign < 0 ? `−${body}` : body;
    } else {
        label = formatValue(value);
    }
    return { id: `nl-4-${index}`, label, value, min: -3, max: 3, tick: 1 };
};

const GENERATORS: Record<string, (rng: () => number, index: number) => Question> = {
    'nl-1': fractionQuestion,
    'nl-2': decimalQuestion,
    'nl-3': negativeQuestion,
    'nl-4': mixedQuestion,
};

/** Набор вопросов уровня. Один и тот же при каждом заходе — это намеренно. */
export const generateQuestions = (level: NumberLineLevel): Question[] => {
    const make = GENERATORS[level.level_id];
    if (!make) throw new Error(`Нет генератора для уровня ${level.level_id}`);
    const rng = mulberry32(level.seed);
    return Array.from({ length: level.rounds }, (_, i) => make(rng, i));
};

export const getLevelById = (levelId: string): NumberLineLevel | undefined =>
    NUMBER_LINE_LEVELS.find((l) => l.level_id === levelId);
