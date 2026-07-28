// src/games/balanceScales/levels.ts
//
// Пять уровней «Уравнения-весов» — ровно та лесенка, по которой линейные
// уравнения идут в школе: сначала один ход, потом «сначала убрать, потом
// поделить», затем минус на чаше, x с обеих сторон и, наконец, ответ в минусе
// (место, где ученик чаще всего теряет знак).
//
// Пар и корень считает солвер, а не рука: иначе при правке уровня подпись
// разойдётся с движком.
import { parMoves, solutionOf, validateLevel, type BalanceLevel } from './solver';

interface LevelWithPar extends BalanceLevel {
    par: number;
    answer: number;
}

const RAW_LEVELS: BalanceLevel[] = [
    // Один ход: снять семёрку с обеих чаш.
    { level_id: 'bs-1', title: 'Первое равновесие', difficulty: 1, start: { left: { x: 1, c: 7 }, right: { x: 0, c: 12 } } },
    // Порядок действий: сначала убрать число, потом делить.
    { level_id: 'bs-2', title: 'Убрать, потом поделить', difficulty: 2, start: { left: { x: 3, c: 4 }, right: { x: 0, c: 19 } } },
    // Минус на чаше: гасится прибавлением, а не вычитанием.
    { level_id: 'bs-3', title: 'Минус на чаше', difficulty: 3, start: { left: { x: 5, c: -8 }, right: { x: 0, c: 12 } } },
    // x с обеих сторон — иксы надо сначала собрать в одном месте.
    { level_id: 'bs-4', title: 'x с обеих сторон', difficulty: 4, start: { left: { x: 4, c: 3 }, right: { x: 1, c: 18 } } },
    // Ответ уходит в минус: главная ловушка со знаком.
    { level_id: 'bs-5', title: 'Ответ уходит в минус', difficulty: 5, start: { left: { x: 3, c: 14 }, right: { x: 1, c: 4 } } },
];

// Валидируем на старте: уровень с дробным или неединственным корнем — это
// сломанная игра, и узнать об этом лучше сразу, а не на глазах у ученика.
export const BALANCE_LEVELS: LevelWithPar[] = RAW_LEVELS.map((level) => {
    const validation = validateLevel(level);
    if (!validation.valid) {
        throw new Error(`Некорректный уровень ${level.level_id}: ${validation.reason}`);
    }
    return { ...level, par: parMoves(level.start), answer: solutionOf(level.start) as number };
});

export const getLevelById = (levelId: string): LevelWithPar | undefined =>
    BALANCE_LEVELS.find((l) => l.level_id === levelId);
