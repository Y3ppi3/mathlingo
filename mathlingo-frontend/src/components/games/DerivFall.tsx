import React, { useState, useEffect, useRef } from 'react';

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

const DerivFall: React.FC<DerivFallProps> = ({
                                               difficulty = 3,
                                               timeLimit = 60, // Сокращаем с 120 до 60 секунд
                                               problemsSource,
                                               onComplete
                                             }) => {
  const [problems, setProblems] = useState<Array<DerivativeProblem & {
    id: string;
    left: number;
    answered: boolean;
  }>>([]);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [difficultyLevel, setDifficultyLevel] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [speed, setSpeed] = useState(3000); // milliseconds to fall
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [problemBank, setProblemBank] = useState<DerivativeProblem[]>([]);

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Стандартные задачи, если источник не предоставлен
  const defaultProblems: DerivativeProblem[] = [
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
    }
  ];

  // Загрузка проблем из источника или использование стандартных
  useEffect(() => {
    if (problemsSource && problemsSource.length > 0) {
      setProblemBank(problemsSource);
    } else {
      setProblemBank(defaultProblems);
    }
  }, [problemsSource]);

  // Настройка уровня сложности в зависимости от переданного значения
  useEffect(() => {
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

  // Создать новую падающую задачу
  const createProblem = () => {
    if (lives <= 0 || gameOver || !gameStarted) return;

    if (problemBank.length === 0) {
      console.error("No problems available!");
      return;
    }

    // Фильтруем задачи по текущему уровню сложности
    const filteredProblems = problemBank.filter(p => {
      if (difficultyLevel === 'easy') return p.difficulty === 'easy';
      if (difficultyLevel === 'medium') return p.difficulty === 'easy' || p.difficulty === 'medium';
      return true; // Для сложного уровня берем все задачи
    });

    if (filteredProblems.length === 0) return;

    const randomIndex = Math.floor(Math.random() * filteredProblems.length);
    const problem = filteredProblems[randomIndex];
    const newProblemId = Date.now().toString();

    const leftPosition = Math.random() * 80; // Случайная горизонтальная позиция (0-80%)

    setProblems(prev => [...prev, {
      ...problem,
      id: newProblemId,
      left: leftPosition,
      answered: false
    }]);

    // Запланировать удаление задачи после того, как она выпадет из поля зрения
    setTimeout(() => {
      setProblems(prev => {
        const problemExists = prev.find(p => p.id === newProblemId && !p.answered);
        if (problemExists) {
          // Задача упала без ответа
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) endGame();
            return newLives;
          });
        }
        return prev.filter(p => p.id !== newProblemId);
      });
    }, speed + 2000); // Время падения + буфер
  };

  // Обработать выбор ответа
  const handleAnswerSelect = (problemId: string, selectedOption: string, correctAnswer: string) => {
    setProblems(prev =>
        prev.map(p => p.id === problemId ? {...p, answered: true} : p)
    );

    if (selectedOption === correctAnswer) {
      setScore(s => s + 10);
    }

    // Удалить задачу после ответа
    setTimeout(() => {
      setProblems(prev => prev.filter(p => p.id !== problemId));
    }, 500);
  };

  // Начать игру
  const startGame = () => {
    setProblems([]);
    setScore(0);
    setLives(3);
    setGameOver(false);
    setGameStarted(true);
    setTimeRemaining(timeLimit);

    // Настроить скорость в зависимости от сложности
    switch(difficultyLevel) {
      case 'easy': setSpeed(6000); break;
      case 'medium': setSpeed(4000); break;
      case 'hard': setSpeed(2500); break;
    }

    // Запустить таймер игры
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Запустить генерацию заданий
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);

    // Создаем первую задачу сразу
    setTimeout(() => createProblem(), 500);

    // Запускаем интервал для создания последующих задач
    gameIntervalRef.current = setInterval(() => {
      createProblem();
    }, difficultyLevel === 'hard' ? 3000 : difficultyLevel === 'medium' ? 4000 : 5000);
  };

  // Завершить игру
  const endGame = () => {
    setGameOver(true);
    setGameStarted(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (gameIntervalRef.current) {
      clearInterval(gameIntervalRef.current);
      gameIntervalRef.current = null;
    }

    if (onComplete) {
      // Максимально возможный счет зависит от времени и частоты появления задач
      const maxPossibleScore = Math.ceil(timeLimit / (difficultyLevel === 'hard' ? 3 : difficultyLevel === 'medium' ? 4 : 5)) * 10;
      onComplete(score, maxPossibleScore);
    }
  };

  // Очистка интервалов при размонтировании
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    };
  }, []);

  // Форматирование времени
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  return (
      <div className="w-full h-full flex flex-col bg-gray-700 dark:bg-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between bg-gray-600 dark:bg-gray-300 border-b border-gray-500 dark:border-gray-400">
          <div className="flex items-center space-x-6">
            <div className="text-gray-100 dark:text-gray-900 font-medium">
              Счет: <span className="font-bold">{score}</span>
            </div>
            <div className="flex items-center">
              <span className="text-gray-100 dark:text-gray-900 mr-2">Жизни:</span>
              <span className="text-red-500 dark:text-red-600">{Array(lives).fill('❤️').join('')}</span>
            </div>

            <div className="text-yellow-500 dark:text-yellow-600 font-medium">
              Время: {formatTime(timeRemaining)}
            </div>
          </div>

          <div className="flex items-center">
            <div className="text-sm text-gray-300 dark:text-gray-600 mr-2">Сложность:</div>
            <div className="px-2 py-1 rounded-md text-sm font-medium bg-gray-500 dark:bg-gray-400 text-white dark:text-gray-900">
              {difficultyLevel === 'easy' ? 'Легкая' : difficultyLevel === 'medium' ? 'Средняя' : 'Сложная'}
            </div>
          </div>
        </div>

        <div
            ref={gameAreaRef}
            className="relative flex-1 overflow-hidden bg-gray-700 dark:bg-gray-200"
        >
          {/* Падающие задачи */}
          {problems.map(problem => (
              !problem.answered && (
                  <div
                      key={problem.id}
                      className="absolute bg-blue-700 dark:bg-blue-200 p-3 rounded-lg shadow-lg text-center w-64 z-10"
                      style={{
                        left: `${problem.left}%`,
                        top: '0',
                        animation: `fall ${speed / 1000}s linear forwards`
                      }}
                  >
                    <div className="text-lg mb-2 font-medium text-white dark:text-gray-900">
                      {problem.problem}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {problem.options.map((option, idx) => (
                          <button
                              key={idx}
                              className="bg-purple-700 dark:bg-purple-200 text-white dark:text-gray-900 hover:bg-purple-600 dark:hover:bg-purple-300 px-2 py-1 rounded-lg transition-colors"
                              onClick={() => handleAnswerSelect(problem.id, option, problem.answer)}
                          >
                            {option}
                          </button>
                      ))}
                    </div>
                  </div>
              )
          ))}

          {/* Экран окончания игры */}
          {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 dark:bg-opacity-70 z-20">
                <div className="text-center bg-gray-600 dark:bg-gray-300 p-6 rounded-lg shadow-xl max-w-md mx-auto">
                  <h2 className="text-2xl mb-4 font-bold text-white dark:text-gray-900">Игра окончена!</h2>
                  <p className="mb-6 text-xl text-white dark:text-gray-900">
                    Итоговый счет: <span className="font-bold">{score}</span>
                  </p>
                  <button
                      className="bg-green-700 dark:bg-green-200 text-white dark:text-gray-900 hover:bg-green-600 dark:hover:bg-green-300 px-6 py-3 rounded-lg text-lg transition-colors"
                      onClick={startGame}
                  >
                    Играть снова
                  </button>
                </div>
              </div>
          )}

          {/* Экран начала игры */}
          {!gameStarted && !gameOver && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="text-center bg-gray-600 dark:bg-gray-300 p-6 rounded-lg shadow-xl max-w-md mx-auto">
                  <h2 className="text-xl mb-4 font-bold text-white dark:text-gray-900">
                    Игра "Падающие производные"
                  </h2>
                  <p className="mb-4 text-gray-200 dark:text-gray-800">
                    Решайте задачи на нахождение производных до того, как они упадут!
                  </p>
                  <p className="mb-6 text-gray-200 dark:text-gray-800">
                    Сложность: <span className="font-medium">
                  {difficultyLevel === 'easy' ? 'Легкая' : difficultyLevel === 'medium' ? 'Средняя' : 'Сложная'}
                </span>
                  </p>
                  <button
                      className="bg-green-700 dark:bg-green-200 text-white dark:text-gray-900 hover:bg-green-600 dark:hover:bg-green-300 px-6 py-3 rounded-lg text-lg transition-colors"
                      onClick={startGame}
                  >
                    Начать игру
                  </button>
                </div>
              </div>
          )}

          {/* Добавляем фоновую сетку для лучшего визуального восприятия */}
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 gap-0.5 pointer-events-none">
            {Array(48).fill(0).map((_, idx) => (
                <div key={idx} className="bg-gray-600 dark:bg-gray-300 bg-opacity-20 dark:bg-opacity-20"></div>
            ))}
          </div>
        </div>

        {/* CSS для анимации падения */}
        <style jsx>{`
        @keyframes fall {
          from { top: -100px; }
          to { top: 100%; }
        }
      `}</style>
      </div>
  );
};

export default DerivFall;