// src/components/games/EigenArrowGame.tsx
//
// UI игры «Стрелка Судьбы» (Фаза 4), механика «Прицел судьбы». Один уровень:
// игрок сначала ЦЕЛИТСЯ призраком-пунктиром — предсказывает, куда укажет
// стрелка после многократного умножения на матрицу A, — затем запускает
// степенную итерацию и «подсматривает» тиками, пока не защёлкнет результат.
//
// Крючок — гольф прогноза: точный прицел + меньше подсмотренных тиков = больше
// звёзд. «Сок»: призрак зеленеет при точном прицеле, стрелка защёлкивается на
// судьбе, судьба раскрывается золотой линией, празднование относительно пара и
// личного рекорда. Вводный экран «как играть» — сразу (не голая механика).
//
// Вся математика — в чистом движке src/games/eigenArrow. Компонент не ходит в
// API сам: телеметрию/прогресс дёргает страница через onTick/onComplete.
import { useMemo, useRef, useState } from 'react';
import { type Mat2, type Vec2, angleDeg, vecFromAngle } from '../../games/eigenArrow/vector';
import { iterate, stepChangeDeg } from '../../games/eigenArrow/engine';
import {
    analyzeMatrix, predictionErrorDeg, starsForPrediction,
} from '../../games/eigenArrow/solver';

export interface EigenArrowLevelProp {
    level_id: string;
    title: string;
    matrix: number[][]; // 2×2
    start: number[];    // стартовая стрелка
    par: number;        // опорное число тиков до защёлки
}

interface EigenArrowGameProps {
    level: EigenArrowLevelProp;
    bestStars?: number;
    bestMetric?: number | null; // прошлый рекорд по числу тиков
    hasNextLevel?: boolean;
    onTick?: () => void;
    onComplete?: (result: { ticks: number; stars: 1 | 2 | 3; errorDeg: number; timeMs: number }) => void;
    onExit?: (solved: boolean) => void;
    onNextLevel?: () => void;
}

// Показываем вводный экран один раз за сессию, а не на каждый уровень.
let introSeenThisSession = false;

const MAX_TICKS = 40;
const TOL_DEG = 3;      // «защёлкнулось», если поворот за тик не больше
const ACCURATE_DEG = 5; // точный прицел (3★)

const CX = 150;
const CY = 150;
const R = 118;
const RAD = Math.PI / 180;

// Направление как ЛИНИЯ: угол в [0,180). v и −v рисуем одинаково, поэтому при
// λ₂<0 («Качели») стрелка не прыгает на 180°, а плавно колеблется к судьбе.
const lineAngle = (v: Vec2): number => ((angleDeg(v) % 180) + 180) % 180;

// Точка на циферблате по линейному углу (экранный Y вниз, поэтому −sin).
const point = (aDeg: number, r: number): [number, number] => {
    const a = aDeg * RAD;
    return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
};

// Треугольная «голова» стрелки у обода.
const arrowHead = (aDeg: number): string => {
    const a = aDeg * RAD;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const [tx, ty] = [CX + R * c, CY - R * s];
    const baseR = R - 15;
    const [bx, by] = [CX + baseR * c, CY - baseR * s];
    // Перпендикуляр в экранных координатах.
    const px = s;
    const py = c;
    return `${tx},${ty} ${bx + 7 * px},${by + 7 * py} ${bx - 7 * px},${by - 7 * py}`;
};

const EigenArrowGame = ({
    level, bestMetric, hasNextLevel, onTick, onComplete, onExit, onNextLevel,
}: EigenArrowGameProps) => {
    const A = useMemo(() => level.matrix as unknown as Mat2, [level.matrix]);
    const start = useMemo(() => level.start as unknown as Vec2, [level.start]);
    const info = useMemo(() => analyzeMatrix(A), [A]);
    // Полная траектория до MAX_TICKS считается один раз — тики просто листают её.
    const path = useMemo(() => iterate(A, start, MAX_TICKS), [A, start]);

    const trueAngle = info ? lineAngle(info.dominantVector) : 0;
    const startAngle = lineAngle(path[0]);

    const [phase, setPhase] = useState<'aim' | 'running' | 'done'>('aim');
    const [guessDeg, setGuessDeg] = useState<number>(() => Math.round(startAngle));
    const [tickIndex, setTickIndex] = useState(0);
    const [result, setResult] = useState<{ ticks: number; stars: 1 | 2 | 3; errorDeg: number } | null>(null);

    const [showIntro, setShowIntro] = useState(!introSeenThisSession);
    const startRef = useRef<number>(Date.now());

    const curVec = path[Math.min(tickIndex, MAX_TICKS)];
    const curAngle = lineAngle(curVec);
    const stepChange = stepChangeDeg(A, curVec);
    const converged = tickIndex > 0 && stepChange <= TOL_DEG;

    const dismissIntro = () => {
        introSeenThisSession = true;
        setShowIntro(false);
        startRef.current = Date.now();
    };

    const launch = () => {
        if (phase !== 'aim') return;
        setPhase('running'); // прицел заморожен: слайдер больше не активен
    };

    const tick = () => {
        if (phase !== 'running' || tickIndex >= MAX_TICKS) return;
        setTickIndex((t) => t + 1);
        onTick?.();
    };

    const lock = () => {
        if (phase !== 'running') return;
        const errorDeg = info ? predictionErrorDeg(A, vecFromAngle(guessDeg)) : 90;
        const stars = starsForPrediction(errorDeg, tickIndex, level.par);
        setResult({ ticks: tickIndex, stars, errorDeg });
        setPhase('done');
        onComplete?.({ ticks: tickIndex, stars, errorDeg, timeMs: Date.now() - startRef.current });
    };

    const restart = () => {
        setPhase('aim');
        setGuessDeg(Math.round(startAngle));
        setTickIndex(0);
        setResult(null);
        startRef.current = Date.now();
    };

    // Клик по циферблату — тоже способ прицелиться (в фазе aim).
    const aimByClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (phase !== 'aim') return;
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 300 - CX;
        const y = -(((e.clientY - rect.top) / rect.height) * 300 - CY);
        const deg = ((Math.atan2(y, x) / RAD) % 180 + 180) % 180;
        setGuessDeg(Math.round(deg));
    };

    const accurate = result && result.errorDeg <= ACCURATE_DEG;
    const beatPar = result && result.stars === 3;
    const newRecord = result && (bestMetric == null || result.ticks < bestMetric);

    const [gx1, gy1] = point(guessDeg, R);
    const [gx2, gy2] = point(guessDeg, -R);
    const guessColor = result ? (accurate ? '#22c55e' : '#f59e0b') : '#94a3b8';

    const hint = (() => {
        if (phase === 'aim') return 'Покрути пунктир туда, куда, по-твоему, укажет судьба. Готов — «Запустить».';
        if (phase === 'running') {
            return converged
                ? 'Похоже, защёлкнулось. Жми «Готово» — или подсмотри ещё тик.'
                : `Тик ${tickIndex}: стрелка поворачивается к судьбе (за шаг ${stepChange.toFixed(1)}°).`;
        }
        return 'Готово!';
    })();

    return (
        <div className="max-w-xl mx-auto">
            {/* Вводный экран «как играть» */}
            {showIntro && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
                    <div className="max-w-sm w-full p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Как играть</h3>
                        <div className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-300">
                            <p><span className="font-medium text-gray-900 dark:text-white">🧭 Идея:</span> если вектор снова и снова умножать на матрицу A, его направление сходится к одной линии — «стрелке судьбы» (главному собственному вектору).</p>
                            <p><span className="font-medium text-gray-900 dark:text-white">🎯 Цель:</span> предскажи эту линию заранее — покрути пунктирный прицел.</p>
                            <p><span className="font-medium text-gray-900 dark:text-white">🕹 Ход игры:</span></p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><b>Прицелься</b> пунктиром (слайдер или клик по кругу)</li>
                                <li><b>Запусти</b> — прицел замрёт</li>
                                <li><b>Тик</b> за тиком подсматривай, как стрелка крутится к судьбе</li>
                                <li><b>Готово</b> — защёлкни, когда уверен</li>
                            </ul>
                            <p><span className="font-medium text-gray-900 dark:text-white">🏁 Гольф:</span> точный прицел + меньше подсмотренных тиков = больше звёзд. Уверен в прогнозе — защёлкивай раньше.</p>
                        </div>
                        <button
                            type="button"
                            onClick={dismissIntro}
                            className="mt-5 w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                        >
                            Понятно, поехали
                        </button>
                    </div>
                </div>
            )}

            {/* Верхняя панель */}
            <div className="flex items-center justify-between mb-3">
                <button
                    type="button"
                    onClick={() => onExit?.(!!result)}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    ← К уровням
                </button>
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <span>Тиков: <span className="font-semibold text-gray-900 dark:text-white">{tickIndex}</span></span>
                    <span>·</span>
                    <span>пар {level.par}</span>
                    {typeof bestMetric === 'number' && (
                        <span className="text-gray-400 dark:text-gray-500">· рекорд {bestMetric}</span>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowIntro(true)}
                        aria-label="Как играть"
                        className="w-6 h-6 rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-indigo-400 transition-colors"
                    >
                        ?
                    </button>
                </div>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{level.title}</h2>

            {/* Цель (всегда на виду) + матрица A */}
            <div className="mb-3 flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                    🎯 Предскажи «стрелку судьбы». Точнее и с меньшим числом тиков = больше звёзд.
                </span>
                <div className="shrink-0 font-mono text-xs text-gray-500 dark:text-gray-400 leading-tight" aria-label="Матрица A">
                    <div>A = [{level.matrix[0][0]} {level.matrix[0][1]}]</div>
                    <div className="pl-[1.7rem]">[{level.matrix[1][0]} {level.matrix[1][1]}]</div>
                </div>
            </div>

            {/* Циферблат */}
            <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 flex justify-center">
                <svg
                    viewBox="0 0 300 300"
                    className={`w-full max-w-[320px] ${phase === 'aim' ? 'cursor-crosshair' : ''}`}
                    onClick={aimByClick}
                >
                    {/* Обод и оси */}
                    <circle cx={CX} cy={CY} r={R} className="fill-none stroke-gray-200 dark:stroke-gray-700" strokeWidth={2} />
                    <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} className="stroke-gray-100 dark:stroke-gray-800" strokeWidth={1} />
                    <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} className="stroke-gray-100 dark:stroke-gray-800" strokeWidth={1} />

                    {/* Истинная судьба — раскрывается золотой линией после защёлки */}
                    {result && (
                        <line
                            x1={point(trueAngle, R)[0]} y1={point(trueAngle, R)[1]}
                            x2={point(trueAngle, -R)[0]} y2={point(trueAngle, -R)[1]}
                            stroke="#eab308" strokeWidth={3} strokeLinecap="round" opacity={0.8}
                        />
                    )}

                    {/* Призрак-прицел (пунктир) */}
                    <line
                        x1={gx1} y1={gy1} x2={gx2} y2={gy2}
                        stroke={guessColor} strokeWidth={2.5} strokeDasharray="7 6" strokeLinecap="round"
                    />

                    {/* Текущая стрелка */}
                    {phase !== 'aim' && (
                        <>
                            <line
                                x1={CX} y1={CY} x2={point(curAngle, R - 6)[0]} y2={point(curAngle, R - 6)[1]}
                                stroke={converged || result ? '#22c55e' : '#4f46e5'} strokeWidth={4} strokeLinecap="round"
                                style={{ transition: 'all 220ms ease' }}
                            />
                            <polygon
                                points={arrowHead(curAngle)}
                                fill={converged || result ? '#22c55e' : '#4f46e5'}
                                style={{ transition: 'all 220ms ease' }}
                            />
                        </>
                    )}
                    <circle cx={CX} cy={CY} r={5} className="fill-gray-400 dark:fill-gray-500" />
                </svg>
            </div>

            {/* Строка состояния / подсказка */}
            {phase !== 'done' && (
                <div className="mt-3 text-sm text-center min-h-[1.25rem]">
                    {converged
                        ? <span className="text-green-600 dark:text-green-400 font-medium">✓ Стрелка защёлкнулась — {hint}</span>
                        : <span className="text-gray-600 dark:text-gray-300">{hint}</span>}
                </div>
            )}

            {/* Фаза прицела: слайдер */}
            {phase === 'aim' && (
                <div className="mt-3 p-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5">
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 mb-1">
                        <span>Прицел</span>
                        <span className="font-mono text-gray-900 dark:text-white">{guessDeg}°</span>
                    </div>
                    <input
                        type="range" min={0} max={179} value={guessDeg}
                        onChange={(e) => setGuessDeg(Number(e.target.value))}
                        aria-label="Угол прицела"
                        className="w-full accent-indigo-600"
                    />
                    <button
                        type="button"
                        onClick={launch}
                        className="mt-3 w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                    >
                        Запустить судьбу →
                    </button>
                </div>
            )}

            {/* Фаза подсматривания: тик / готово */}
            {phase === 'running' && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={tick}
                        disabled={tickIndex >= MAX_TICKS}
                        className="h-11 rounded-xl text-sm font-medium bg-white dark:bg-gray-800 border-2 border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 hover:border-indigo-400 disabled:opacity-40 transition-colors"
                    >
                        ⏭ Тик (подсмотреть)
                    </button>
                    <button
                        type="button"
                        onClick={lock}
                        className={`h-11 rounded-xl text-sm font-medium text-white transition-colors ${
                            converged ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                    >
                        ✓ Готово — защёлкнуть
                    </button>
                </div>
            )}

            {/* Экран результата */}
            {result && (
                <div className="mt-6 p-6 rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-center">
                    <div className="text-3xl mb-2">{'★'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                        Ошибка прицела: {result.errorDeg.toFixed(1)}°
                    </div>
                    <div className="text-sm mt-1">
                        {beatPar
                            ? <span className="text-green-600 dark:text-green-400 font-medium">🎯 В точку — и уложился в пар!</span>
                            : newRecord
                                ? <span className="text-green-600 dark:text-green-400 font-medium">🏆 Новый личный рекорд!</span>
                                : <span className="text-gray-500 dark:text-gray-400">Пар уровня: {level.par} тиков{typeof bestMetric === 'number' ? ` · рекорд: ${bestMetric}` : ''}</span>}
                    </div>

                    <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 space-x-3">
                        <span>Прогноз: {guessDeg}°</span>
                        <span>Судьба: {trueAngle.toFixed(0)}°</span>
                        <span>Подсмотрено тиков: {result.ticks}</span>
                    </div>
                    {info && (
                        <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            Главное собственное значение λ ≈ {info.dominantValue.toFixed(2)}
                        </div>
                    )}

                    <div className="mt-6 flex flex-wrap gap-2 justify-center">
                        {!beatPar && (
                            <button
                                type="button"
                                onClick={restart}
                                className="h-11 px-5 rounded-xl bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 text-sm font-medium hover:border-indigo-400 transition-colors"
                            >
                                Ещё точнее? ↺
                            </button>
                        )}
                        {hasNextLevel && (
                            <button
                                type="button"
                                onClick={() => onNextLevel?.()}
                                className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                            >
                                Следующий уровень →
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => onExit?.(true)}
                            className="h-11 px-5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                        >
                            К уровням
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EigenArrowGame;
