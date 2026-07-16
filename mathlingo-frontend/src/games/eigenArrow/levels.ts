// src/games/eigenArrow/levels.ts
//
// Пять уровней «Стрелки Судьбы» (Фаза 3) с нарастающей хитростью прогноза:
// от очевидной оси роста до косой судьбы, «качелей» (λ₂ < 0 — стрелка
// перекидывается через ноль) и медленной сходимости (ratio → 1). Пар каждого
// уровня считает солвер — не хардкодим, чтобы он не разошёлся с движком.
//
// В Фазах 3–4 это локальный источник; позже (гибрид) уровни переедут в
// опубликованный GameScenario и будут приходить с бэкенда.
import { type Mat2, type Vec2 } from './vector';
import { parTicks, validateLevel, type EigenArrowLevel } from './solver';

interface LevelWithPar extends EigenArrowLevel {
    par: number;
}

const RAW_LEVELS: EigenArrowLevel[] = [
    // Ось роста очевидна: всё сплющивается к горизонтали.
    { level_id: 'ea-1', title: 'Ось роста', difficulty: 1, matrix: [[2, 0], [0, 1]], start: [1, 1] },
    // Симметрия → судьба ровно по диагонали 45°.
    { level_id: 'ea-2', title: 'Диагональ судьбы', difficulty: 2, matrix: [[2, 1], [1, 2]], start: [1, 0] },
    // Судьба косая (≈34°) — не угадаешь на глаз, надо считать.
    { level_id: 'ea-3', title: 'Косая судьба', difficulty: 3, matrix: [[2, 3], [0, 4]], start: [0, 1] },
    // λ₂ < 0: стрелка «качается» через ноль, сходясь к ≈63°.
    { level_id: 'ea-4', title: 'Качели', difficulty: 4, matrix: [[0, 1], [2, 1]], start: [1, 0] },
    // ratio ≈ 0.82: терпеливая судьба, сходится медленно, тиков много.
    { level_id: 'ea-5', title: 'Терпеливая судьба', difficulty: 5, matrix: [[10, 1], [1, 10]], start: [1, 0] },
];

// Валидируем и считаем пар на старте: если уровень внезапно окажется без
// доминирующей судьбы (правка матрицы), падаем громко, а не даём игроку
// стрелку, которая никуда не сходится.
export const EIGEN_ARROW_LEVELS: LevelWithPar[] = RAW_LEVELS.map((level) => {
    const validation = validateLevel(level);
    if (!validation.valid) {
        throw new Error(`Некорректный уровень ${level.level_id}: ${validation.reason}`);
    }
    return { ...level, par: parTicks(level.matrix as unknown as Mat2, level.start as unknown as Vec2) };
});

export const getLevelById = (levelId: string): LevelWithPar | undefined =>
    EIGEN_ARROW_LEVELS.find((l) => l.level_id === levelId);
