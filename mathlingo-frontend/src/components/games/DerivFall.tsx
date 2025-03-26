// src/components/games/DerivFall.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Button from '../Button';

// Интерфейс для задачи на производную
interface DerivativeProblem {
  id: string;
  problem: string;
  options: string[];
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

// Интерфейс для пропсов компонента
interface DerivFallProps {
  difficulty?: number;
  timeLimit?: number;
  problemsSource?: DerivativeProblem[];
  onComplete?: (score: number, maxScore: number) => void;
}

// Стандартные задачи для использования если источник не предоставлен
const DEFAULT_PROBLEMS: DerivativeProblem[] = [
  {
    id: "d1",
    problem: "y'(x) = x³",
    options: ["3x²", "3x⁴", "4x³", "x²"],
    answer: "3x²",
    difficulty: "medium"
  },
  {
    id: "d2",
    problem: "y'(x) = x⁷",
    options: ["7x⁶", "6x⁵", "7x⁸", "x⁶"],
    answer: "7x⁶",
    difficulty: "medium"
  },
  {
    id: "d3",
    problem: "y'(x) = x⁻²",
    options: ["-2x⁻³", "2/x³", "-2/x³", "-x⁻³"],
    answer: "-2x⁻³",
    difficulty: "hard"
  },
  {
    id: "d4",
    problem: "y'(x) = √x",
    options: ["1/(2√x)", "2√x", "1/2√x", "√x/2"],
    answer: "1/(2√x)",
    difficulty: "hard"
  },
  {
    id: "d5",
    problem: "y'(x) = (5x+2)⁻³",
    options: ["-15(5x+2)⁻⁴", "-3(5x+2)⁻⁴", "-5(5x+2)⁻⁴", "-15(5x+2)⁻²"],
    answer: "-15(5x+2)⁻⁴",
    difficulty: "hard"
  },
  {
    id: "d6",
    problem: "y'(x) = sin(x)",
    options: ["cos(x)", "-sin(x)", "tan(x)", "sec²(x)"],
    answer: "cos(x)",
    difficulty: "easy"
  },
  {
    id: "d7",
    problem: "y'(x) = e^x",
    options: ["e^x", "xe^x", "e^(x-1)", "ln(x)e^x"],
    answer: "e^x",
    difficulty: "easy"
  },
  {
    id: "d8",
    problem: "y'(x) = ln(x)",
    options: ["1/x", "ln(x)/x", "x^(-1)", "1/ln(x)"],
    answer: "1/x",
    difficulty: "medium"
  },
  {
    id: "d9",
    problem: "y'(x) = cos(x)",
    options: ["-sin(x)", "sin(x)", "-cos(x)", "tan(x)"],
    answer: "-sin(x)",
    difficulty: "easy"
  },
  {
    id: "d10",
    problem: "y'(x) = tan(x)",
    options: ["sec²(x)", "-csc²(x)", "1/cos²(x)", "sin(x)/cos²(x)"],
    answer: "sec²(x)",
    difficulty: "medium"
  },
  {
    id: "d11",
    problem: "y'(x) = x² + 3x",
    options: ["2x + 3", "2x² + 3", "x + 3", "2x + 3x²"],
    answer: "2x + 3",
    difficulty: "easy"
  },
  {
    id: "d12",
    problem: "y'(x) = x·sin(x)",
    options: ["sin(x) + x·cos(x)", "x·cos(x)", "sin(x) - x·cos(x)", "cos(x) + x·sin(x)"],
    answer: "sin(x) + x·cos(x)",
    difficulty: "medium"
  }
];

const DerivFall: React.FC<DerivFallProps> = ({
                                               difficulty = 3,
                                               timeLimit = 60, // 60 секунд по умолчанию
                                               problemsSource,
                                               onComplete
                                             }) => {
  // Состояние падающих проблем
  const [problems, setProblems] = useState<Array<DerivativeProblem & {
    id: string;
    left: number;
    top: number;
    answered: boolean;
    correct?: boolean;
  }>>([]);

  // Игровые состояния
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePaused, setGamePaused] = useState(false);
  const [difficultyLevel, setDifficultyLevel] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [speed, setSpeed] = useState(3000); // миллисекунды для падения
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [problemBank, setProblemBank] = useState<DerivativeProblem[]>(DEFAULT_PROBLEMS);
  const [problemsCompleted, setProblemsCompleted] = useState(0);
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');

  // Ссылки для доступа к DOM и таймерам
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const problemTimeoutsRef = useRef<{[key: string]: NodeJS.Timeout}>({});

  // Установить сообщение обратной связи
  const setFeedback = useCallback((message: string, type: 'success' | 'error') => {
    setFeedbackMessage(message);
    setFeedbackType(type);
    setShowFeedback(true);

    // Скрываем сообщение через некоторое время
    // Создаем первую задачу с задержкой
    setTimeout(() => {
      console.log("🎮 Создаем первую задачу напрямую");

      const randomIndex = Math.floor(Math.random() * problemBank.length);
      const problem = problemBank[randomIndex];
      const newProblemId = `prob-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

      // Используем новую функцию распределения
      const leftPosition = getDistributedPosition();

      // Добавляем задачу напрямую
      setProblems(prev => [
        ...prev,
        {
          ...problem,
          id: newProblemId,
          left: leftPosition,
          top: 0,
          answered: false
        }
      ]);

      console.log(`✅ Первая задача добавлена: ${problem.problem}`);

      // Настраиваем таймаут для неё
      problemTimeoutsRef.current[newProblemId] = setTimeout(() => {
        setProblems(prev => {
          const problemExists = prev.find(p => p.id === newProblemId && !p.answered);
          if (problemExists) {
            setLives(l => {
              const newLives = l - 1;
              if (newLives <= 0) {
                endGame();
              }
              return newLives;
            });
            setFeedback("Упущенная задача!", "error");
          }
          return prev.filter(p => p.id !== newProblemId);
        });
        delete problemTimeoutsRef.current[newProblemId];
      }, speed + 2000);

      // Запускаем интервал для создания последующих задач с ДОПОЛНИТЕЛЬНОЙ задержкой
      setTimeout(() => {
        const interval = difficultyLevel === 'hard' ? 2500 :
            difficultyLevel === 'medium' ? 3500 : 4500;

        console.log(`🎮 Установка интервала генерации задач: ${interval}ms`);

        gameIntervalRef.current = setInterval(() => {
          if (!gamePaused) {
            createProblem();
          }
        }, interval);
      }, 2000); // Задержка в 2 секунды перед запуском интервала

    }, 800);

  // Загрузка проблем из источника или использование стандартных
  useEffect(() => {
    console.log("Настройка источника данных задач");

    if (problemsSource && problemsSource.length > 0) {
      console.log(`Получено ${problemsSource.length} задач из источника`);
      setProblemBank(problemsSource);
    } else {
      console.log(`Используем ${DEFAULT_PROBLEMS.length} стандартных задач`);
      setProblemBank([...DEFAULT_PROBLEMS]);
    }

    return () => {
      console.log("Очистка источника данных задач");
    };
  }, [problemsSource]); // DEFAULT_PROBLEMS как константа не нужна в зависимостях

  // Настройка уровня сложности в зависимости от переданного значения
  useEffect(() => {
    console.log(`Настройка уровня сложности: ${difficulty}`);
    if (difficulty <= 2) {
      setDifficultyLevel('easy');
      setSpeed(6000);
    } else if (difficulty >= 5) {
      setDifficultyLevel('hard');
      setSpeed(2500);
    } else {
      setDifficultyLevel('medium');
      setSpeed(4000);
    }
  }, [difficulty]);

  // Завершить игру
  const endGame = useCallback(() => {
    console.log("Завершение игры");
    setGameOver(true);
    setGameStarted(false);
    setGamePaused(false);

    // Очищаем все таймеры
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (gameIntervalRef.current) {
      clearInterval(gameIntervalRef.current);
      gameIntervalRef.current = null;
    }

    // Очищаем таймеры для задач
    Object.values(problemTimeoutsRef.current).forEach(clearTimeout);
    problemTimeoutsRef.current = {};

    // Вызываем обратный вызов с результатами
    if (onComplete) {
      // Максимально возможный счет зависит от времени и частоты появления задач
      const maxPossibleScore = Math.max(10, problemsCompleted * 10); // Минимум 10 очков
      onComplete(score, maxPossibleScore);
    }
  }, [score, problemsCompleted, onComplete]);

  // Создать новую падающую задачу
  const createProblem = useCallback(() => {
    // Добавляем отладочный лог
    console.log("💡 createProblem вызвана", { lives, gameOver, gameStarted, gamePaused, problemBankLength: problemBank.length });

    // Проверяем условия
    if (lives <= 0) {
      console.log("❌ Создание задачи отменено: нет жизней");
      return;
    }

    if (gameOver) {
      console.log("❌ Создание задачи отменено: игра окончена");
      return;
    }

    if (!gameStarted) {
      console.log("❌ Создание задачи отменено: игра не начата");
      return;
    }

    if (gamePaused) {
      console.log("❌ Создание задачи отменено: игра на паузе");
      return;
    }

    if (problemBank.length === 0) {
      console.error("❌ No problems available!");
      setFeedback("Ошибка: задания не найдены", "error");
      return;
    }

    console.log(`🔍 Создание новой задачи. Сложность: ${difficultyLevel}, Доступно задач: ${problemBank.length}`);

    // Фильтруем задачи по текущему уровню сложности
    let filteredProblems = problemBank.filter(p => {
      if (difficultyLevel === 'easy') return p.difficulty === 'easy';
      if (difficultyLevel === 'medium') return p.difficulty === 'easy' || p.difficulty === 'medium';
      return true; // Для сложного уровня берем все задачи
    });

    console.log(`🔍 После фильтрации осталось задач: ${filteredProblems.length}`);

    if (filteredProblems.length === 0) {
      console.warn(`⚠️ После фильтрации по сложности '${difficultyLevel}' задач не осталось!`);
      console.log("ℹ️ Используем все доступные задачи без фильтрации по сложности");
      filteredProblems = [...problemBank];

      if (filteredProblems.length === 0) {
        console.error("❌ Всё ещё нет доступных задач!");
        setFeedback("Нет доступных заданий!", "error");
        return;
      }
    }

    const randomIndex = Math.floor(Math.random() * filteredProblems.length);
    const problem = filteredProblems[randomIndex];
    const newProblemId = `prob-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

    // Используем функцию getDistributedPosition вместо простого Math.random()
    const getDistributedPosition = () => {
      // Находим все текущие горизонтальные позиции задач
      const currentPositions = problems.map(p => p.left);

      // Пробуем 5 раз найти позицию, не близкую к существующим
      for (let i = 0; i < 5; i++) {
        const sector = Math.floor(Math.random() * 4); // 4 сектора
        const newPos = (sector * 20) + (Math.random() * 15);

        // Проверяем, нет ли рядом других задач (на расстоянии менее 20%)
        const isTooClose = currentPositions.some(pos => Math.abs(pos - newPos) < 20);
        if (!isTooClose) {
          return newPos; // Нашли хорошую позицию
        }
      }

      // Если не нашли хорошую позицию, возвращаем случайную
      return Math.random() * 70;
    };

    const leftPosition = getDistributedPosition();

    // Добавляем новую задачу
    console.log(`✅ Добавляем задачу ${newProblemId}: ${problem.problem}`);

    // Важно: используем функциональное обновление для состояния
    setProblems(prev => {
      const newProblems = [...prev, {
        ...problem,
        id: newProblemId,
        left: leftPosition,
        top: 0, // Начальная позиция (в процентах)
        answered: false
      }];
      console.log(`📊 Всего задач после добавления: ${newProblems.length}`);
      return newProblems;
    });

    // Запланировать удаление задачи после того, как она выпадет из поля зрения
    problemTimeoutsRef.current[newProblemId] = setTimeout(() => {
      console.log(`⏱️ Таймаут для задачи ${newProblemId} сработал`);

      setProblems(prev => {
        const problemExists = prev.find(p => p.id === newProblemId && !p.answered);
        if (problemExists) {
          // Задача упала без ответа
          console.log(`❌ Задача ${newProblemId} упала без ответа`);
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) {
              console.log("☠️ Все жизни потеряны, игра завершается");
              endGame();
            }
            return newLives;
          });

          setFeedback("Упущенная задача!", "error");
        }
        return prev.filter(p => p.id !== newProblemId);
      });

      // Удаляем таймер из списка
      delete problemTimeoutsRef.current[newProblemId];
    }, speed + 2000); // Время падения + буфер
  }, [difficultyLevel, problemBank, lives, gameOver, gameStarted, gamePaused, speed, setFeedback, endGame]);

  // Обработать выбор ответа
  const handleAnswerSelect = useCallback((problemId: string, selectedOption: string, correctAnswer: string) => {
    // Отмечаем задачу как отвеченную
    setProblems(prev =>
        prev.map(p => p.id === problemId ?
            {...p, answered: true, correct: selectedOption === correctAnswer} : p)
    );

    // Убираем таймер удаления для этой задачи
    if (problemTimeoutsRef.current[problemId]) {
      clearTimeout(problemTimeoutsRef.current[problemId]);
      delete problemTimeoutsRef.current[problemId];
    }

    if (selectedOption === correctAnswer) {
      console.log(`Правильный ответ для задачи ${problemId}`);
      setScore(s => s + 10);
      setProblemsCompleted(p => p + 1);
      setFeedback("Правильно! +10 очков", "success");
    } else {
      console.log(`Неправильный ответ для задачи ${problemId}`);
      setFeedback(`Неверно! Правильный ответ: ${correctAnswer}`, "error");
    }

    // Удалить задачу после ответа с анимацией
    setTimeout(() => {
      setProblems(prev => prev.filter(p => p.id !== problemId));
    }, 800);
  }, [setFeedback]);

  // Сбросить игру
  const resetGame = useCallback(() => {
    // Очищаем все таймеры
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (gameIntervalRef.current) {
      clearInterval(gameIntervalRef.current);
      gameIntervalRef.current = null;
    }

    // Очищаем таймеры для задач
    Object.values(problemTimeoutsRef.current).forEach(clearTimeout);
    problemTimeoutsRef.current = {};

    // Сбрасываем состояния
    setProblems([]);
    setScore(0);
    setLives(3);
    setGameOver(false);
    setGameStarted(false);
    setGamePaused(false);
    setTimeRemaining(timeLimit);
    setProblemsCompleted(0);
    setShowFeedback(false);
  }, [timeLimit]);

  // Начать игру
  const startGame = useCallback(() => {
    console.log("💡 startGame вызвана, gameStarted =", gameStarted);

    // Повторно устанавливаем gameStarted, чтобы гарантировать обновление
    setGameStarted(true);
    setGamePaused(false);

    // Очистим все таймеры перед новой игрой
    if (timerRef.current) clearInterval(timerRef.current);
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    Object.values(problemTimeoutsRef.current).forEach(clearTimeout);
    problemTimeoutsRef.current = {};

    // Настроить скорость в зависимости от сложности
    switch(difficultyLevel) {
      case 'easy': setSpeed(6000); break;
      case 'medium': setSpeed(4000); break;
      case 'hard': setSpeed(2500); break;
    }

    // Запустить таймер игры
    timerRef.current = setInterval(() => {
      if (!gamePaused) {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            console.log("⏱️ Время вышло, игра завершается");
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    // ВАЖНО: не используйте привязку к стейту gameStarted тут
    // Создаем первую задачу вручную (не через createProblem)
    // чтобы обойти проверку на gameStarted
    console.log("🎮 Создаем первую задачу напрямую");

    const randomIndex = Math.floor(Math.random() * problemBank.length);
    const problem = problemBank[randomIndex];
    const newProblemId = `prob-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const leftPosition = Math.random() * 70;

    // Добавляем задачу напрямую
    setProblems(prev => [
      ...prev,
      {
        ...problem,
        id: newProblemId,
        left: leftPosition,
        top: 0,
        answered: false
      }
    ]);

    console.log(`✅ Первая задача добавлена: ${problem.problem}`);

    // Настраиваем таймаут для неё
    problemTimeoutsRef.current[newProblemId] = setTimeout(() => {
      setProblems(prev => {
        const problemExists = prev.find(p => p.id === newProblemId && !p.answered);
        if (problemExists) {
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) {
              endGame();
            }
            return newLives;
          });
          setFeedback("Упущенная задача!", "error");
        }
        return prev.filter(p => p.id !== newProblemId);
      });
      delete problemTimeoutsRef.current[newProblemId];
    }, speed + 2000);

    // Запускаем интервал для создания последующих задач
    const interval = difficultyLevel === 'hard' ? 2500 :
        difficultyLevel === 'medium' ? 3500 : 4500;

    console.log(`🎮 Установка интервала генерации задач: ${interval}ms`);

    gameIntervalRef.current = setInterval(() => {
      if (!gamePaused) {
        createProblem();
      }
    }, interval);

  }, [difficultyLevel, problemBank, speed, setFeedback, endGame]);

  // Начать игру с обратным отсчетом
  const startGameWithCountdown = useCallback(() => {
    resetGame();
    setCountdownActive(true);
    setCountdown(3);

    // Запускаем обратный отсчет
    const countdownTimer = setInterval(() => {
      setCountdown(prev => {
        const newCount = prev - 1;
        if (newCount <= 0) {
          clearInterval(countdownTimer);
          setCountdownActive(false);

          // Сразу устанавливаем gameStarted в true перед вызовом startGame
          setGameStarted(true);

          // Небольшая задержка перед запуском
          setTimeout(() => {
            startGame();
          }, 100);

          return 0;
        }
        return newCount;
      });
    }, 1000);
  }, [resetGame, startGame]);

  // Поставить игру на паузу
  const togglePause = useCallback(() => {
    setGamePaused(prev => !prev);
  }, []);

  // Очистка интервалов при размонтировании
  useEffect(() => {
    return () => {
      console.log("Размонтирование компонента, очистка ресурсов");
      if (timerRef.current) clearInterval(timerRef.current);
      if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);

      // Очищаем таймеры для задач
      Object.values(problemTimeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

  // Форматирование времени
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  return (
      <div className="w-full h-full flex flex-col bg-gray-700 dark:bg-gray-200 rounded-lg overflow-hidden transition-colors">
        {/* Верхняя панель */}
        <div className="px-4 py-3 flex justify-between items-center bg-gray-600 dark:bg-gray-300 border-b border-gray-500 dark:border-gray-400 transition-colors">
          <div className="flex items-center space-x-6">
            <div className="text-gray-100 dark:text-gray-900 font-medium transition-colors">
              Счет: <span className="font-bold">{score}</span>
            </div>
            <div className="flex items-center">
              <span className="text-gray-100 dark:text-gray-900 mr-2 transition-colors">Жизни:</span>
              <span className="text-red-500 dark:text-red-600 transition-colors">{Array(lives).fill('❤️').join('')}</span>
            </div>

            <div className="text-yellow-500 dark:text-yellow-600 font-medium transition-colors">
              Время: {formatTime(timeRemaining)}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {gameStarted && !gameOver && (
                <button
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                        gamePaused
                            ? 'bg-green-700 dark:bg-green-200 text-white dark:text-gray-900'
                            : 'bg-amber-700 dark:bg-amber-200 text-white dark:text-gray-900'
                    } transition-colors`}
                    onClick={togglePause}
                >
                  {gamePaused ? 'Продолжить' : 'Пауза'}
                </button>
            )}

            <div className="px-2 py-1 rounded-md text-sm font-medium bg-gray-500 dark:bg-gray-400 text-white dark:text-gray-900 transition-colors">
              {difficultyLevel === 'easy' ? 'Легкий' : difficultyLevel === 'medium' ? 'Средний' : 'Сложный'}
            </div>
          </div>
        </div>

        {/* Игровая область */}
        <div
            ref={gameAreaRef}
            className="relative flex-1 overflow-hidden bg-gray-700 dark:bg-gray-200 transition-colors"
            style={{height: '500px', position: 'relative'}} // Добавляем position: 'relative'
        >
          {/* Падающие задачи */}
          {problems.map(problem => (
              !problem.answered ? (
                  <div
                      key={problem.id}
                      className="absolute bg-blue-700 dark:bg-blue-200 p-3 rounded-lg shadow-lg text-center transition-colors"
                      style={{
                        left: `${problem.left}%`,
                        top: '-80px',
                        width: '250px', // Фиксированная ширина
                        transform: `translateX(-50%)`, // Центрирование относительно позиции
                        animation: gamePaused ? 'none' : `fallNew ${speed / 1000}s linear forwards`,
                        zIndex: parseInt(problem.id.split('-')[1]) % 10, // Разные уровни z-index
                      }}
                  >
                    <div className="text-lg mb-2 font-medium text-white dark:text-gray-900 transition-colors">
                      {problem.problem}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {problem.options.map((option, idx) => (
                          <button
                              key={idx}
                              className="bg-purple-700 dark:bg-purple-200 text-white dark:text-gray-900 hover:bg-purple-600 dark:hover:bg-purple-300 px-2 py-1 rounded-lg transition-colors"
                              onClick={() => handleAnswerSelect(problem.id, option, problem.answer)}
                              disabled={gamePaused}
                          >
                            {option}
                          </button>
                      ))}
                    </div>
                  </div>
              ) : (
                  <div
                      key={problem.id}
                      className="absolute p-3 rounded-lg shadow-lg text-center w-64 transition-colors"
                      style={{
                        left: `${problem.left}%`,
                        top: `${problem.top}%`,
                        animation: 'fadeOut 0.8s forwards',
                        backgroundColor: problem.correct
                            ? 'var(--bg-green-700, rgb(21, 128, 61))'
                            : 'var(--bg-red-700, rgb(185, 28, 28))',
                        color: 'white'
                      }}
                  >
                    <div className="text-lg mb-2 font-medium text-white dark:text-gray-900 transition-colors">
                      {problem.problem}
                    </div>
                    <div className="font-bold">
                      {problem.correct ? 'Верно!' : `Ответ: ${problem.answer}`}
                    </div>
                  </div>
              )
          ))}

          {/* Наложение паузы */}
          {gamePaused && gameStarted && !gameOver && (
              <div
                  className="absolute inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex flex-col items-center justify-center z-30 transition-colors">
                <div className="text-4xl font-bold text-white mb-6">ПАУЗА</div>
                <Button
                    onClick={togglePause}
                    variant="primary"
                >
                  Продолжить
                </Button>
              </div>
          )}

          {/* Экран окончания игры */}
          {gameOver && (
              <div
                  className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 dark:bg-opacity-70 z-20 transition-colors">
                <div
                    className="text-center bg-gray-600 dark:bg-gray-300 p-6 rounded-lg shadow-xl max-w-md mx-auto transition-colors">
                  <h2 className="text-2xl mb-4 font-bold text-white dark:text-gray-900 transition-colors">Игра
                    окончена!</h2>
                  <p className="mb-6 text-xl text-white dark:text-gray-900 transition-colors">
                    Итоговый счет: <span className="font-bold">{score}</span>
                  </p>
                  <p className="mb-6 text-gray-300 dark:text-gray-700 transition-colors">
                    Решено задач: <span className="font-bold">{problemsCompleted}</span>
                  </p>
                  <Button
                      onClick={startGameWithCountdown}
                  >
                    Играть снова
                  </Button>
                </div>
              </div>
          )}

          {/* Экран начала игры */}
          {!gameStarted && !gameOver && !countdownActive && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div
                    className="text-center bg-gray-600 dark:bg-gray-300 p-6 rounded-lg shadow-xl max-w-md mx-auto transition-colors">
                  <h2 className="text-xl mb-4 font-bold text-white dark:text-gray-900 transition-colors">
                    Игра "Падающие производные"
                  </h2>
                  <p className="mb-4 text-gray-200 dark:text-gray-800 transition-colors">
                    Решайте задачи на нахождение производных до того, как они упадут!
                  </p>
                  <p className="mb-6 text-gray-200 dark:text-gray-800 transition-colors">
                    Сложность: <span className="font-medium">
                  {difficultyLevel === 'easy' ? 'Легкая' : difficultyLevel === 'medium' ? 'Средняя' : 'Сложная'}
                </span>
                  </p>
                  <div className="mb-4 p-4 bg-gray-500 dark:bg-gray-400 rounded-lg transition-colors">
                    <h3 className="font-bold text-white dark:text-gray-900 mb-2 transition-colors">Как играть:</h3>
                    <ul className="text-left text-gray-200 dark:text-gray-800 list-disc pl-5 transition-colors">
                      <li>Выбирайте правильный ответ из вариантов</li>
                      <li>Выберите до того, как задача упадет</li>
                      <li>За каждый правильный ответ +10 очков</li>
                      <li>3 упущенные задачи = конец игры</li>
                    </ul>
                  </div>
                  <Button
                      onClick={startGameWithCountdown}
                  >
                    Начать игру
                  </Button>
                </div>
              </div>
          )}

          {/* Обратный отсчет перед началом */}
          {countdownActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-30">
                <div className="text-9xl font-bold text-white" style={{animation: 'pulse 1.5s infinite'}}>
                  {countdown}
                </div>
              </div>
          )}

          {/* Уведомление с обратной связью */}
          {showFeedback && (
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-40"
                   style={{
                     animation: 'bounce 0.5s',
                     backgroundColor: feedbackType === 'success'
                         ? 'var(--bg-green-700, rgb(21, 128, 61))'
                         : 'var(--bg-red-700, rgb(185, 28, 28))',
                     color: 'white'
                   }}>
                {feedbackMessage}
              </div>
          )}

          {/* Добавляем фоновую сетку для лучшего визуального восприятия */}
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 gap-0.5 pointer-events-none">
            {Array(48).fill(0).map((_, idx) => (
                <div key={idx}
                     className="bg-gray-600 dark:bg-gray-300 bg-opacity-20 dark:bg-opacity-20 transition-colors"></div>
            ))}
          </div>
        </div>

        {/* Стили для анимаций */}
        <style>
          {`
          @keyframes fall {
            from { top: -20px; }
            to { top: 100%; }
          }
          
          @keyframes fallTransform {
            from { transform: translateY(-20px); }
            to { transform: translateY(calc(100vh - 100px)); }
          }
          
          @keyframes fallNew {
            0% { top: -80px; }
            100% { top: 100%; }
          }
          
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
          
          @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.05); }
            100% { opacity: 1; transform: scale(1); }
          }
          
          @keyframes bounce {
            0%, 100% { transform: translateX(-50%) translateY(0); }
            50% { transform: translateX(-50%) translateY(-10px); }
          }
        `}
        </style>
      </div>
  );
};

export default DerivFall;