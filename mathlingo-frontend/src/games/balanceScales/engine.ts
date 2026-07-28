// src/games/balanceScales/engine.ts
//
// Ядро «Уравнения-весов» (Ф4, школьный уровень). Уравнение — это весы:
// ax + b = cx + d. Игрок не «решает в столбик», а применяет операцию сразу к
// обеим чашам, пока слева не останется голый x. Это ровно то правило, которое
// в школе проговаривают словами («что делаешь с одной частью — делай и с
// другой»), только здесь оно единственно возможное действие.
//
// Всё иммутабельно и чисто (никакого DOM) — движок тестируется отдельно от UI,
// как в матричных играх.

/** Одна чаша весов: коэффициент при x и свободный член. */
export interface Side {
    x: number;
    c: number;
}

/** Состояние весов: обе чаши. */
export interface EqState {
    left: Side;
    right: Side;
}

/**
 * Ход. Операция всегда применяется к обеим чашам сразу — односторонних ходов
 * в игре не существует, поэтому равновесие невозможно нарушить в принципе.
 * Ошибка игрока — это не «сломал весы», а «ход не приблизил к ответу».
 */
export type Op =
    | { kind: 'add' | 'sub'; term: 'const' | 'x'; n: number }
    | { kind: 'div'; n: number };

/** Устойчивый ключ хода — для дедупликации палитры и React-key. */
export const opKey = (op: Op): string =>
    op.kind === 'div' ? `div:${op.n}` : `${op.kind}:${op.term}:${op.n}`;

/** Подпись хода на кнопке: «−4», «+2x», «÷3». */
export const opLabel = (op: Op): string => {
    if (op.kind === 'div') return `÷${op.n}`;
    const sign = op.kind === 'add' ? '+' : '−';
    return op.term === 'x' ? `${sign}${op.n}x` : `${sign}${op.n}`;
};

const isInt = (n: number): boolean => Number.isInteger(n);

/** Деление на отрицательное число рождает −0 (0 / −1). Для арифметики это тот
 *  же ноль, но в состоянии он лишний — сравнения через Object.is начинают врать. */
const zeroSafe = (n: number): number => (n === 0 ? 0 : n);

/**
 * Применяет ход к обеим чашам. Возвращает null, если ход недопустим:
 * деление на ноль, деление на единицу (пустой ход) или деление, уводящее
 * уравнение в дроби — школьный уровень остаётся в целых числах.
 */
export const applyOp = (state: EqState, op: Op): EqState | null => {
    if (op.kind === 'div') {
        if (op.n === 0 || op.n === 1) return null;
        const next = {
            left: { x: zeroSafe(state.left.x / op.n), c: zeroSafe(state.left.c / op.n) },
            right: { x: zeroSafe(state.right.x / op.n), c: zeroSafe(state.right.c / op.n) },
        };
        const exact = [next.left.x, next.left.c, next.right.x, next.right.c].every(isInt);
        return exact ? next : null;
    }

    const delta = op.kind === 'add' ? op.n : -op.n;
    if (op.term === 'x') {
        return {
            left: { x: state.left.x + delta, c: state.left.c },
            right: { x: state.right.x + delta, c: state.right.c },
        };
    }
    return {
        left: { x: state.left.x, c: state.left.c + delta },
        right: { x: state.right.x, c: state.right.c + delta },
    };
};

/**
 * Весы «решены», когда на одной чаше стоит ровно x, а на другой — только
 * число. Слева или справа — неважно: x = 5 и 5 = x одинаково верны.
 */
export const isSolved = (state: EqState): boolean => {
    const isolated = (a: Side, b: Side) => a.x === 1 && a.c === 0 && b.x === 0;
    return isolated(state.left, state.right) || isolated(state.right, state.left);
};

/** Значение x у решённых весов; null, если ещё не решено. */
export const solvedValue = (state: EqState): number | null => {
    if (!isSolved(state)) return null;
    return state.left.x === 1 && state.left.c === 0 ? state.right.c : state.left.c;
};

/** Запись чаши для игрока: «3x + 4», «19», «−x», «0». */
export const formatSide = (side: Side): string => {
    if (side.x === 0) return String(side.c);

    const xPart = side.x === 1 ? 'x' : side.x === -1 ? '−x' : `${side.x < 0 ? '−' : ''}${Math.abs(side.x)}x`;
    if (side.c === 0) return xPart;
    return `${xPart} ${side.c > 0 ? '+' : '−'} ${Math.abs(side.c)}`;
};

/** Уравнение целиком: «3x + 4 = 19». */
export const formatState = (state: EqState): string =>
    `${formatSide(state.left)} = ${formatSide(state.right)}`;
