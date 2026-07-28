import { describe, it, expect } from 'vitest';
import { BASE_POINTS, applyAnswer, emptyRun, multiplierFor, pointsFor, starsForScore } from './engine';
import { SPEED_MATH_LEVELS, generateTasks, getLevelById } from './levels';

describe('multiplierFor', () => {
    it('короткая серия ещё не награда', () => {
        expect(multiplierFor(0)).toBe(1);
        expect(multiplierFor(1)).toBe(1);
        expect(multiplierFor(2)).toBe(1);
    });

    it('множитель растёт ступенями', () => {
        expect(multiplierFor(3)).toBe(2);
        expect(multiplierFor(4)).toBe(2);
        expect(multiplierFor(5)).toBe(3);
        expect(multiplierFor(7)).toBe(3);
        expect(multiplierFor(8)).toBe(5);
        expect(multiplierFor(50)).toBe(5);
    });

    it('никогда не убывает с ростом серии', () => {
        for (let s = 1; s < 30; s++) {
            expect(multiplierFor(s)).toBeGreaterThanOrEqual(multiplierFor(s - 1));
        }
    });
});

describe('pointsFor', () => {
    it('первый верный ответ идёт по базовой цене', () => {
        expect(pointsFor(0)).toBe(BASE_POINTS);
    });

    it('третий подряд верный ответ уже с удвоением', () => {
        // streak — длина серии ДО ответа, значит это третий по счёту.
        expect(pointsFor(2)).toBe(BASE_POINTS * 2);
    });
});

describe('applyAnswer', () => {
    it('верный ответ копит счёт, серию и рекорд серии', () => {
        const run = applyAnswer(emptyRun(), true);
        expect(run).toEqual({ score: 100, streak: 1, bestStreak: 1, correct: 1, wrong: 0 });
    });

    it('ошибка сбрасывает серию, но не счёт и не рекорд серии', () => {
        let run = emptyRun();
        for (let i = 0; i < 4; i++) run = applyAnswer(run, true);
        const scoreBefore = run.score;

        run = applyAnswer(run, false);
        expect(run.streak).toBe(0);
        expect(run.score).toBe(scoreBefore); // очки не отнимаются
        expect(run.bestStreak).toBe(4);      // рекорд серии остаётся
        expect(run.wrong).toBe(1);
    });

    it('после ошибки множитель начинается заново', () => {
        let run = emptyRun();
        for (let i = 0; i < 8; i++) run = applyAnswer(run, true); // разогнались до ×5
        run = applyAnswer(run, false);
        const before = run.score;
        run = applyAnswer(run, true);
        expect(run.score - before).toBe(BASE_POINTS); // снова базовая цена
    });

    it('длинная серия и правда разгоняет счёт', () => {
        let steady = emptyRun();
        let broken = emptyRun();
        for (let i = 0; i < 10; i++) {
            steady = applyAnswer(steady, true);
            // Тот же десяток верных ответов, но с ошибкой посередине.
            broken = applyAnswer(broken, i !== 5);
            if (i === 5) broken = applyAnswer(broken, true);
        }
        expect(steady.score).toBeGreaterThan(broken.score);
    });

    it('не мутирует переданное состояние', () => {
        const run = emptyRun();
        applyAnswer(run, true);
        expect(run).toEqual({ score: 0, streak: 0, bestStreak: 0, correct: 0, wrong: 0 });
    });
});

describe('starsForScore', () => {
    it('цель взята — три звезды', () => {
        expect(starsForScore(2000, 2000)).toBe(3);
        expect(starsForScore(5000, 2000)).toBe(3);
    });

    it('половина цели — две звезды', () => {
        expect(starsForScore(1000, 2000)).toBe(2);
    });

    it('меньше половины — одна звезда, но не ноль', () => {
        expect(starsForScore(0, 2000)).toBe(1);
        expect(starsForScore(100, 2000)).toBe(1);
    });
});

describe('SPEED_MATH_LEVELS', () => {
    it('четыре блока, сложность растёт, цель посильная', () => {
        expect(SPEED_MATH_LEVELS).toHaveLength(4);
        const diffs = SPEED_MATH_LEVELS.map((l) => l.difficulty);
        expect(diffs).toEqual([...diffs].sort((a, b) => a - b));
        for (const level of SPEED_MATH_LEVELS) {
            expect(level.target).toBeGreaterThan(0);
            expect(level.durationSec).toBeGreaterThan(0);
        }
    });

    it('цель достижима за отведённое время', () => {
        // Иначе три звезды недостижимы в принципе и лесенка врёт. Считаем по
        // спокойному темпу — 3 секунды на задание, без единой ошибки.
        for (const level of SPEED_MATH_LEVELS) {
            let run = emptyRun();
            const answers = Math.floor(level.durationSec / 3);
            for (let i = 0; i < answers; i++) run = applyAnswer(run, true);
            expect(run.score, level.level_id).toBeGreaterThanOrEqual(level.target);
        }
    });

    it('getLevelById находит блок и возвращает undefined для неизвестного', () => {
        expect(getLevelById('sm-4')?.title).toBe('Хитрое умножение');
        expect(getLevelById('нет-такого')).toBeUndefined();
    });
});

describe('generateTasks', () => {
    it('набор детерминирован: два вызова дают одно и то же', () => {
        for (const level of SPEED_MATH_LEVELS) {
            expect(generateTasks(level)).toEqual(generateTasks(level));
        }
    });

    it('у каждого задания ровно три различных варианта, среди них верный', () => {
        for (const level of SPEED_MATH_LEVELS) {
            for (const task of generateTasks(level)) {
                expect(task.options, `${level.level_id}: ${task.prompt}`).toHaveLength(3);
                expect(new Set(task.options).size).toBe(3);
                expect(task.options).toContain(task.answer);
            }
        }
    });

    it('все варианты положительные — отрицательный вариант выдаёт себя на глаз', () => {
        for (const level of SPEED_MATH_LEVELS) {
            for (const task of generateTasks(level)) {
                for (const option of task.options) {
                    expect(option, `${level.level_id}: ${task.prompt}`).toBeGreaterThan(0);
                }
            }
        }
    });

    it('ответы целые — устный счёт не должен упираться в дроби', () => {
        for (const level of SPEED_MATH_LEVELS) {
            for (const task of generateTasks(level)) {
                expect(Number.isInteger(task.answer), `${level.level_id}: ${task.prompt}`).toBe(true);
                for (const option of task.options) {
                    expect(Number.isInteger(option)).toBe(true);
                }
            }
        }
    });

    it('таблица умножения: условие сходится с ответом', () => {
        for (const task of generateTasks(SPEED_MATH_LEVELS[0])) {
            const [a, b] = task.prompt.split(' · ').map(Number);
            expect(a * b).toBe(task.answer);
            expect(a).toBeGreaterThanOrEqual(2);
            expect(b).toBeLessThanOrEqual(9);
        }
    });

    it('проценты: условие сходится с ответом', () => {
        for (const task of generateTasks(SPEED_MATH_LEVELS[1])) {
            const match = task.prompt.match(/^(\d+)% от (\d+)$/);
            expect(match, task.prompt).not.toBeNull();
            const [, pct, base] = match!;
            expect((Number(base) * Number(pct)) / 100).toBe(task.answer);
        }
    });

    it('степени: условие сходится с ответом', () => {
        for (const task of generateTasks(SPEED_MATH_LEVELS[2])) {
            if (task.prompt.endsWith('²')) {
                const a = Number(task.prompt.slice(0, -1));
                expect(a * a).toBe(task.answer);
            } else {
                const n = Number(task.prompt.replace('2^', ''));
                expect(2 ** n).toBe(task.answer);
            }
        }
    });

    it('хитрое умножение: и правда раскладывается в a² − b²', () => {
        for (const task of generateTasks(SPEED_MATH_LEVELS[3])) {
            const [x, y] = task.prompt.split(' · ').map(Number);
            expect(x * y).toBe(task.answer);
            // Множители симметричны относительно круглого числа — иначе приём
            // не применим и блок не учит тому, что обещает.
            const mid = (x + y) / 2;
            expect(Number.isInteger(mid)).toBe(true);
            expect(mid % 10).toBe(0);
        }
    });

    it('неизвестный уровень падает громко, а не отдаёт пустой набор', () => {
        expect(() => generateTasks({
            level_id: 'нет', title: 'т', hint: 'т', difficulty: 1, seed: 1, durationSec: 60, target: 100,
        })).toThrow();
    });
});
