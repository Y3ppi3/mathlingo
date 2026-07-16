// src/games/eigenArrow/vector.ts
//
// Векторные примитивы для игры «Стрелка Судьбы» (Фаза 3). В отличие от игры A
// (точные дроби), здесь всё числовое (float): собственные векторы, как правило,
// иррациональны, а степенная итерация — по природе приближённый процесс.
//
// Важное соглашение: направление стрелки — это ЛИНИЯ, а не луч. Вектор v и −v
// указывают в одну «судьбу», поэтому все сравнения направлений берут модуль
// косинуса и дают угол в диапазоне [0, 90]. Никаких импортов React/DOM.

export type Vec2 = readonly [number, number];
export type Mat2 = readonly [readonly [number, number], readonly [number, number]];

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Произведение матрица·вектор (A·v). */
export const matVec = (A: Mat2, v: Vec2): Vec2 => [
    A[0][0] * v[0] + A[0][1] * v[1],
    A[1][0] * v[0] + A[1][1] * v[1],
];

/** Евклидова длина вектора. */
export const norm = (v: Vec2): number => Math.hypot(v[0], v[1]);

/** Единичный вектор того же направления. Нулевой вектор — ошибка. */
export const normalize = (v: Vec2): Vec2 => {
    const n = norm(v);
    if (n === 0) throw new Error('Нельзя нормировать нулевой вектор');
    return [v[0] / n, v[1] / n];
};

/** Угол вектора в градусах, диапазон (−180, 180]. Для отрисовки стрелки. */
export const angleDeg = (v: Vec2): number => Math.atan2(v[1], v[0]) * DEG;

/** Единичный вектор по углу (для превращения прицела игрока в направление). */
export const vecFromAngle = (deg: number): Vec2 => [Math.cos(deg * RAD), Math.sin(deg * RAD)];

/**
 * Расхождение двух направлений КАК ЛИНИЙ, в градусах [0, 90].
 * Берём модуль косинуса, поэтому v и −v считаются одинаковыми — что и нужно
 * для собственного вектора (его знак/масштаб произвольны).
 */
export const lineAngleDiffDeg = (a: Vec2, b: Vec2): number => {
    const na = normalize(a);
    const nb = normalize(b);
    const dot = Math.min(1, Math.abs(na[0] * nb[0] + na[1] * nb[1]));
    return Math.acos(dot) * DEG;
};
