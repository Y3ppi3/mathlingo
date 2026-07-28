// src/games/speedMath/engine.ts
//
// Ядро «Скоростного счёта» (Ф4, школьный уровень). Спринт на устный счёт:
// задача — три варианта — следующая. Серия верных ответов поднимает множитель,
// ошибка его сбрасывает.
//
// Решение по тону (project_vision_design): ошибка сбрасывает множитель, но НЕ
// отнимает время и не заканчивает забег. Наказание за ошибку временем
// превращает тренажёр в источник тревоги — а считать в уме учатся ровно
// наоборот, спокойно повторяя.
//
// Всё чисто (никакого DOM и таймеров) — таймер живёт в компоненте.

/** Одно задание спринта: что спросить, что верно, что показать вариантами. */
export interface SpeedTask {
    id: string;
    prompt: string;
    answer: number;
    options: number[];
}

/** Очки за один верный ответ до умножения на комбо. */
export const BASE_POINTS = 100;

/**
 * Множитель за серию. Пороги растянуты: первые пара верных ответов ещё не
 * награда, зато длинная серия ощутимо разгоняет счёт — это и есть крючок.
 */
export const multiplierFor = (streak: number): number => {
    if (streak >= 8) return 5;
    if (streak >= 5) return 3;
    if (streak >= 3) return 2;
    return 1;
};

/**
 * Очки за верный ответ. streak — длина серии ДО этого ответа, поэтому третий
 * подряд верный ответ уже идёт с ×2.
 */
export const pointsFor = (streak: number): number => BASE_POINTS * multiplierFor(streak + 1);

/** Звёзды за забег. Ниже одной не опускаемся: забег всё равно состоялся. */
export const starsForScore = (score: number, target: number): 1 | 2 | 3 => {
    if (target <= 0) return 3;
    if (score >= target) return 3;
    if (score >= target / 2) return 2;
    return 1;
};

/** Итог забега. */
export interface RunState {
    score: number;
    streak: number;
    bestStreak: number;
    correct: number;
    wrong: number;
}

export const emptyRun = (): RunState => ({ score: 0, streak: 0, bestStreak: 0, correct: 0, wrong: 0 });

/**
 * Применяет ответ к состоянию забега. Возвращает новое состояние — состояние
 * не мутируется, чтобы забег разбирался тестами по шагам.
 */
export const applyAnswer = (run: RunState, correct: boolean): RunState => {
    if (!correct) {
        // Множитель сбрасывается, время — нет.
        return { ...run, streak: 0, wrong: run.wrong + 1 };
    }
    const streak = run.streak + 1;
    return {
        score: run.score + pointsFor(run.streak),
        streak,
        bestStreak: Math.max(run.bestStreak, streak),
        correct: run.correct + 1,
        wrong: run.wrong,
    };
};
