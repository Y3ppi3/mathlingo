// src/components/games/DerivFall.tsx
import React, { useState, useEffect, useRef } from 'react';
import Button from '../Button';
import ProgressBar from '../ui/ProgressBar';

interface Expression {
  id: number;
  text: string;
  solution: string;
  position: number; // позиция по вертикали (в процентах)
  lane: number; // полоса (колонка) для падения
  speed: number; // скорость падения
}

interface DerivFallProps {
  difficulty: number; // от 1 до 5
  timeLimit: number; // в секундах
  onComplete: (score: number, maxScore: number) => void;
}

// Готовый набор выражений и их производных
const expressionSets = [
  // Простые (уровень 1)
  [
    { text: 'x^2', solution: '2x' },
    { text: '3x', solution: '3' },
    { text: 'x^3', solution: '3x^2' },
    { text: '5x^2', solution: '10x' },
    { text: '2x + 1', solution: '2' },
  ],
  // Средние (уровень 2)
  [
    { text: 'sin(x)', solution: 'cos(x)' },
    { text: 'cos(x)', solution: '-sin(x)' },
    { text: 'e^x', solution: 'e^x' },
    { text: 'ln(x)', solution: '1/x' },
    { text: 'x^2 + 2x', solution: '2x + 2' },
  ],
  // Сложные (уровень 3)
  [
    { text: 'x^2 * sin(x)', solution: '2x*sin(x) + x^2*cos(x)' },
    { text: 'e^x * cos(x)', solution: 'e^x*cos(x) - e^x*sin(x)' },
    { text: 'ln(x^2 + 1)', solution: '2x/(x^2 + 1)' },
    { text: 'sqrt(x)', solution: '1/(2*sqrt(x))' },
    { text: 'sin(x^2)', solution: '2x*cos(x^2)' },
  ],
  // Очень сложные (уровень 4-5)
  [
    { text: '(x^2 + 1)/(x - 1)', solution: '(2x*(x-1) - (x^2+1))/((x-1)^2)' },
    { text: 'tan(x)', solution: '1/cos(x)^2' },
    { text: 'arcsin(x)', solution: '1/sqrt(1-x^2)' },
    { text: 'x*e^(-x^2)', solution: 'e^(-x^2) - 2x^2*e^(-x^2)' },
    { text: 'ln(sin(x))', solution: 'cos(x)/sin(x)' },
  ]
];

const DerivFall: React.FC<DerivFallProps> = ({ difficulty = 1, timeLimit = 60, onComplete }) => {
  const lanes = 3; // Количество дорожек для падения выражений
  const expressionHeight = 8; // Высота блока с выражением в процентах
  const maxSpeed = 0.2 + (difficulty * 0.15); // Максимальная скорость в % от высоты в мс
  const minSpeed = 0.05 + (difficulty * 0.05); // Минимальная скорость

  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [userInput, setUserInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [currentExpression, setCurrentExpression] = useState<Expression | null>(null);
  const [totalDropped, setTotalDropped] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const expressionIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Набор выражений в зависимости от сложности
  const getRandomExpression = () => {
    const difficultyIndex = Math.min(Math.floor((difficulty + level - 1) / 2), expressionSets.length - 1);
    const set = expressionSets[difficultyIndex];
    return set[Math.floor(Math.random() * set.length)];
  };

  // Запуск игры
  const startGame = () => {
    setGameStarted(true);
    setScore(0);
    setTimeLeft(timeLimit);
    setExpressions([]);
    setLives(3);
    setLevel(1);
    setTotalDropped(0);

    // Фокус на поле ввода
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // Запуск таймера
    const timer = setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          clearInterval(timer);
          endGame();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    // Генерация выражений
    expressionIntervalRef.current = setInterval(() => {
      if (!isPaused) {
        generateExpression();
      }
    }, 2000 / (0.5 + difficulty * 0.5)); // Частота появления зависит от сложности

    // Запуск анимации
    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(updateGame);

    return () => {
      clearInterval(timer);
      if (expressionIntervalRef.current) {
        clearInterval(expressionIntervalRef.current);
      }
      cancelAnimationFrame(animationFrameRef.current);
    };
  };

  // Генерация нового выражения
  const generateExpression = () => {
    const expr = getRandomExpression();
    const newExpression: Expression = {
      id: Date.now(),
      text: expr.text,
      solution: expr.solution,
      position: 0, // Верх экрана
      lane: Math.floor(Math.random() * lanes),
      speed: minSpeed + Math.random() * (maxSpeed - minSpeed)
    };

    setExpressions(prev => [...prev, newExpression]);

    // Если нет текущего выбранного выражения, выбираем это
    if (!currentExpression) {
      setCurrentExpression(newExpression);
    }
  };

  // Обновление состояния игры
  const updateGame = (time: number) => {
    if (gameOver || isPaused) {
      return;
    }

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    setExpressions(prevExpressions => {
      const updatedExpressions = prevExpressions.map(expr => {
        // Обновление позиции
        const newPosition = expr.position + expr.speed * (deltaTime / 10);

        // Если выражение достигло дна
        if (newPosition >= 100 - expressionHeight) {
          // Если это было текущее выражение, снимаем фокус
          if (currentExpression && currentExpression.id === expr.id) {
            setCurrentExpression(null);
          }

          // Уменьшаем жизнь, если выражение упало
          if (lives > 0) {
            setLives(prevLives => prevLives - 1);

            // Проверка на конец игры
            if (lives === 1) {
              endGame();
            }
          }

          // Сбрасываем ввод пользователя
          setUserInput('');

          // Показываем отрицательный фидбек
          setFeedback(`Упало: ${expr.text}, ответ: ${expr.solution}`);
          setShowFeedback(true);
          setTimeout(() => setShowFeedback(false), 2000);

          // Увеличиваем счетчик упавших выражений
          setTotalDropped(prev => prev + 1);

          // Удаляем выражение
          return { ...expr, position: -1000 }; // Помечаем для удаления
        }

        return { ...expr, position: newPosition };
      });

      // Удаляем выражения, которые упали за пределы экрана
      return updatedExpressions.filter(expr => expr.position !== -1000);
    });

    // Повышение уровня каждые 5 правильных ответов
    if (score > 0 && score % 5 === 0 && level < 5) {
      setLevel(prevLevel => Math.min(prevLevel + 1, 5));
    }

    animationFrameRef.current = requestAnimationFrame(updateGame);
  };

  // Проверка ответа пользователя
  const checkAnswer = () => {
    if (!currentExpression) return;

    // Нормализация ввода и правильного ответа для сравнения
    const normalizedInput = userInput.trim().toLowerCase()
        .replace(/\s+/g, '')
        .replace(/(\d)x/g, '$1*x')
        .replace(/\^/g, '**');

    const normalizedSolution = currentExpression.solution.trim().toLowerCase()
        .replace(/\s+/g, '')
        .replace(/(\d)x/g, '$1*x')
        .replace(/\^/g, '**');

    const isCorrect = normalizedInput === normalizedSolution;

    if (isCorrect) {
      // Увеличиваем счет
      setScore(prevScore => prevScore + 1);

      // Удаляем выражение
      setExpressions(prevExpressions =>
          prevExpressions.filter(expr => expr.id !== currentExpression.id)
      );

      // Сбрасываем текущее выражение и ввод пользователя
      setCurrentExpression(null);
      setUserInput('');

      // Показываем положительный фидбек
      setFeedback('Правильно!');
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 1000);
    } else {
      // Показываем отрицательный фидбек
      setFeedback('Неверно, попробуйте еще раз');
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 1500);
    }
  };

  // Выбор выражения для ввода
  const selectExpression = (expr: Expression) => {
    setCurrentExpression(expr);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Завершение игры
  const endGame = () => {
    setGameOver(true);
    if (expressionIntervalRef.current) {
      clearInterval(expressionIntervalRef.current);
    }
    cancelAnimationFrame(animationFrameRef.current);

    // Вызов функции завершения с результатами
    onComplete(score, totalDropped + score);
  };

  // Обработка паузы
  const togglePause = () => {
    setIsPaused(prev => !prev);
    if (!isPaused) {
      if (expressionIntervalRef.current) {
        clearInterval(expressionIntervalRef.current);
      }
      cancelAnimationFrame(animationFrameRef.current);
    } else {
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(updateGame);

      expressionIntervalRef.current = setInterval(() => {
        if (!isPaused) {
          generateExpression();
        }
      }, 2000 / (0.5 + difficulty * 0.5));
    }
  };

  // Обработчик ввода
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserInput(e.target.value);
  };

  // Обработчик нажатия Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      checkAnswer();
    }
  };

  // Обработчик клика по выражению
  const handleExpressionClick = (expr: Expression) => {
    selectExpression(expr);
  };

  // Эффект очистки при размонтировании
  useEffect(() => {
    return () => {
      if (expressionIntervalRef.current) {
        clearInterval(expressionIntervalRef.current);
      }
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  if (!gameStarted) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-gray-800 dark:bg-gray-100 rounded-lg shadow-xl transition-colors">
          <h2 className="text-2xl font-bold mb-4 text-white dark:text-gray-900 transition-colors">Игра "DerivFall"</h2>
          <p className="mb-6 text-gray-300 dark:text-gray-700 transition-colors">
            Находите производные падающих выражений до того, как они достигнут дна!
          </p>

          <div className="mb-6 bg-gray-700 dark:bg-gray-200 p-4 rounded transition-colors">
            <h3 className="text-lg font-semibold mb-2 text-white dark:text-gray-900 transition-colors">Правила:</h3>
            <ul className="text-left list-disc pl-5 text-gray-300 dark:text-gray-700 transition-colors">
              <li>Вычисляйте производную для выражения, выделенного синим цветом</li>
              <li>Нажмите на выражение, чтобы выбрать его</li>
              <li>Введите ответ и нажмите Enter</li>
              <li>У вас есть {lives} жизней и {timeLimit} секунд</li>
              <li>Сложность: {difficulty} из 5</li>
            </ul>
          </div>

          <Button onClick={startGame}>Начать игру</Button>
        </div>
    );
  }

  if (gameOver) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-gray-800 dark:bg-gray-100 rounded-lg shadow-xl transition-colors">
          <h2 className="text-2xl font-bold mb-4 text-white dark:text-gray-900 transition-colors">Игра окончена!</h2>

          <div className="mb-6 w-full max-w-md">
            <div className="bg-gray-700 dark:bg-gray-200 p-4 rounded mb-4 transition-colors">
              <h3 className="text-lg font-semibold mb-2 text-white dark:text-gray-900 transition-colors">Ваши результаты:</h3>
              <div className="grid grid-cols-2 gap-4 text-gray-300 dark:text-gray-700 transition-colors">
                <div>Правильных ответов:</div>
                <div className="font-bold">{score}</div>

                <div>Упущенных выражений:</div>
                <div className="font-bold">{totalDropped}</div>

                <div>Достигнутый уровень:</div>
                <div className="font-bold">{level}</div>

                <div>Точность:</div>
                <div className="font-bold">
                  {totalDropped + score > 0
                      ? Math.round((score / (totalDropped + score)) * 100)
                      : 0}%
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            <Button onClick={() => startGame()}>Играть снова</Button>
            <Button variant="outline" onClick={() => onComplete(score, totalDropped + score)}>Вернуться к карте</Button>
          </div>
        </div>
    );
  }

  return (
      <div className="flex flex-col h-full bg-gray-800 dark:bg-gray-100 rounded-lg shadow-xl p-4 transition-colors">
        {/* Верхняя панель */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-4 items-center">
            <div className="text-white dark:text-gray-900 transition-colors">
              <span className="font-bold">Уровень:</span> {level}
            </div>
            <div className="text-white dark:text-gray-900 transition-colors">
              <span className="font-bold">Счет:</span> {score}
            </div>
            <div className="flex items-center">
              <span className="text-white dark:text-gray-900 mr-2 transition-colors font-bold">Жизни:</span>
              <div className="flex">
                {Array.from({ length: lives }).map((_, i) => (
                    <div key={i} className="w-4 h-4 mr-1 bg-red-500 rounded-full"></div>
                ))}
                {Array.from({ length: 3 - lives }).map((_, i) => (
                    <div key={i} className="w-4 h-4 mr-1 bg-gray-500 rounded-full"></div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <div className="text-white dark:text-gray-900 mr-2 transition-colors">
              <span className="font-bold">Время:</span> {timeLeft}с
            </div>
            <Button
                onClick={togglePause}
                variant="outline"
                className="px-2 py-1 text-sm"
            >
              {isPaused ? 'Продолжить' : 'Пауза'}
            </Button>
          </div>
        </div>

        {/* Прогресс-бар времени */}
        <ProgressBar
            progress={(timeLeft / timeLimit) * 100}
            className="mb-4"
        />

        {/* Игровое поле */}
        <div
            ref={gameContainerRef}
            className="relative flex-grow bg-gray-900 dark:bg-gray-200 rounded-lg overflow-hidden transition-colors"
            style={{ minHeight: '300px' }}
        >
          {/* Разделители дорожек */}
          {Array.from({ length: lanes - 1 }).map((_, i) => (
              <div
                  key={i}
                  className="absolute top-0 bottom-0 border-r border-gray-700 dark:border-gray-300 transition-colors"
                  style={{ left: `${((i + 1) / lanes) * 100}%` }}
              ></div>
          ))}

          {/* Выражения */}
          {expressions.map((expr) => (
              <div
                  key={expr.id}
                  className={`absolute p-2 rounded-lg flex items-center justify-center cursor-pointer 
              ${currentExpression && currentExpression.id === expr.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 dark:bg-gray-300 text-white dark:text-gray-900'} 
              transition-colors hover:bg-blue-500 dark:hover:bg-blue-300`}
                  style={{
                    width: `${100 / lanes - 4}%`,
                    height: `${expressionHeight}%`,
                    top: `${expr.position}%`,
                    left: `${(expr.lane / lanes) * 100 + 2}%`,
                  }}
                  onClick={() => handleExpressionClick(expr)}
              >
                {expr.text}
              </div>
          ))}

          {/* Фидбек */}
          {showFeedback && (
              <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg transition-all
            ${feedback.startsWith('Правильно')
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'}`}
              >
                {feedback}
              </div>
          )}

          {/* Пауза */}
          {isPaused && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="bg-gray-800 dark:bg-gray-100 p-6 rounded-lg shadow-xl text-center transition-colors">
                  <h3 className="text-xl font-bold mb-4 text-white dark:text-gray-900 transition-colors">Игра приостановлена</h3>
                  <Button onClick={togglePause}>Продолжить</Button>
                </div>
              </div>
          )}
        </div>

        {/* Поле ввода */}
        <div className="mt-4">
          <div className="mb-2 text-white dark:text-gray-900 font-medium transition-colors">
            {currentExpression
                ? `Найдите производную: ${currentExpression.text}`
                : 'Выберите выражение для решения'}
          </div>
          <div className="flex">
            <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Введите производную..."
                className="flex-grow p-2 rounded-l-lg bg-gray-700 border-gray-600 text-white dark:bg-white dark:border-gray-300 dark:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                disabled={!currentExpression || isPaused}
            />
            <button
                onClick={checkAnswer}
                disabled={!currentExpression || isPaused}
                className="p-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              Ответить
            </button>
          </div>
        </div>
      </div>
  );
};

export default DerivFall;