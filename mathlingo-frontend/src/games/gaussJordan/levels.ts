// src/games/gaussJordan/levels.ts
//
// Пять уровней «Побега Гаусса-Жордана», прогрессия 2×2 → 3×3 (Фаза 2). Все
// матрицы невырождены и подобраны с «приятными» целыми входами; часть
// уровней нарочно приводит к дробям по ходу решения, часть требует
// перестановки строк (нулевой ведущий элемент). Пар (опорное число ходов)
// каждого уровня считает солвер — не хардкодим, чтобы он не разошёлся с
// движком при смене алгоритма.
//
// В Фазах 1–4 это локальный источник; позже (гибрид-решение) уровни переедут
// в опубликованный GameScenario и будут приходить с бэкенда.
import { solve, validateLevel, type GaussJordanLevel } from './solver';

interface LevelWithPar extends GaussJordanLevel {
    par: number;
}

const RAW_LEVELS: GaussJordanLevel[] = [
    { level_id: 'gj-1', title: 'Разминка 2×2', difficulty: 1, matrix: [[2, 1], [0, 1]] },
    { level_id: 'gj-2', title: 'Появляются дроби', difficulty: 2, matrix: [[1, 2], [3, 4]] },
    { level_id: 'gj-3', title: 'Чистая обратная', difficulty: 3, matrix: [[2, 3], [1, 2]] },
    { level_id: 'gj-4', title: 'Нужна перестановка', difficulty: 4, matrix: [[0, 1, 1], [1, 0, 1], [1, 1, 0]] },
    { level_id: 'gj-5', title: 'Симметричная 3×3', difficulty: 5, matrix: [[2, 1, 1], [1, 2, 1], [1, 1, 2]] },
];

// Считаем пар и заодно страхуемся: если уровень внезапно окажется вырожденным
// (например, при правке матрицы), падаем громко на старте, а не даём игроку
// упереться в неразрешимый уровень.
export const GAUSS_JORDAN_LEVELS: LevelWithPar[] = RAW_LEVELS.map((level) => {
    const validation = validateLevel(level);
    if (!validation.valid) {
        throw new Error(`Некорректный уровень ${level.level_id}: ${validation.reason}`);
    }
    return { ...level, par: solve(level.matrix)!.par };
});

export const getLevelById = (levelId: string): LevelWithPar | undefined =>
    GAUSS_JORDAN_LEVELS.find((l) => l.level_id === levelId);
