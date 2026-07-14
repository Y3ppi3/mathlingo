// src/components/games/DerivFall.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import Button from '../ui/Button';
import { sanitizeHtml } from '../../utils/sanitizeHtml';

// ─── KaTeX рендерер ───────────────────────────────────────────────────────────
const M = ({ tex }: { tex: string }) => (
    <span
        dangerouslySetInnerHTML={{
          __html: sanitizeHtml(katex.renderToString(tex, { throwOnError: false, displayMode: false })),
        }}
    />
);

// ─── Интерфейсы ───────────────────────────────────────────────────────────────
interface DerivativeProblem {
  id: string;
  problem: string;   // LaTeX строка для условия
  options: string[]; // LaTeX строки для вариантов
  answer: string;    // должен совпадать с одним из options
  difficulty: 'easy' | 'medium' | 'hard';
}

interface DerivFallProps {
  difficulty?: number;
  timeLimit?: number;
  onComplete?: (score: number, maxScore: number) => void;
  problemsSource: DerivativeProblem[];
  forcePause?: boolean;
}

// карточка шириной 260px — центры колонок подбираем с запасом от края
const CARD_WIDTH    = 260;
const FIXED_POSITIONS = [20, 50, 80]; // %

type FallingProblem = DerivativeProblem & {
  instanceId: string;
  left: number;
  top: number;
  answered: boolean;
  correct?: boolean;
};

// ─── Компонент ────────────────────────────────────────────────────────────────
const DerivFall = ({
                     difficulty   = 3,
                     timeLimit    = 60,
                     onComplete,
                     problemsSource,
                     forcePause   = false,
                   }: DerivFallProps) => {

  const [problems, setProblems]                   = useState<FallingProblem[]>([]);
  const [score, setScore]                         = useState(0);
  const [pointsEarned, setPointsEarned]           = useState(0);
  const [pointsLost, setPointsLost]               = useState(0);
  const [lives, setLives]                         = useState(3);
  const [gameOver, setGameOver]                   = useState(false);
  const [gameStarted, setGameStarted]             = useState(false);
  const [gamePaused, setGamePaused]               = useState(false);
  const [difficultyLevel, setDifficultyLevel]     = useState<'easy' | 'medium' | 'hard'>('medium');
  const [speed, setSpeed]                         = useState(6000);
  const [timeRemaining, setTimeRemaining]         = useState(timeLimit);
  const [problemBank, setProblemBank]             = useState<DerivativeProblem[]>(problemsSource);
  const [problemsCompleted, setProblemsCompleted] = useState(0);
  const [problemsIncorrect, setProblemsIncorrect] = useState(0);
  const [countdownActive, setCountdownActive]     = useState(false);
  const [countdown, setCountdown]                 = useState(3);
  const [showFeedback, setShowFeedback]           = useState(false);
  const [feedbackMessage, setFeedbackMessage]     = useState('');
  const [feedbackType, setFeedbackType]           = useState<'success' | 'error'>('success');

  const maxProblemsOnScreen = 2; // уменьшили т.к. карточки стали шире

  const timerRef             = useRef<NodeJS.Timeout | null>(null);
  const gameIntervalRef      = useRef<NodeJS.Timeout | null>(null);
  const problemTimeoutsRef   = useRef<Record<string, NodeJS.Timeout>>({});
  const gameActiveRef        = useRef(false);
  const currentScoreRef      = useRef(0);
  const problemsCompletedRef = useRef(0);
  const totalProblemsSeenRef = useRef(0);
  const isPausedRef          = useRef(false);
  const isForcePausedRef     = useRef(false);
  const lastProblemTimeRef   = useRef(0);
  const activeProblemsRef    = useRef(0);
  const livesRef             = useRef(3);
  const problemsRef          = useRef<FallingProblem[]>([]);
  // Защита от двойного завершения игры: endGame() дёргается из двух
  // независимых асинхронных путей (истечение таймера и потеря последней
  // жизни при пропуске задачи) — при их совпадении (или под React
  // StrictMode, который в dev дважды вызывает updater-функции setState)
  // onComplete/submitGameAttempt мог вызваться дважды за один и тот же
  // прогон игры (см. отчёт: очки списывались, но одна из двух попыток
  // приходила на бэкенд как "Неверно" из-за гонки currentScoreRef).
  const gameEndedRef         = useRef(false);

  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { problemsCompletedRef.current = problemsCompleted; }, [problemsCompleted]);
  useEffect(() => { problemsRef.current = problems; }, [problems]);

  const setFeedback = useCallback((msg: string, type: 'success' | 'error') => {
    setFeedbackMessage(msg);
    setFeedbackType(type);
    setShowFeedback(true);
    setTimeout(() => setShowFeedback(false), 900);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const stopProblemInterval = useCallback(() => {
    if (gameIntervalRef.current) { clearInterval(gameIntervalRef.current); gameIntervalRef.current = null; }
  }, []);

  const endGame = useCallback(() => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;

    setGameOver(true);
    setGameStarted(false);
    setGamePaused(false);
    isPausedRef.current      = false;
    isForcePausedRef.current = false;
    gameActiveRef.current    = false;

    stopTimer();
    stopProblemInterval();
    Object.values(problemTimeoutsRef.current).forEach(clearTimeout);
    problemTimeoutsRef.current = {};

    if (onComplete) {
      const finalScore = currentScoreRef.current;
      const correct    = problemsCompletedRef.current;
      const maxScore   = Math.max(totalProblemsSeenRef.current * 10, correct * 10, 10);
      onComplete(finalScore, maxScore);
    }
  }, [onComplete, stopTimer, stopProblemInterval]);

  const createProblem = useCallback(() => {
    if (livesRef.current <= 0 || !gameActiveRef.current || isPausedRef.current || isForcePausedRef.current) return;
    if (activeProblemsRef.current >= maxProblemsOnScreen) return;

    const now = Date.now();
    if (now - lastProblemTimeRef.current < 1200) return;
    lastProblemTimeRef.current = now;

    let filtered = problemBank.filter(p =>
        difficultyLevel === 'easy'   ? p.difficulty === 'easy' :
            difficultyLevel === 'medium' ? p.difficulty !== 'hard' : true
    );
    if (!filtered.length) filtered = [...problemBank];

    const problem    = filtered[Math.floor(Math.random() * filtered.length)];
    const instanceId = `prob-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const col        = Math.floor(Math.random() * FIXED_POSITIONS.length);
    const left       = FIXED_POSITIONS[col];

    activeProblemsRef.current    += 1;
    totalProblemsSeenRef.current += 1;

    setProblems(prev => [...prev, { ...problem, instanceId, left, top: 0, answered: false }]);

    problemTimeoutsRef.current[instanceId] = setTimeout(() => {
      if (isPausedRef.current || isForcePausedRef.current) return;

      // Существование задачи проверяем через ref (актуален синхронно), а не
      // внутри updater'а setProblems — вызывать setLives/endGame прямо из
      // updater'а другого setState — антипаттерн React (see: "Cannot update
      // a component while rendering a different component"), который под
      // StrictMode приводит к двойному вызову endGame()/onComplete().
      const exists = problemsRef.current.some(p => p.instanceId === instanceId && !p.answered);
      setProblems(prev => prev.filter(p => p.instanceId !== instanceId));
      delete problemTimeoutsRef.current[instanceId];

      if (exists) {
        activeProblemsRef.current = Math.max(0, activeProblemsRef.current - 1);
        const newLives = livesRef.current - 1;
        setLives(newLives);
        currentScoreRef.current = Math.max(0, currentScoreRef.current - 5);
        setScore(currentScoreRef.current);
        setPointsLost(pl => pl + 5);
        setFeedback('Пропущена задача! −5 очков', 'error');
        if (newLives <= 0) endGame();
      }
    }, speed + 1200);
  }, [difficultyLevel, problemBank, endGame, setFeedback, speed]);

  const setupProblemInterval = useCallback(() => {
    stopProblemInterval();
    const ms = difficultyLevel === 'easy' ? 6000 : difficultyLevel === 'medium' ? 5000 : 3500;
    gameIntervalRef.current = setInterval(() => {
      if (!isPausedRef.current && !isForcePausedRef.current && gameActiveRef.current) createProblem();
    }, ms);
  }, [difficultyLevel, createProblem, stopProblemInterval]);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      if (!isPausedRef.current && !isForcePausedRef.current) {
        // Только чистое вычисление следующего состояния — endGame() не
        // вызывается отсюда (см. gameEndedRef выше), а из эффекта ниже,
        // который реагирует на timeRemaining === 0.
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }
    }, 1000);
  }, [stopTimer]);

  useEffect(() => {
    if (gameStarted && !gameOver && timeRemaining <= 0) endGame();
  }, [timeRemaining, gameStarted, gameOver, endGame]);

  // Внешняя принудительная пауза (диалог выхода)
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    isForcePausedRef.current = forcePause;
    if (forcePause) {
      stopTimer();
      stopProblemInterval();
      setGamePaused(true);
    } else {
      if (!isPausedRef.current) {
        lastProblemTimeRef.current = 0;
        startTimer();
        setupProblemInterval();
        setGamePaused(false);
      }
    }
  }, [forcePause, gameStarted, gameOver, stopTimer, stopProblemInterval, startTimer, setupProblemInterval]);

  const handleAnswerSelect = useCallback((instanceId: string, selected: string, correct: string) => {
    activeProblemsRef.current = Math.max(0, activeProblemsRef.current - 1);
    setProblems(prev => prev.map(p =>
        p.instanceId === instanceId ? { ...p, answered: true, correct: selected === correct } : p
    ));
    if (problemTimeoutsRef.current[instanceId]) {
      clearTimeout(problemTimeoutsRef.current[instanceId]);
      delete problemTimeoutsRef.current[instanceId];
    }
    if (selected === correct) {
      currentScoreRef.current += 10;
      setScore(currentScoreRef.current);
      setPointsEarned(pe => pe + 10);
      setProblemsCompleted(pc => pc + 1);
      setFeedback('Правильно! +10 очков', 'success');
    } else {
      currentScoreRef.current = Math.max(0, currentScoreRef.current - 5);
      setScore(currentScoreRef.current);
      setPointsLost(pl => pl + 5);
      setProblemsIncorrect(pi => pi + 1);
      setFeedback(`Неверно! −5 очков`, 'error');
    }
    setTimeout(() => setProblems(prev => prev.filter(p => p.instanceId !== instanceId)), 700);
  }, [setFeedback]);

  const resetGame = useCallback(() => {
    stopTimer(); stopProblemInterval();
    Object.values(problemTimeoutsRef.current).forEach(clearTimeout);
    problemTimeoutsRef.current = {};

    setProblems([]); setScore(0); setPointsEarned(0); setPointsLost(0); setLives(3);
    setGameOver(false); setGameStarted(false); setGamePaused(false);
    setTimeRemaining(timeLimit); setProblemsCompleted(0); setProblemsIncorrect(0); setShowFeedback(false);

    currentScoreRef.current      = 0;
    problemsCompletedRef.current = 0;
    totalProblemsSeenRef.current = 0;
    gameActiveRef.current        = false;
    isPausedRef.current          = false;
    isForcePausedRef.current     = false;
    lastProblemTimeRef.current   = 0;
    activeProblemsRef.current    = 0;
    livesRef.current             = 3;
    gameEndedRef.current         = false;
  }, [timeLimit, stopTimer, stopProblemInterval]);

  const startGame = useCallback(() => {
    if (gameActiveRef.current) return;
    setGameStarted(true); setGamePaused(false);
    isPausedRef.current = false; gameActiveRef.current = true;
    setTimeRemaining(timeLimit);
    startTimer();
    setTimeout(() => { createProblem(); setupProblemInterval(); }, 1000);
  }, [timeLimit, startTimer, createProblem, setupProblemInterval]);

  const togglePause = useCallback(() => {
    if (isForcePausedRef.current) return;
    const pausing = !isPausedRef.current;
    isPausedRef.current = pausing;
    if (pausing) {
      stopTimer(); stopProblemInterval(); setGamePaused(true);
    } else {
      lastProblemTimeRef.current = 0;
      startTimer(); setupProblemInterval(); setGamePaused(false);
    }
  }, [stopTimer, stopProblemInterval, startTimer, setupProblemInterval]);

  const startGameWithCountdown = useCallback(() => {
    resetGame(); setCountdownActive(true); setCountdown(3);
    const t = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(t); setCountdownActive(false); startGame(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, [resetGame, startGame]);

  useEffect(() => {
    setProblemBank(problemsSource);
  }, [problemsSource]);

  useEffect(() => {
    if (difficulty <= 2)      { setDifficultyLevel('easy');   setSpeed(8000); }
    else if (difficulty >= 5) { setDifficultyLevel('hard');   setSpeed(5000); }
    else                      { setDifficultyLevel('medium'); setSpeed(6500); }
  }, [difficulty]);

  useEffect(() => () => { stopTimer(); stopProblemInterval(); Object.values(problemTimeoutsRef.current).forEach(clearTimeout); }, [stopTimer, stopProblemInterval]);

  const formatTime    = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const diffText      = () => difficulty <= 2 ? 'Легкий' : difficulty >= 5 ? 'Сложный' : 'Средний';
  const isAnywayPaused = gamePaused || forcePause;

  return (
      <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg overflow-hidden transition-colors">

        {/* ── Шапка ── */}
        <div className="px-4 py-2.5 flex justify-between items-center bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex-shrink-0 transition-colors">
          <div className="flex items-center gap-5 text-sm">
                    <span className="text-gray-700 dark:text-gray-200 font-medium transition-colors">
                        Счёт: <strong>{score}</strong>
                    </span>
            <span className="flex items-center gap-1">
                        <span className="text-gray-600 dark:text-gray-300 transition-colors">Жизни:</span>
                        <span>{Array(Math.max(0, lives)).fill('❤️').join('')}</span>
                    </span>
            <span className="text-yellow-600 dark:text-yellow-400 font-medium transition-colors">
                        {formatTime(timeRemaining)}
                    </span>
          </div>
          <div className="flex items-center gap-2">
            {gameStarted && !gameOver && (
                <button
                    style={{ padding: '0.2rem 0.65rem' }}
                    className={`rounded-lg text-xs font-medium transition-colors ${
                        isAnywayPaused
                            ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30'
                            : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                    }`}
                    onClick={togglePause}
                    disabled={forcePause}
                >
                  {isAnywayPaused ? 'Продолжить' : 'Пауза'}
                </button>
            )}
            <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-500 transition-colors">
                        {diffText()} {difficulty}/5
                    </span>
          </div>
        </div>

        {/* ── Игровая зона ── */}
        <div className="relative flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900 transition-colors">

          {/* Сетка фона */}
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 gap-0.5 pointer-events-none opacity-20">
            {Array(48).fill(0).map((_, i) => (
                <div key={i} className="bg-gray-400 dark:bg-gray-600" />
            ))}
          </div>

          {/* ── Падающие карточки ── */}
          {problems.map(problem => (
              !problem.answered ? (
                  <div
                      key={problem.instanceId}
                      className="absolute rounded-2xl shadow-xl text-center transition-opacity duration-200"
                      style={{
                        left:   `${problem.left}%`,
                        top:    '-120px',
                        width:  `${CARD_WIDTH}px`,
                        transform: 'translateX(-50%)',
                        animation: `derivFall ${speed / 1000}s linear forwards`,
                        animationPlayState: isAnywayPaused ? 'paused' : 'running',
                        opacity:       isAnywayPaused ? 0 : 1,
                        pointerEvents: isAnywayPaused ? 'none' : 'auto',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                      }}
                  >
                    {/* Условие */}
                    <div className="px-4 pt-4 pb-3 border-b border-white/20">
                      <div className="text-xs text-indigo-200 mb-1 font-medium tracking-wide">НАЙДИТЕ ПРОИЗВОДНУЮ</div>
                      <div className="text-white text-xl font-semibold leading-snug katex-display-fix">
                        <M tex={problem.problem} />
                      </div>
                    </div>

                    {/* Варианты ответов */}
                    <div className="grid grid-cols-2 gap-2 p-3">
                      {problem.options.map((opt, i) => (
                          <button
                              key={i}
                              style={{ padding: '0.5rem 0.25rem', minHeight: '48px' }}
                              className="bg-white/15 hover:bg-white/30 active:bg-white/40 text-white rounded-xl transition-all text-sm font-medium flex items-center justify-center"
                              onClick={() => handleAnswerSelect(problem.instanceId, opt, problem.answer)}
                              title={opt}
                          >
                            <M tex={opt} />
                          </button>
                      ))}
                    </div>
                  </div>
              ) : (
                  <div
                      key={problem.instanceId}
                      className="absolute rounded-2xl shadow-xl text-center text-white flex flex-col items-center justify-center gap-1"
                      style={{
                        left:      `${problem.left}%`,
                        top:       '-120px',
                        width:     `${CARD_WIDTH}px`,
                        minHeight: '80px',
                        padding:   '0.75rem',
                        transform: 'translateX(-50%)',
                        animation: 'derivFadeOut 0.7s forwards',
                        backgroundColor: problem.correct ? 'rgb(21,128,61)' : 'rgb(185,28,28)',
                      }}
                  >
                    <div className="text-base font-bold">{problem.correct ? '✓ Верно!' : '✗ Неверно'}</div>
                    {!problem.correct && (
                        <div className="text-xs opacity-90">
                          Ответ: <M tex={problem.answer} />
                        </div>
                    )}
                  </div>
              )
          ))}

          {/* Пауза */}
          {gamePaused && !forcePause && gameStarted && !gameOver && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-30">
                <div className="text-4xl font-bold text-white mb-6">ПАУЗА</div>
                <Button onClick={togglePause} variant="primary">Продолжить</Button>
              </div>
          )}

          {/* Конец игры */}
          {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                <div className="text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl shadow-xl max-w-sm w-full mx-4 transition-colors">
                  <h2 className="text-2xl mb-4 font-bold text-gray-900 dark:text-white">Игра окончена!</h2>
                  <p className="mb-3 text-xl text-gray-900 dark:text-white">
                    Итоговый счёт: <strong>{score}</strong>
                  </p>
                  <div className="mb-6 grid grid-cols-2 gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <div>Заработано:</div>  <div className="font-bold text-green-600 dark:text-green-400">+{pointsEarned}</div>
                    <div>Потеряно:</div>    <div className="font-bold text-red-500 dark:text-red-400">−{pointsLost}</div>
                    <div>Правильных:</div>  <div className="font-bold text-gray-900 dark:text-white">{problemsCompleted}</div>
                    <div>Неверных:</div>    <div className="font-bold text-gray-900 dark:text-white">{problemsIncorrect}</div>
                    <div>Пропущено:</div>   <div className="font-bold text-gray-900 dark:text-white">{3 - lives}</div>
                  </div>
                  <Button onClick={startGameWithCountdown}>Играть снова</Button>
                </div>
              </div>
          )}

          {/* Старт */}
          {!gameStarted && !gameOver && !countdownActive && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl shadow-xl max-w-sm w-full mx-4 transition-colors">
                  <h2 className="text-xl mb-3 font-bold text-gray-900 dark:text-white">
                    Падающие производные
                  </h2>
                  <p className="mb-4 text-gray-600 dark:text-gray-400 text-sm">
                    Нажимайте на правильный ответ до того, как карточка упадёт!
                  </p>
                  <p className="mb-5 text-gray-600 dark:text-gray-400 text-sm">
                    Сложность: <strong className="text-gray-900 dark:text-white">{diffText()} ({difficulty}/5)</strong>
                  </p>
                  <div className="mb-5 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl text-left transition-colors">
                    <p className="font-bold text-gray-900 dark:text-white text-sm mb-2">Правила:</p>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc pl-4 space-y-1">
                      <li>Правильный ответ: <span className="text-green-600 dark:text-green-400 font-medium">+10 очков</span></li>
                      <li>Неправильный: <span className="text-red-500 font-medium">−5 очков</span></li>
                      <li>Пропуск: <span className="text-red-500 font-medium">−5 очков и −1 жизнь</span></li>
                      <li>3 пропуска = конец игры</li>
                      <li>Время: {formatTime(timeLimit)}</li>
                    </ul>
                  </div>
                  <Button onClick={startGameWithCountdown}>Начать игру</Button>
                </div>
              </div>
          )}

          {/* Обратный отсчёт */}
          {countdownActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
                <div className="text-9xl font-bold text-white" style={{ animation: 'derivPulse 1s infinite' }}>
                  {countdown}
                </div>
              </div>
          )}

          {/* Фидбек */}
          {showFeedback && !isAnywayPaused && (
              <div
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl shadow-lg z-40 text-white font-medium text-sm whitespace-nowrap"
                  style={{
                    animation: 'derivBounce 0.5s',
                    backgroundColor: feedbackType === 'success' ? 'rgb(21,128,61)' : 'rgb(185,28,28)',
                  }}
              >
                {feedbackMessage}
              </div>
          )}
        </div>

        <style>{`
                @keyframes derivFall    { 0% { top: -120px; } 100% { top: 105%; } }
                @keyframes derivFadeOut { from { opacity: 1; } to { opacity: 0; transform: translateX(-50%) scale(0.9); } }
                @keyframes derivPulse   { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
                @keyframes derivBounce  { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-8px); } }

                /* KaTeX внутри кнопок — сбрасываем цвет */
                .katex { color: inherit !important; }
                .katex-display-fix .katex { font-size: 1.15em; }
            `}</style>
      </div>
  );
};

export default DerivFall;