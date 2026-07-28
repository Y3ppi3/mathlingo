// src/games/numberLine/engine.ts
//
// Ядро «Числовой прямой» (Ф4, школьный уровень). Игрок не считает, а ставит
// число в точку на прямой — тренируется чувство величины: где именно живёт 7/4,
// что −2,5 левее −2, и что 1½ правее 1,4. Это то место, где школьная
// арифметика обычно и провисает: считать умеют, а «сколько это» не чувствуют.
//
// Всё иммутабельно и чисто (никакого DOM) — движок тестируется отдельно от UI.

/** Вопрос одного раунда: что показать и куда это на самом деле встаёт. */
export interface Question {
    id: string;
    label: string;  // как число показано игроку: «7/4», «−2,5», «1 1/2»
    value: number;  // где оно на самом деле: 1.75
    min: number;    // левый край прямой
    max: number;    // правый край
    tick: number;   // шаг подписанных делений — от него считается точность
}

/** Насколько раунд удался. Промах — это «мимо деления», а не «неверно». */
export type RoundGrade = 'exact' | 'close' | 'miss';

export interface RoundResult {
    question: Question;
    guess: number;
    error: number;
    grade: RoundGrade;
}

/** Запись числа по-русски: запятая вместо точки, настоящий минус (U+2212). */
export const formatValue = (value: number): string => {
    const text = String(Math.round(value * 1000) / 1000).replace('.', ',');
    return text.replace('-', '−');
};

/** Промах в единицах прямой. */
export const errorOf = (question: Question, guess: number): number =>
    Math.abs(guess - question.value);

/**
 * Оценка раунда — в долях деления, а не в абсолюте: на прямой 0…10 промах в
 * 0,1 и на прямой −1…1 промах в 0,1 — это очень разные промахи.
 */
export const gradeRound = (question: Question, guess: number): RoundGrade => {
    const error = errorOf(question, guess);
    if (error <= question.tick / 10) return 'exact';
    if (error <= question.tick / 4) return 'close';
    return 'miss';
};

export const judge = (question: Question, guess: number): RoundResult => ({
    question,
    guess,
    error: errorOf(question, guess),
    grade: gradeRound(question, guess),
});

/**
 * Звёзды за заход. Тон спокойный: одна звезда — это всё равно «прошёл», а не
 * «провалил», поэтому ниже одной не опускаемся (project_vision_design).
 */
export const starsForRun = (results: RoundResult[]): 1 | 2 | 3 => {
    if (results.length === 0) return 1;
    const misses = results.filter((r) => r.grade === 'miss').length;
    const exacts = results.filter((r) => r.grade === 'exact').length;
    if (misses === 0 && exacts >= Math.ceil(results.length * 0.6)) return 3;
    if (misses <= 1) return 2;
    return 1;
};

/**
 * Метрика рекорда: средний промах в сотых деления (целое, меньше = лучше).
 * Схема прогресса принимает только неотрицательное целое, а «сотые деления»
 * не зависят от масштаба конкретной прямой.
 */
export const metricForRun = (results: RoundResult[]): number => {
    if (results.length === 0) return 0;
    const avgInTicks = results.reduce((sum, r) => sum + r.error / r.question.tick, 0) / results.length;
    return Math.round(avgInTicks * 100);
};
