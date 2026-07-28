// src/games/speedMath/levels.ts
//
// Четыре блока «Скоростного счёта» — по школьной лесенке устного счёта:
// таблица умножения → проценты → степени → приёмы сокращённого умножения
// (51·49 считается в уме через a²−b², если этот приём вообще знаешь).
//
// Задания генерируются детерминированно от seed блока: набор всегда один и тот
// же, поэтому рекорды сравнимы между заходами, а тесты не гадают.
import { mulberry32, pick, randInt, shuffle } from '../rng';
import { type SpeedTask } from './engine';

export interface SpeedMathLevel {
    level_id: string;
    title: string;
    hint: string;
    difficulty: number;
    seed: number;
    durationSec: number;
    target: number; // счёт, с которого дают три звезды
}

export const SPEED_MATH_LEVELS: SpeedMathLevel[] = [
    { level_id: 'sm-1', title: 'Таблица умножения', hint: 'От 2 до 9', difficulty: 1, seed: 5001, durationSec: 60, target: 2000 },
    { level_id: 'sm-2', title: 'Проценты', hint: '10%, 20%, 25%, 50%', difficulty: 2, seed: 6002, durationSec: 60, target: 1800 },
    { level_id: 'sm-3', title: 'Степени', hint: 'Квадраты и двойки', difficulty: 3, seed: 7003, durationSec: 60, target: 1600 },
    { level_id: 'sm-4', title: 'Хитрое умножение', hint: '51 · 49 — в уме', difficulty: 4, seed: 8004, durationSec: 60, target: 1400 },
];

/** Сколько заданий готовим на забег. С запасом: за минуту столько не решить. */
const POOL_SIZE = 40;

/**
 * Три варианта: верный и два правдоподобных. Отвлекающие берём рядом с ответом
 * — вариант «наугад» не должен отсеиваться на глаз, иначе это не счёт, а
 * угадайка. Дубли исключаем: два одинаковых варианта выглядят как баг.
 */
const makeOptions = (rng: () => number, answer: number, deltas: number[]): number[] => {
    const options = new Set<number>([answer]);
    let guard = 0;
    while (options.size < 3 && guard < 50) {
        guard++;
        const delta = pick(rng, deltas);
        const candidate = answer + (randInt(rng, 0, 1) === 0 ? -delta : delta);
        if (candidate > 0 && candidate !== answer) options.add(candidate);
    }
    // Крайний случай (маленький ответ, все соседи заняты) — добиваем сдвигом.
    let extra = 1;
    while (options.size < 3) {
        options.add(answer + extra);
        extra++;
    }
    return shuffle(rng, [...options]);
};

const timesTable = (rng: () => number, index: number): SpeedTask => {
    const a = randInt(rng, 2, 9);
    const b = randInt(rng, 2, 9);
    const answer = a * b;
    // Типичные ошибки — соседний столбик таблицы, то есть ±a и ±b.
    return { id: `sm-1-${index}`, prompt: `${a} · ${b}`, answer, options: makeOptions(rng, answer, [a, b, 2]) };
};

const percents = (rng: () => number, index: number): SpeedTask => {
    const pct = pick(rng, [10, 20, 25, 50]);
    // Числа кратны 20 — процент всегда целый, счёт остаётся устным.
    const base = randInt(rng, 1, 25) * 20;
    const answer = (base * pct) / 100;
    // Сдвиги обязаны быть целыми: дробный вариант рядом с целыми виден на глаз
    // и превращает выбор в отгадывание. base кратно 20, так что оба деления точны.
    return {
        id: `sm-2-${index}`, prompt: `${pct}% от ${base}`, answer,
        options: makeOptions(rng, answer, [10, base / 10, base / 20]),
    };
};

const powers = (rng: () => number, index: number): SpeedTask => {
    if (randInt(rng, 0, 1) === 0) {
        const a = randInt(rng, 2, 15);
        const answer = a * a;
        return { id: `sm-3-${index}`, prompt: `${a}²`, answer, options: makeOptions(rng, answer, [a, 2 * a, 1]) };
    }
    const n = randInt(rng, 2, 8);
    const answer = 2 ** n;
    return { id: `sm-3-${index}`, prompt: `2^${n}`, answer, options: makeOptions(rng, answer, [answer / 2, 2, n]) };
};

const tricky = (rng: () => number, index: number): SpeedTask => {
    // (a−b)(a+b) = a² − b²: 51 · 49 = 50² − 1² = 2499. Весь блок про этот приём.
    const a = pick(rng, [20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const b = randInt(rng, 1, 3);
    const answer = a * a - b * b;
    return {
        id: `sm-4-${index}`, prompt: `${a + b} · ${a - b}`, answer,
        options: makeOptions(rng, answer, [b * b, 2 * a, 100]),
    };
};

const GENERATORS: Record<string, (rng: () => number, index: number) => SpeedTask> = {
    'sm-1': timesTable,
    'sm-2': percents,
    'sm-3': powers,
    'sm-4': tricky,
};

/** Набор заданий блока. Один и тот же при каждом заходе — это намеренно. */
export const generateTasks = (level: SpeedMathLevel): SpeedTask[] => {
    const make = GENERATORS[level.level_id];
    if (!make) throw new Error(`Нет генератора для уровня ${level.level_id}`);
    const rng = mulberry32(level.seed);
    return Array.from({ length: POOL_SIZE }, (_, i) => make(rng, i));
};

export const getLevelById = (levelId: string): SpeedMathLevel | undefined =>
    SPEED_MATH_LEVELS.find((l) => l.level_id === levelId);
