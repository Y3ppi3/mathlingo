// src/games/gaussJordan/fraction.ts
//
// Тонкая обёртка над mathjs Fraction для игры «Побег Гаусса-Жордана».
// Вся арифметика игры идёт на точных дробях, а не на float: цель уровня —
// получить РОВНО единичную матрицу слева, а с плавающей точкой «1.0000001»
// никогда не сойдётся точно. mathjs v14 хранит дробь на BigInt (n/d/s), так
// что даже большие числители не теряют точность.
//
// Чистый модуль: никаких импортов React/DOM (Фаза 1 roadmap).
import * as math from 'mathjs';
import type { Fraction } from 'mathjs';

export type Frac = Fraction;

/** Дробь n/d (по умолчанию d=1). d=0 недопустим — mathjs бросит исключение. */
export const fr = (n: number, d = 1): Frac => math.fraction(n, d) as Frac;

export const frAdd = (a: Frac, b: Frac): Frac => math.add(a, b) as Frac;
export const frSub = (a: Frac, b: Frac): Frac => math.subtract(a, b) as Frac;
export const frMul = (a: Frac, b: Frac): Frac => math.multiply(a, b) as Frac;
export const frDiv = (a: Frac, b: Frac): Frac => math.divide(a, b) as Frac;
export const frNeg = (a: Frac): Frac => math.unaryMinus(a) as Frac;

/** Точное равенство двух дробей (mathjs сравнивает по сокращённой форме). */
export const frEquals = (a: Frac, b: Frac): boolean => math.equal(a, b) as boolean;

export const frIsZero = (a: Frac): boolean => math.equal(a, 0) as boolean;
export const frIsOne = (a: Frac): boolean => math.equal(a, 1) as boolean;

/**
 * Человекочитаемый вид: «1/2», «-3», «-7/4». Через toFraction(), а не через
 * внутренние поля n/d/s (в v14 они BigInt) — так формат не зависит от версии.
 */
export const frFormat = (a: Frac): string => a.toFraction();
