import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Интерфейс для задания на интеграл
interface IntegralProblem {
  id: string;
  question: string;
  solutionPieces: string[];
  distractors: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

// Интерфейс для фрагмента решения
interface SolutionPiece {
  id: string;
  text: string;
  isCorrect: boolean;
}

// Интерфейс для пропсов компонента
interface IntegralBuilderProps {
  initialDifficulty?: number;
  timeLimit?: number;
  problemsSource?: IntegralProblem[];
  onComplete?: (score: number, maxScore: number) => void;
}

const IntegralBuilder: React.FC<IntegralBuilderProps> = ({
                                                           initialDifficulty = 3,
                                                           timeLimit = 300,
                                                           problemsSource,
                                                           onComplete
                                                         }) => {
  const [currentProblem, setCurrentProblem] = useState<IntegralProblem | null>(null);
  const [userSolution, setUserSolution] = useState<SolutionPiece[]>([]);
  const [availablePieces, setAvailablePieces] = useState<SolutionPiece[]>([]);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [difficultyLevel, setDifficultyLevel] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [problemBank, setProblemBank] = useState<IntegralProblem[]>([]);
  const [problemsCompleted, setProblemsCompleted] = useState(0);

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Загрузка проблем из источника
  useEffect(() => {
    if (problemsSource && problemsSource.length > 0) {
      setProblemBank(problemsSource);
    } else {
      // Моковые данные, если источник не предоставлен
      setProblemBank([
        {
          id: "i1",
          question: "∫ x² dx",
          solutionPieces: ["x³/3", "+C"],
          distractors: ["x²/2", "3x²", "x³", "2x"],
          difficulty: "easy"
        },
        {
          id: "i2",
          question: "∫ 3x² dx",
          solutionPieces: ["x³", "+C"],
          distractors: ["3x³/3", "3x²/2", "3x", "6x"],
          difficulty: "easy"
        },
        {
          id: "i3",
          question: "∫ sin 2x dx",
          solutionPieces: ["-", "cos 2x/2", "+C"],
          distractors: ["sin 2x/2", "2 sin x", "cos x", "sin x²"],
          difficulty: "medium"
        },
        {
          id: "i4",
          question: "∫ 1/x² dx",
          solutionPieces: ["-", "1/x", "+C"],
          distractors: ["ln|x|", "x⁻¹", "1/2x²", "-x⁻²"],
          difficulty: "medium"
        },
        {
          id: "i5",
          question: "∫ e^x dx",
          solutionPieces: ["e^x", "+C"],
          distractors: ["xe^x", "e^x/x", "ln(e^x)"],
          difficulty: "easy"
        },
        {
          id: "i6",
          question: "∫ 1/x dx",
          solutionPieces: ["ln|x|", "+C"],
          distractors: ["1/x²", "x⁻¹", "1/2x²"],
          difficulty: "medium"
        },
        {
          id: "i7",
          question: "∫ cos x dx",
          solutionPieces: ["sin x", "+C"],
          distractors: ["-cos x", "tan x", "sec x"],
          difficulty: "easy"
        },
        {
          id: "i8",
          question: "∫ (3x² - 4x + 5) dx",
          solutionPieces: ["x³", "-2x²", "+5x", "+C"],
          distractors: ["3x³", "4x²", "-5x", "x²"],
          difficulty: "hard"
        }
      ]);
    }
  }, [problemsSource]);

  // Настройка уровня сложности в зависимости от переданного значения
  useEffect(() => {
    if (initialDifficulty <= 2) {
      setDifficultyLevel('easy');
    } else if (initialDifficulty >= 5) {
      setDifficultyLevel('hard');
    } else {
      setDifficultyLevel('medium');
    }
  }, [initialDifficulty]);

  // Начать новую игру
  const startGame = () => {
    setScore(0);
    setGameOver(false);
    setGameStarted(true);
    setTimeRemaining(timeLimit);
    setProblemsCompleted(0);

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

    loadNewProblem();
  };

  // Завершить игру
  const endGame = () => {
    setGameOver(true);
    setGameStarted(false);
    setFeedback('Время истекло!');

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (onComplete) {
      // Максимально возможное количество решенных задач зависит от сложности
      const maxPossibleScore = problemsCompleted * 10 + 10; // Текущий счет + потенциальная текущая задача
      onComplete(score, maxPossibleScore);
    }
  };

  // Загрузить новую задачу
  const loadNewProblem = () => {
    // Фильтруем задачи по текущему уровню сложности
    const filteredProblems = problemBank.filter(p => {
      if (difficultyLevel === 'easy') return p.difficulty === 'easy';
      if (difficultyLevel === 'medium') return p.difficulty === 'easy' || p.difficulty === 'medium';
      return true; // Для сложного уровня берем все задачи
    });

    if (filteredProblems.length === 0) {
      setFeedback('Нет доступных заданий для текущего уровня сложности');
      return;
    }

    const randomIndex = Math.floor(Math.random() * filteredProblems.length);
    const problem = filteredProblems[randomIndex];
    setCurrentProblem(problem);

    // Создать и перемешать доступные фрагменты (решение + отвлекающие варианты)
    const pieces: SolutionPiece[] = [
      ...problem.solutionPieces.map(piece => ({
        id: `sol-${Math.random()}`,
        text: piece,
        isCorrect: true
      })),
      ...problem.distractors.map(piece => ({
        id: `dis-${Math.random()}`,
        text: piece,
        isCorrect: false
      }))
    ];

    // Перемешивание Fisher-Yates
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }

    setAvailablePieces(pieces);
    setUserSolution([]);
    setFeedback('');
  };

  // Добавить фрагмент в решение
  const addToSolution = (piece: SolutionPiece) => {
    setUserSolution(prev => [...prev, piece]);
    setAvailablePieces(prev => prev.filter(p => p.id !== piece.id));
  };

  // Убрать фрагмент из решения
  const removeFromSolution = (index: number) => {
    const piece = userSolution[index];
    setAvailablePieces(prev => [...prev, piece]);
    setUserSolution(prev => prev.filter((_, i) => i !== index));
  };

  // Проверить решение пользователя
  const checkSolution = () => {
    if (!currentProblem || userSolution.length === 0) {
      setFeedback('Пожалуйста, составьте решение');
      return;
    }

    // Проверка, содержит ли решение все правильные фрагменты и не содержит ли неправильных
    const hasAllCorrectPieces = currentProblem.solutionPieces.every(correctPiece =>
        userSolution.some(piece => piece.text === correctPiece && piece.isCorrect)
    );

    const hasNoIncorrectPieces = userSolution.every(piece => piece.isCorrect);

    if (hasAllCorrectPieces && hasNoIncorrectPieces &&
        userSolution.length === currentProblem.solutionPieces.length) {
      setFeedback('Правильно! Отлично!');
      setScore(prev => prev + 10);
      setProblemsCompleted(prev => prev + 1);

      // Загрузить следующую задачу через небольшую задержку
      setTimeout(loadNewProblem, 1500);
    } else {
      setFeedback('Не совсем верно. Попробуйте еще раз!');
    }
  };

  // Сбросить текущую задачу
  const resetProblem = () => {
    // Вернуть все фрагменты в доступные
    const allPieces = [...userSolution, ...availablePieces];
    setAvailablePieces(allPieces);
    setUserSolution([]);
    setFeedback('');
  };

  // Очистка интервалов при размонтировании
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Форматирование времени
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  return (
      <div className="w-full h-full flex flex-col bg-gray-800 dark:bg-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between bg-gray-700 dark:bg-gray-300 border-b border-gray-600 dark:border-gray-400">
          <div className="flex items-center space-x-6">
            <div className="text-gray-100 dark:text-gray-900 font-medium">
              Счет: <span className="font-bold">{score}</span>
            </div>
            <div className="text-gray-100 dark:text-gray-900 font-medium">
              Задач решено: <span className="font-bold">{problemsCompleted}</span>
            </div>
            <div className="text-yellow-500 dark:text-yellow-600 font-medium">
              Время: {formatTime(timeRemaining)}
            </div>
          </div>

          <div className="flex items-center">
            <div className="text-sm text-gray-300 dark:text-gray-600 mr-2">Сложность:</div>
            <div className="px-2 py-1 rounded-md text-sm font-medium bg-gray-600 dark:bg-gray-400 text-white dark:text-gray-900">
              {difficultyLevel === 'easy' ? 'Легкая' : difficultyLevel === 'medium' ? 'Средняя' : 'Сложная'}
            </div>
          </div>
        </div>

        {(!gameStarted || gameOver) ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center bg-gray-700 dark:bg-gray-300 p-6 rounded-lg shadow-xl max-w-md mx-auto">
                <h2 className="text-xl mb-4 font-bold text-white dark:text-gray-900">
                  {gameOver ? 'Игра окончена!' : 'Собираем интегралы'}
                </h2>
                {gameOver ? (
                    <p className="mb-6 text-xl text-white dark:text-gray-900">
                      Итоговый счет: <span className="font-bold">{score}</span>
                    </p>
                ) : (
                    <p className="mb-4 text-gray-200 dark:text-gray-800">
                      Перетаскивайте фрагменты, чтобы составить правильное решение интеграла.
                    </p>
                )}
                <button
                    className="bg-green-700 dark:bg-green-200 text-white dark:text-gray-900 hover:bg-green-600 dark:hover:bg-green-300 px-6 py-3 rounded-lg text-lg transition-colors"
                    onClick={startGame}
                >
                  {gameOver ? 'Играть снова' : 'Начать игру'}
                </button>
              </div>
            </div>
        ) : (
            <div className="flex-1 p-6 overflow-auto">
              <div className="mb-8 text-center">
                <p className="text-gray-400 dark:text-gray-600 mb-2">Вычислите:</p>
                <div className="text-3xl font-medium py-4 text-gray-100 dark:text-gray-900">
                  {currentProblem?.question}
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-lg mb-3 font-medium text-gray-200 dark:text-gray-800">Ваше решение:</h3>
                <div className="min-h-24 p-4 bg-gray-700 dark:bg-gray-300 rounded-lg flex flex-wrap gap-2 items-center justify-center border-2 border-dashed border-gray-600 dark:border-gray-400">
                  {userSolution.length === 0 ? (
                      <div className="text-gray-400 dark:text-gray-600 italic">
                        Перетащите фрагменты сюда для построения решения
                      </div>
                  ) : (
                      <div className="flex flex-wrap gap-2 justify-center">
                        {userSolution.map((piece, index) => (
                            <motion.div
                                key={piece.id}
                                className="bg-blue-700 dark:bg-blue-200 text-white dark:text-gray-900 px-4 py-2 rounded-lg cursor-pointer font-medium shadow-md"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => removeFromSolution(index)}
                            >
                              {piece.text}
                            </motion.div>
                        ))}
                      </div>
                  )}
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-lg mb-3 font-medium text-gray-200 dark:text-gray-800">Доступные фрагменты:</h3>
                <div className="p-4 bg-gray-700 dark:bg-gray-300 rounded-lg flex flex-wrap gap-3 justify-center">
                  {availablePieces.map(piece => (
                      <motion.div
                          key={piece.id}
                          className="bg-purple-700 dark:bg-purple-200 text-white dark:text-gray-900 px-4 py-2 rounded-lg cursor-pointer font-medium shadow-md"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => addToSolution(piece)}
                      >
                        {piece.text}
                      </motion.div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <button
                    className="bg-red-700 dark:bg-red-200 text-white dark:text-gray-900 px-4 py-2 rounded-lg hover:bg-red-600 dark:hover:bg-red-300 transition-colors shadow-md"
                    onClick={resetProblem}
                >
                  Сбросить
                </button>

                <div className={`text-center text-lg py-2 font-medium ${feedback.includes('Правильно') ? 'text-green-500 dark:text-green-600' : feedback ? 'text-red-500 dark:text-red-600' : ''}`}>
                  {feedback}
                </div>

                <button
                    className="bg-green-700 dark:bg-green-200 text-white dark:text-gray-900 px-4 py-2 rounded-lg hover:bg-green-600 dark:hover:bg-green-300 transition-colors shadow-md"
                    onClick={checkSolution}
                >
                  Проверить
                </button>
              </div>
            </div>
        )}
      </div>
  );
};

export default IntegralBuilder;