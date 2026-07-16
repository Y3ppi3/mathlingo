// src/games/eigenArrow/engine.ts
//
// Ядро степенной итерации для «Стрелки Судьбы» (Фаза 3). Один «тик» = умножить
// текущее направление на A и снова нормировать. При повторении направление
// сходится к главному собственному вектору («стрелке судьбы») — это и есть
// геймплей: игрок смотрит, как стрелка защёлкивается на своей судьбе.
//
// Всё иммутабельно и чисто (никакого DOM), чтобы движок тестировался отдельно
// от UI, как в игре A.
import { type Mat2, type Vec2, lineAngleDiffDeg, matVec, normalize } from './vector';

/** Один тик степенной итерации: направление A·v, снова единичной длины. */
export const powerStep = (A: Mat2, v: Vec2): Vec2 => normalize(matVec(A, v));

/**
 * Траектория из `ticks` тиков, начиная с нормированного v0. Возвращает
 * ticks+1 направлений (включая старт) — удобно для анимации стрелки.
 */
export const iterate = (A: Mat2, v0: Vec2, ticks: number): Vec2[] => {
    if (ticks < 0) throw new RangeError('Число тиков не может быть отрицательным');
    let v = normalize(v0);
    const out: Vec2[] = [v];
    for (let i = 0; i < ticks; i++) {
        v = powerStep(A, v);
        out.push(v);
    }
    return out;
};

/** На сколько градусов повернётся стрелка за следующий тик (как линия, [0, 90]). */
export const stepChangeDeg = (A: Mat2, v: Vec2): number =>
    lineAngleDiffDeg(v, powerStep(A, v));

/**
 * Стрелка «защёлкнулась», если следующий тик почти не меняет направление
 * (поворот ≤ tolDeg). Это визуальный сигнал сходимости для игрока.
 */
export const hasConverged = (A: Mat2, v: Vec2, tolDeg: number): boolean =>
    stepChangeDeg(A, v) <= tolDeg;
