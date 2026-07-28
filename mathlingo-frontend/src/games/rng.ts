// src/games/rng.ts
//
// Детерминированный ГПСЧ, общий для игр с генерируемыми заданиями.
//
// Зачем свой, а не Math.random: уровень должен давать один и тот же набор чисел
// при каждом заходе — иначе рекорды между заходами несравнимы (одному достались
// «7·8», другому «2·2»), а тесты пришлось бы писать на «примерно». Одна функция
// вместо зависимости.
//
// mulberry32 — не криптостойкий и для этого не предназначен: только геймплей.

/** Поток чисел из [0, 1) по seed. Один seed — одна и та же последовательность. */
export const mulberry32 = (seed: number): (() => number) => {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/** Случайное целое в [min, max] включительно. */
export const randInt = (rng: () => number, min: number, max: number): number =>
    min + Math.floor(rng() * (max - min + 1));

/** Случайный элемент массива. Пустой массив — это ошибка вызывающего. */
export const pick = <T>(rng: () => number, items: readonly T[]): T => {
    if (items.length === 0) throw new RangeError('pick: пустой массив');
    return items[randInt(rng, 0, items.length - 1)];
};

/** Перемешивание Фишера-Йейтса. Возвращает новый массив, вход не трогает. */
export const shuffle = <T>(rng: () => number, items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = randInt(rng, 0, i);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};
