// src/games/balanceScales/solver.ts
//
// Солвер «Уравнения-весов»: собирает палитру ходов, считает пар (минимум ходов
// до ответа) и отвечает на главный вопрос игры — «этот ход приблизил к ответу
// или нет?».
//
// Пар не хардкодим в уровнях, а считаем поиском в ширину по тем же ходам,
// которые видит игрок: иначе пар и движок разойдутся при первой же правке
// уровня (та же причина, что и в «Стрелке Судьбы»).
import { type EqState, type Op, applyOp, isSolved, opKey } from './engine';

export interface BalanceLevel {
    level_id: string;
    title: string;
    difficulty: number;
    start: EqState;
}

/** Глубина поиска. Общий вид ax+b=cx+d решается за 3 хода — запас пятикратный. */
const MAX_DEPTH = 8;

const stateKey = (s: EqState): string => `${s.left.x},${s.left.c}|${s.right.x},${s.right.c}`;

/**
 * Палитра ходов для текущих весов — то, что игрок видит на кнопках.
 *
 * Каждый ход — это «убрать лишнее с одной из чаш»: погасить свободный член,
 * погасить x-член, поделить на коэффициент. Ходы, уводящие в дроби или пустые
 * (÷1), отсеиваются самим applyOp, поэтому «÷3» не предлагается там, где оно
 * даёт 4/3.
 *
 * Палитра намеренно содержит и неоптимальные ходы (погасить константу не с той
 * чаши) — иначе выбирать не из чего и игра превращается в «жми единственную
 * кнопку». Отличить полезный ход от бесполезного — это и есть задача игрока.
 */
export const candidateOps = (state: EqState): Op[] => {
    const out: Op[] = [];
    const seen = new Set<string>();

    const offer = (op: Op) => {
        const key = opKey(op);
        if (seen.has(key)) return;
        if (applyOp(state, op) === null) return;
        seen.add(key);
        out.push(op);
    };

    // Погасить свободный член — на любой из чаш.
    for (const c of [state.left.c, state.right.c]) {
        if (c !== 0) offer(c > 0 ? { kind: 'sub', term: 'const', n: c } : { kind: 'add', term: 'const', n: -c });
    }
    // Погасить x-член — на любой из чаш (так x собирается в одном месте).
    for (const x of [state.left.x, state.right.x]) {
        if (x !== 0) offer(x > 0 ? { kind: 'sub', term: 'x', n: x } : { kind: 'add', term: 'x', n: -x });
    }
    // Поделить на коэффициент при x. ÷1 бессмысленно, ÷(−1) — нет: −x = 5.
    for (const x of [state.left.x, state.right.x]) {
        if (x !== 0 && x !== 1) offer({ kind: 'div', n: x });
    }

    return out;
};

/**
 * Минимум ходов до ответа (поиск в ширину). Infinity — если из этого состояния
 * ответ недостижим за MAX_DEPTH ходов.
 */
export const parMoves = (state: EqState): number => {
    if (isSolved(state)) return 0;

    let frontier: EqState[] = [state];
    const seen = new Set<string>([stateKey(state)]);

    for (let depth = 1; depth <= MAX_DEPTH; depth++) {
        const next: EqState[] = [];
        for (const current of frontier) {
            for (const op of candidateOps(current)) {
                const child = applyOp(current, op);
                if (child === null) continue;
                if (isSolved(child)) return depth;
                const key = stateKey(child);
                if (seen.has(key)) continue;
                seen.add(key);
                next.push(child);
            }
        }
        if (next.length === 0) break;
        frontier = next;
    }
    return Infinity;
};

/**
 * Приблизил ли ход к ответу. Именно это отличает верный ход от неверного:
 * равновесие ходом сломать нельзя (операция всегда идёт на обе чаши), а вот
 * потратить ход впустую — можно.
 */
export const isProgress = (state: EqState, op: Op): boolean => {
    const next = applyOp(state, op);
    if (next === null) return false;
    return parMoves(next) < parMoves(state);
};

/** Корень уравнения ax + b = cx + d; null, если корень не единственный. */
export const solutionOf = (state: EqState): number | null => {
    const a = state.left.x - state.right.x;
    const b = state.right.c - state.left.c;
    if (a === 0) return null; // нет корней либо корень любой — для игры не годится
    return b / a;
};

/**
 * Уровень пригоден, если корень единственный, целый (школьный уровень — без
 * дробей) и достижим за MAX_DEPTH ходов.
 */
export const validateLevel = (level: BalanceLevel): { valid: boolean; reason?: string } => {
    const root = solutionOf(level.start);
    if (root === null) return { valid: false, reason: 'корень не единственный' };
    if (!Number.isInteger(root)) return { valid: false, reason: `корень не целый (${root})` };
    if (isSolved(level.start)) return { valid: false, reason: 'уравнение уже решено' };
    const par = parMoves(level.start);
    if (!Number.isFinite(par)) return { valid: false, reason: 'ответ недостижим доступными ходами' };
    return { valid: true };
};

/** Подсказка — любой ход, который приближает к ответу; null, если таких нет. */
export const hintOp = (state: EqState): Op | null =>
    candidateOps(state).find((op) => isProgress(state, op)) ?? null;

/**
 * Звёзды за пройденный уровень. Считаем не ходы, а промахи: полезный ход всегда
 * убирает ровно один ход из пара, поэтому решённый уровень — это всегда ровно
 * пар полезных ходов, и мерить их бессмысленно. Разница между игроками — в том,
 * сколько раз они ткнули мимо и сколько раз попросили подсказку.
 */
export const starsForSolve = (mistakes: number): 1 | 2 | 3 => {
    if (mistakes <= 0) return 3;
    if (mistakes <= 2) return 2;
    return 1;
};
