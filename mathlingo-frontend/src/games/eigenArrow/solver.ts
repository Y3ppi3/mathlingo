// src/games/eigenArrow/solver.ts
//
// Эталонная «истина» уровня «Стрелка Судьбы» (Фаза 3): аналитически считает
// собственные значения/векторы 2×2, «пар» (опорное число тиков до защёлки) и
// отклоняет уровни, где степенная итерация не сходится к одной линии
// (комплексные корни или |λ1| = |λ2|). Так игрок никогда не упрётся в матрицу
// без «судьбы».
//
// Никаких импортов React/DOM.
import { type Mat2, type Vec2, lineAngleDiffDeg, normalize } from './vector';
import { powerStep } from './engine';

export interface EigenArrowLevel {
    level_id: string;
    title: string;
    difficulty: number;
    matrix: number[][]; // 2×2
    start: number[];    // стартовая стрелка, 2 компоненты
}

export interface EigenInfo {
    dominantValue: number;   // λ с наибольшим модулем
    dominantVector: Vec2;    // единичный собственный вектор для него — «судьба»
    secondValue: number;
    ratio: number;           // |λ2/λ1| ∈ [0,1): чем меньше, тем быстрее сходимость
}

const EPS = 1e-9;

/** Собственный вектор 2×2 для данного λ: ненулевой вектор ядра (A − λI). */
const eigenvectorFor = (A: Mat2, lambda: number): Vec2 => {
    const [[a, b], [c, d]] = A;
    // Строка 1: (a−λ)x + b·y = 0 → вектор [b, λ−a], если b ≠ 0.
    if (Math.abs(b) > EPS) return [b, lambda - a];
    // Иначе строка 2: c·x + (d−λ)y = 0 → [λ−d, c], если c ≠ 0.
    if (Math.abs(c) > EPS) return [lambda - d, c];
    // Диагональная матрица: λ совпадает с a или d — берём соответствующую ось.
    return Math.abs(lambda - a) < Math.abs(lambda - d) ? [1, 0] : [0, 1];
};

/**
 * Разбирает 2×2: собственные значения через характеристическое уравнение
 * λ² − tr·λ + det = 0. Возвращает null, если сходимости к линии нет:
 * комплексные корни (disc < 0), кратный корень (disc = 0) или равные модули.
 */
export const analyzeMatrix = (A: Mat2): EigenInfo | null => {
    const [[a, b], [c, d]] = A;
    const tr = a + d;
    const det = a * d - b * c;
    const disc = tr * tr - 4 * det;
    if (disc <= EPS) return null; // комплексные или кратные — нет единственной судьбы
    const s = Math.sqrt(disc);
    const l1 = (tr + s) / 2;
    const l2 = (tr - s) / 2;
    let dom = l1;
    let sec = l2;
    if (Math.abs(l2) > Math.abs(l1)) {
        dom = l2;
        sec = l1;
    }
    const ratio = Math.abs(sec) / Math.abs(dom);
    if (ratio >= 1 - EPS) return null; // |λ1| ≈ |λ2| — доминанты нет
    return {
        dominantValue: dom,
        dominantVector: normalize(eigenvectorFor(A, dom)),
        secondValue: sec,
        ratio,
    };
};

/**
 * «Пар» уровня: сколько тиков нужно, чтобы стрелка подошла к судьбе ближе,
 * чем tolDeg, стартуя с v0. Ограничено maxTicks, чтобы медленная сходимость
 * (ratio → 1) не зациклила расчёт.
 */
export const parTicks = (A: Mat2, v0: Vec2, tolDeg = 3, maxTicks = 40): number => {
    const info = analyzeMatrix(A);
    if (!info) return maxTicks;
    let v = normalize(v0);
    for (let i = 0; i <= maxTicks; i++) {
        if (lineAngleDiffDeg(v, info.dominantVector) <= tolDeg) return i;
        v = powerStep(A, v);
    }
    return maxTicks;
};

/** Ошибка прогноза игрока: угол между его прицелом и истинной судьбой, [0, 90]. */
export const predictionErrorDeg = (A: Mat2, guess: Vec2): number => {
    const info = analyzeMatrix(A);
    if (!info) return 90;
    return lineAngleDiffDeg(guess, info.dominantVector);
};

export interface LevelValidation {
    valid: boolean;
    reason?: string;
    par?: number;
}

/**
 * Проверяет уровень при загрузке: матрица 2×2 с доминирующим вещественным
 * собственным значением, а стартовая стрелка реально сходится к судьбе за
 * разумное число тиков (не совпадает со «вторым» собственным вектором).
 */
export const validateLevel = (level: EigenArrowLevel): LevelValidation => {
    const m = level.matrix;
    if (!Array.isArray(m) || m.length !== 2 || m.some((r) => !Array.isArray(r) || r.length !== 2)) {
        return { valid: false, reason: 'Матрица должна быть 2×2' };
    }
    if (!Array.isArray(level.start) || level.start.length !== 2) {
        return { valid: false, reason: 'Стартовая стрелка должна иметь 2 компоненты' };
    }
    const A = m as unknown as Mat2;
    const info = analyzeMatrix(A);
    if (!info) {
        return { valid: false, reason: 'Нет доминирующего вещественного собственного вектора' };
    }
    if (level.start[0] === 0 && level.start[1] === 0) {
        return { valid: false, reason: 'Стартовая стрелка не может быть нулевой' };
    }
    const par = parTicks(A, level.start as unknown as Vec2);
    if (par >= 40) {
        return { valid: false, reason: 'Старт не сходится к судьбе (совпадает со вторым собственным вектором?)' };
    }
    return { valid: true, par };
};

/**
 * Звёзды за заход. Главное — точность прогноза (насколько верно предсказал
 * судьбу), бонус — уложиться по числу тиков в пар (гольф-крючок).
 * Пороги вынесены сюда, чтобы балансировать в одном месте.
 */
export const starsForPrediction = (errorDeg: number, ticksUsed: number, par: number): 1 | 2 | 3 => {
    const accurate = errorDeg <= 5;
    const close = errorDeg <= 15;
    if (accurate && ticksUsed <= par) return 3;
    if (close && ticksUsed <= Math.ceil(par * 1.5)) return 2;
    return 1;
};
