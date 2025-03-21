// src/components/games/MathLab.tsx
import React, { useState, useEffect, useCallback } from 'react';
// Если пакеты не установлены, выполните:
// npm install recharts @types/recharts mathjs @types/mathjs
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as math from 'mathjs';
import Button from '../Button';

interface MathLabProps {
  mode?: 'derivatives' | 'integrals';
  difficulty?: number;
  onComplete: (score: number, maxScore: number) => void;
}

interface Task {
  id: number;
  type: 'analyze' | 'find' | 'calculate';
  question: string;
  functionExpression: string;
  correctAnswer: string | number;
  options?: string[];
  difficulty: number;
  hints: string[];
}

// Набор задач для режима производных
const derivativeTasks: Task[] = [
  {
    id: 1,
    type: 'analyze',
    question: 'Изучите график функции f(x) = x² и ее производной. Где производная равна нулю?',
    functionExpression: 'x^2',
    correctAnswer: 'x = 0',
    options: ['x = 0', 'x = 1', 'x = -1', 'Нигде'],
    difficulty: 1,
    hints: [
      'Производная функции f(x) = x² равна f\'(x) = 2x',
      'Производная равна нулю, когда 2x = 0',
      'Решите уравнение 2x = 0'
    ]
  },
  {
    id: 2,
    type: 'find',
    question: 'Найдите точки экстремума функции f(x) = x³ - 3x',
    functionExpression: 'x^3 - 3*x',
    correctAnswer: 'x = ±1',
    options: ['x = ±1', 'x = 0', 'x = -3', 'x = 3'],
    difficulty: 2,
    hints: [
      'Производная функции f(x) = x³ - 3x равна f\'(x) = 3x² - 3',
      'Найдите значения x, при которых f\'(x) = 0',
      'Решите уравнение 3x² - 3 = 0'
    ]
  },
  {
    id: 3,
    type: 'calculate',
    question: 'Вычислите производную функции f(x) = sin(x) · cos(x) в точке x = π/4',
    functionExpression: 'sin(x) * cos(x)',
    correctAnswer: 0,
    difficulty: 3,
    hints: [
      'Используйте правило произведения: (u·v)\' = u\'·v + u·v\'',
      'sin\'(x) = cos(x), cos\'(x) = -sin(x)',
      'f\'(x) = cos(x)·cos(x) + sin(x)·(-sin(x)) = cos²(x) - sin²(x) = cos(2x)'
    ]
  },
  {
    id: 4,
    type: 'analyze',
    question: 'Изучите график функции f(x) = x³ - 6x² + 9x + 1 и ее производной. Где функция возрастает?',
    functionExpression: 'x^3 - 6*x^2 + 9*x + 1',
    correctAnswer: 'x < 1 или x > 3',
    options: ['x < 1 или x > 3', 'x < 3', '1 < x < 3', 'x > 0'],
    difficulty: 4,
    hints: [
      'Функция возрастает там, где ее производная положительна',
      'Найдите производную: f\'(x) = 3x² - 12x + 9',
      'Решите неравенство 3x² - 12x + 9 > 0',
      'Используйте дискриминант для решения квадратного неравенства'
    ]
  },
  {
    id: 5,
    type: 'find',
    question: 'Найдите точки перегиба функции f(x) = x⁴ - 4x³',
    functionExpression: 'x^4 - 4*x^3',
    correctAnswer: 'x = 0, x = 2',
    options: ['x = 0, x = 2', 'x = -1, x = 3', 'x = 1, x = 3', 'x = 0, x = 3'],
    difficulty: 5,
    hints: [
      'Точки перегиба находятся там, где вторая производная равна нулю и меняет знак',
      'Первая производная: f\'(x) = 4x³ - 12x²',
      'Вторая производная: f\'\'(x) = 12x² - 24x = 12x(x - 2)',
      'Решите уравнение 12x(x - 2) = 0'
    ]
  }
];

// Набор задач для режима интегралов
const integralTasks: Task[] = [
  {
    id: 101,
    type: 'analyze',
    question: 'Изучите график функции f(x) = x² и вычислите площадь под графиком от x = 0 до x = 2',
    functionExpression: 'x^2',
    correctAnswer: '8/3',
    options: ['8/3', '4', '2', '3'],
    difficulty: 1,
    hints: [
      'Площадь под графиком от a до b равна определенному интегралу ∫(a,b) f(x)dx',
      'Для f(x) = x², интеграл равен F(x) = x³/3',
      'Используйте формулу: ∫(a,b) f(x)dx = F(b) - F(a)'
    ]
  },
  {
    id: 102,
    type: 'calculate',
    question: 'Вычислите интеграл ∫sin(x)dx от 0 до π',
    functionExpression: 'sin(x)',
    correctAnswer: 2,
    difficulty: 2,
    hints: [
      'Первообразная sin(x) равна -cos(x)',
      'Используйте формулу: ∫(a,b) f(x)dx = F(b) - F(a)',
      '∫(0,π) sin(x)dx = [-cos(x)](0,π) = -cos(π) - (-cos(0)) = -(-1) - (-1) = 1 + 1 = 2'
    ]
  },
  {
    id: 103,
    type: 'analyze',
    question: 'Изучите график функции f(x) = 4 - x². Найдите площадь области, ограниченной функцией и осью Ox',
    functionExpression: '4 - x^2',
    correctAnswer: '16/3',
    options: ['16/3', '8', '4√3', '4π'],
    difficulty: 3,
    hints: [
      'Найдите точки пересечения графика с осью Ox',
      'Функция пересекает ось Ox при f(x) = 0, т.е. 4 - x² = 0',
      'x² = 4, x = ±2',
      'Интеграл: ∫(-2,2) (4 - x²)dx = [4x - x³/3](-2,2)'
    ]
  },
  {
    id: 104,
    type: 'find',
    question: 'Найдите объем тела вращения, полученного при вращении области под графиком f(x) = sin(x) от 0 до π вокруг оси Ox',
    functionExpression: 'sin(x)',
    correctAnswer: 'π²',
    options: ['π²', '2π', 'π²/2', '2π²'],
    difficulty: 4,
    hints: [
      'Объем тела вращения вокруг оси Ox равен V = π∫(a,b) [f(x)]²dx',
      'Для f(x) = sin(x) нужно вычислить π∫(0,π) sin²(x)dx',
      'Используйте тригонометрическую формулу sin²(x) = (1 - cos(2x))/2',
      'π∫(0,π) sin²(x)dx = π∫(0,π) (1 - cos(2x))/2 dx'
    ]
  },
  {
    id: 105,
    type: 'calculate',
    question: 'Вычислите интеграл ∫e^x·sin(x)dx от 0 до π/2',
    functionExpression: 'exp(x)*sin(x)',
    correctAnswer: '(e^(π/2) - 1)/2',
    options: ['(e^(π/2) - 1)/2', 'e^(π/2)', '(e^(π/2) + 1)/2', '(e^(π/2) - 1)'],
    difficulty: 5,
    hints: [
      'Используйте интегрирование по частям: ∫u·dv = u·v - ∫v·du',
      'Положите u = e^x, dv = sin(x)dx, тогда du = e^x·dx, v = -cos(x)',
      '∫e^x·sin(x)dx = -e^x·cos(x) + ∫e^x·cos(x)dx',
      'Повторите интегрирование по частям для ∫e^x·cos(x)dx'
    ]
  }
];

const MathLab: React.FC<MathLabProps> = ({ mode = 'derivatives', difficulty = 3, onComplete }) => {
  // Состояния
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [userFunction, setUserFunction] = useState('');
  const [isValidFunction, setIsValidFunction] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  // Добавляем типизацию для данных графика
  interface GraphDataPoint {
    x: number;
    y: number;
    integral?: number;
  }

  const [graphData, setGraphData] = useState<GraphDataPoint[]>([]);
  const [derivativeData, setDerivativeData] = useState<GraphDataPoint[]>([]);
  const [integralData, setIntegralData] = useState<GraphDataPoint[]>([]);
  const [xMin, setXMin] = useState(-5);
  const [xMax, setXMax] = useState(5);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const [animationActive, setAnimationActive] = useState(false);

  // Выбор набора задач в зависимости от режима
  const tasks = mode === 'derivatives' ? derivativeTasks : integralTasks;

  // Функция для генерации точек графика
  const generateGraphPoints = useCallback((expression: string, min: number, max: number, points: number = 100) => {
    const data = [];
    const step = (max - min) / points;

    // Создаем парсер для корректной обработки выражений
    const parser = math.parser();

    try {
      for (let i = 0; i <= points; i++) {
        const x = min + i * step;
        parser.set('x', x);
        let y;

        try {
          y = parser.evaluate(expression);
          // Пропускаем точки где значения слишком большие или NaN
          if (typeof y === 'number' && !isNaN(y) && Math.abs(y) < 1000) {
            data.push({ x, y });
          }
        } catch (error) {
          console.error(`Error evaluating at x=${x}:`, error);
        }
      }

      setIsValidFunction(true);
      setErrorMessage('');
      return data;
    } catch (error) {
      console.error('Error generating graph:', error);
      setIsValidFunction(false);
      setErrorMessage('Ошибка в выражении');
      return [];
    }
  }, []);

  // Функция для вычисления производной
  const computeDerivative = useCallback((expression: string) => {
    try {
      // Вычисляем аналитическую производную
      const derivative = math.derivative(expression, 'x').toString();
      return derivative;
    } catch (error) {
      console.error('Error computing derivative:', error);
      return null;
    }
  }, []);

  // Функция для вычисления интеграла (имитация)
  // В реальном коде вместо этого можно использовать другие методы из mathjs
  const computeDefiniteIntegral = useCallback((expression: string, a: number, b: number): number => {
    try {
      // Простой способ вычисления определенного интеграла - метод трапеций
      const steps = 100; // Количество шагов
      const h = (b - a) / steps;
      let sum = 0;

      const parser = math.parser();

      for (let i = 0; i <= steps; i++) {
        const x = a + i * h;
        parser.set('x', x);

        let y = 0;
        try {
          y = parser.evaluate(expression);
          if (i === 0 || i === steps) {
            sum += y / 2; // Для крайних точек делим на 2
          } else {
            sum += y;
          }
        } catch (error) {
          console.error(`Error evaluating at x=${x}:`, error);
        }
      }

      return sum * h;
    } catch (error) {
      console.error('Error computing integral:', error);
      return 0;
    }
  }, []);

  // Обновление графиков при изменении выражения или пределов
  useEffect(() => {
    if (!userFunction) return;

    try {
      // Генерируем точки для функции
      const functionPoints = generateGraphPoints(userFunction, xMin, xMax);
      setGraphData(functionPoints);

      // Вычисляем производную
      const derivative = computeDerivative(userFunction);
      if (derivative) {
        const derivativePoints = generateGraphPoints(derivative, xMin, xMax);
        setDerivativeData(derivativePoints);
      } else {
        setDerivativeData([]);
      }

      // Для режима интегралов визуализируем площадь под кривой
      if (mode === 'integrals') {
        // Добавляем точки для отображения интеграла (площади под кривой)
        const integralPoints = functionPoints.map(point => ({
          ...point,
          integral: point.y > 0 ? point.y : 0 // Только положительная часть для простоты
        }));
        setIntegralData(integralPoints);

        // Пример использования функции computeDefiniteIntegral, если нужно
        const area = computeDefiniteIntegral(userFunction, xMin, xMax);
        console.log('Approximated area under curve:', area);
      }
    } catch (error) {
      console.error('Error updating graphs:', error);
      setIsValidFunction(false);
      setErrorMessage('Ошибка при вычислении графиков');
    }
  }, [userFunction, xMin, xMax, generateGraphPoints, computeDerivative, mode]);

  // Загрузка задания при запуске или переходе к следующему
  const loadTask = useCallback(() => {
    // Фильтруем задачи по сложности (±1 от текущей настройки)
    const eligibleTasks = tasks.filter(
        task => Math.abs(task.difficulty - difficulty) <= 1
    );

    // Выбираем случайную задачу
    const randomTask = eligibleTasks[Math.floor(Math.random() * eligibleTasks.length)] || tasks[0];
    setCurrentTask(randomTask);

    // Устанавливаем функцию из задания
    setUserFunction(randomTask.functionExpression);

    // Сбрасываем выбранный вариант и ответ пользователя
    setSelectedOption(null);
    setUserAnswer('');

    // Сбрасываем индекс подсказок
    setCurrentHintIndex(0);
    setShowHints(false);

    // Запускаем анимацию для привлечения внимания
    setAnimationActive(true);
    setTimeout(() => setAnimationActive(false), 1000);
  }, [tasks, difficulty]);

  // Функция запуска игры
  const startGame = () => {
    setGameStarted(true);
    setScore(0);
    setTasksCompleted(0);
    loadTask();
  };

  // Функция завершения игры
  const endGame = () => {
    setGameOver(true);
    onComplete(score, tasksCompleted);
  };

  // Добавим вызов функции endGame по таймауту, если нужно ограничить время игры
  useEffect(() => {
    // Например, завершить игру через 10 минут
    const gameTimer = setTimeout(() => {
      if (gameStarted && !gameOver) {
        endGame();
      }
    }, 10 * 60 * 1000); // 10 минут

    return () => clearTimeout(gameTimer);
  }, [gameStarted, gameOver]);

  // Обработка отправки ответа
  const handleSubmitAnswer = () => {
    if (!currentTask) return;

    let isCorrect = false;
    const userAnswerNormalized = userAnswer.trim().toLowerCase();
    const selectedOptionValue = selectedOption?.trim().toLowerCase();

    // Проверка ответа в зависимости от типа задачи
    if (currentTask.type === 'analyze' || currentTask.type === 'find') {
      // Для задач с вариантами ответов
      if (currentTask.options) {
        const correctAnswerNormalized = String(currentTask.correctAnswer).trim().toLowerCase();
        isCorrect = selectedOptionValue === correctAnswerNormalized;
      } else {
        // Для задач с текстовым ответом
        const correctAnswerNormalized = String(currentTask.correctAnswer).trim().toLowerCase();
        isCorrect = userAnswerNormalized === correctAnswerNormalized;
      }
    } else if (currentTask.type === 'calculate') {
      // Для вычислительных задач, где ответ - число
      // Конвертируем ответ пользователя в число, если возможно
      let userNumericAnswer;
      try {
        userNumericAnswer = math.evaluate(userAnswerNormalized.replace(/,/g, '.'));
      } catch (error) {
        userNumericAnswer = NaN;
      }

      // Проверяем приближенное равенство для чисел
      const correctNumericAnswer = typeof currentTask.correctAnswer === 'number'
          ? currentTask.correctAnswer
          : math.evaluate(String(currentTask.correctAnswer).replace(/,/g, '.'));

      const tolerance = 0.001; // Допустимая погрешность
      isCorrect = Math.abs(userNumericAnswer - correctNumericAnswer) < tolerance;
    }

    // Обновляем счет и показываем обратную связь
    if (isCorrect) {
      setScore(prev => prev + 1);
      setFeedback('Правильно! Отличная работа!');
    } else {
      setFeedback(`Неверно. Правильный ответ: ${currentTask.correctAnswer}`);
    }

    setShowFeedback(true);
    setTasksCompleted(prev => prev + 1);

    // Через некоторое время скрываем обратную связь и загружаем новое задание
    setTimeout(() => {
      setShowFeedback(false);
      loadTask();
    }, 2000);
  };

  // Обработка изменения функции пользователем
  const handleFunctionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserFunction(e.target.value);
  };

  // Обработка изменения пределов
  const handleLimitsChange = (min: number, max: number) => {
    if (min < max) {
      setXMin(min);
      setXMax(max);
    }
  };

  // Обработка выбора варианта ответа
  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
  };

  // Обработка изменения текстового ответа
  const handleAnswerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserAnswer(e.target.value);
  };

  // Показ следующей подсказки
  const showNextHint = () => {
    if (!currentTask) return;

    if (!showHints) {
      setShowHints(true);
    } else if (currentHintIndex < currentTask.hints.length - 1) {
      setCurrentHintIndex(prev => prev + 1);
    }
  };

  if (!gameStarted) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-gray-800 dark:bg-gray-100 rounded-lg shadow-xl transition-colors">
          <h2 className="text-2xl font-bold mb-4 text-white dark:text-gray-900 transition-colors">
            Виртуальная Лаборатория {mode === 'derivatives' ? 'Производных' : 'Интегралов'}
          </h2>
          <p className="mb-6 text-gray-300 dark:text-gray-700 transition-colors">
            Изучайте функции, их {mode === 'derivatives' ? 'производные' : 'интегралы'} и решайте задачи!
          </p>

          <div className="mb-6 bg-gray-700 dark:bg-gray-200 p-4 rounded transition-colors">
            <h3 className="text-lg font-semibold mb-2 text-white dark:text-gray-900 transition-colors">Возможности:</h3>
            <ul className="text-left list-disc pl-5 text-gray-300 dark:text-gray-700 transition-colors">
              <li>Визуализация функций и их {mode === 'derivatives' ? 'производных' : 'интегралов'}</li>
              <li>Изменение диапазона значений по оси X для детального анализа</li>
              <li>Решение практических задач разного уровня сложности</li>
              <li>Подсказки для помощи в затруднительных ситуациях</li>
            </ul>
          </div>

          <Button onClick={startGame}>Начать исследование</Button>
        </div>
    );
  }

  if (gameOver) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-gray-800 dark:bg-gray-100 rounded-lg shadow-xl transition-colors">
          <h2 className="text-2xl font-bold mb-4 text-white dark:text-gray-900 transition-colors">Исследование завершено!</h2>

          <div className="mb-6 w-full max-w-md">
            <div className="bg-gray-700 dark:bg-gray-200 p-4 rounded mb-4 transition-colors">
              <h3 className="text-lg font-semibold mb-2 text-white dark:text-gray-900 transition-colors">Ваши результаты:</h3>
              <div className="grid grid-cols-2 gap-4 text-gray-300 dark:text-gray-700 transition-colors">
                <div>Правильных ответов:</div>
                <div className="font-bold">{score}</div>

                <div>Всего задач:</div>
                <div className="font-bold">{tasksCompleted}</div>

                <div>Точность:</div>
                <div className="font-bold">
                  {tasksCompleted > 0
                      ? Math.round((score / tasksCompleted) * 100)
                      : 0}%
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            <Button onClick={() => startGame()}>Начать заново</Button>
            <Button variant="outline" onClick={() => onComplete(score, tasksCompleted)}>Вернуться к карте</Button>
          </div>
        </div>
    );
  }

  return (
      <div className="flex flex-col h-full bg-gray-800 dark:bg-gray-100 rounded-lg shadow-xl p-4 overflow-auto transition-colors">
        {/* Верхняя панель с задачей */}
        <div className={`mb-4 p-4 bg-gray-700 dark:bg-gray-200 rounded-lg transition-colors ${
            animationActive ? 'animate-pulse' : ''
        }`}>
          <h3 className="text-xl font-semibold mb-2 text-white dark:text-gray-900 transition-colors">
            Задача {tasksCompleted + 1}:
          </h3>
          <p className="text-gray-300 dark:text-gray-700 transition-colors">
            {currentTask?.question}
          </p>

          {showHints && currentTask && (
              <div className="mt-3 p-2 bg-blue-600 dark:bg-blue-500 text-white rounded transition-colors">
                <p className="font-medium">Подсказка {currentHintIndex + 1}:</p>
                <p>{currentTask.hints[currentHintIndex]}</p>
              </div>
          )}
        </div>

        {/* Панель управления графиком */}
        <div className="mb-4 p-4 bg-gray-700 dark:bg-gray-200 rounded-lg transition-colors">
          <h3 className="text-lg font-semibold mb-2 text-white dark:text-gray-900 transition-colors">
            Функция:
          </h3>
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-white dark:text-gray-900 transition-colors">f(x) =</span>
            <input
                type="text"
                value={userFunction}
                onChange={handleFunctionChange}
                className={`flex-grow p-2 rounded bg-gray-600 dark:bg-white border ${
                    isValidFunction
                        ? 'border-gray-500 dark:border-gray-300'
                        : 'border-red-500'
                } text-white dark:text-gray-900 transition-colors`}
                placeholder="Введите математическое выражение, например: x^2"
            />
          </div>

          {!isValidFunction && (
              <p className="text-red-500 mb-3">{errorMessage || 'Неверное выражение'}</p>
          )}

          <div className="flex items-center space-x-4 mb-3">
            <div className="flex items-center">
              <span className="text-white dark:text-gray-900 mr-2 transition-colors">X min:</span>
              <input
                  type="number"
                  value={xMin}
                  onChange={(e) => handleLimitsChange(Number(e.target.value), xMax)}
                  className="p-1 w-16 rounded bg-gray-600 dark:bg-white border border-gray-500 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
              />
            </div>
            <div className="flex items-center">
              <span className="text-white dark:text-gray-900 mr-2 transition-colors">X max:</span>
              <input
                  type="number"
                  value={xMax}
                  onChange={(e) => handleLimitsChange(xMin, Number(e.target.value))}
                  className="p-1 w-16 rounded bg-gray-600 dark:bg-white border border-gray-500 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
              />
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
                variant="outline"
                onClick={() => handleLimitsChange(-10, 10)}
                className="text-sm py-1"
            >
              [-10, 10]
            </Button>
            <Button
                variant="outline"
                onClick={() => handleLimitsChange(-5, 5)}
                className="text-sm py-1"
            >
              [-5, 5]
            </Button>
            <Button
                variant="outline"
                onClick={() => handleLimitsChange(-Math.PI, Math.PI)}
                className="text-sm py-1"
            >
              [-π, π]
            </Button>
            <Button
                variant="outline"
                onClick={() => handleLimitsChange(0, 10)}
                className="text-sm py-1"
            >
              [0, 10]
            </Button>
          </div>
        </div>

        {/* Область графиков */}
        <div className="flex-grow mb-4 p-4 bg-gray-700 dark:bg-gray-200 rounded-lg transition-colors">
          <h3 className="text-lg font-semibold mb-2 text-white dark:text-gray-900 transition-colors">
            Графики:
          </h3>

          <div className="h-48 sm:h-64 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                  margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#555" />
                <XAxis
                    dataKey="x"
                    type="number"
                    domain={[xMin, xMax]}
                    tickCount={5}
                    stroke="#aaa"
                />
                <YAxis stroke="#aaa" />
                <Tooltip
                    formatter={(value: number) => value.toFixed(3)}
                    labelFormatter={(value: number) => `x = ${value.toFixed(3)}`}
                    contentStyle={{ backgroundColor: '#333', borderColor: '#555' }}
                />
                <Legend />

                {/* График функции */}
                <Line
                    data={graphData}
                    type="monotone"
                    dataKey="y"
                    name="f(x)"
                    stroke="#8884d8"
                    dot={false}
                    isAnimationActive={false}
                />

                {/* График производной в режиме производных */}
                {mode === 'derivatives' && (
                    <Line
                        data={derivativeData}
                        type="monotone"
                        dataKey="y"
                        name="f'(x)"
                        stroke="#82ca9d"
                        dot={false}
                        isAnimationActive={false}
                    />
                )}

                {/* График интеграла в режиме интегралов */}
                {mode === 'integrals' && (
                    <Line
                        data={integralData}
                        type="monotone"
                        dataKey="integral"
                        name="Площадь"
                        stroke="#ffc658"
                        fill="#ffc658"
                        fillOpacity={0.3}
                        dot={false}
                        isAnimationActive={false}
                    />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Панель ответа */}
        <div className="mb-4 p-4 bg-gray-700 dark:bg-gray-200 rounded-lg transition-colors">
          <h3 className="text-lg font-semibold mb-2 text-white dark:text-gray-900 transition-colors">
            Ваш ответ:
          </h3>

          {currentTask?.options ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {currentTask.options.map((option, index) => (
                    <div
                        key={index}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedOption === option
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-600 text-white dark:bg-gray-300 dark:text-gray-900 hover:bg-gray-500 dark:hover:bg-gray-400'
                        }`}
                        onClick={() => handleOptionSelect(option)}
                    >
                      {option}
                    </div>
                ))}
              </div>
          ) : (
              <div className="mb-3">
                <input
                    type="text"
                    value={userAnswer}
                    onChange={handleAnswerChange}
                    placeholder="Введите ваш ответ..."
                    className="w-full p-2 rounded bg-gray-600 dark:bg-white border border-gray-500 dark:border-gray-300 text-white dark:text-gray-900 transition-colors"
                />
              </div>
          )}

          {/* Кнопки действий */}
          <div className="flex justify-between">
            <Button
                variant="outline"
                onClick={showNextHint}
                disabled={showHints && currentHintIndex >= (currentTask?.hints.length || 0) - 1}
            >
              {showHints ? 'Следующая подсказка' : 'Показать подсказку'}
            </Button>

            <Button
                onClick={handleSubmitAnswer}
                disabled={
                    (currentTask?.options && !selectedOption) ||
                    (!currentTask?.options && !userAnswer.trim())
                }
            >
              Проверить ответ
            </Button>
          </div>
        </div>

        {/* Прогресс и счет */}
        <div className="flex justify-between text-white dark:text-gray-900 transition-colors">
          <div>Выполнено: {tasksCompleted}</div>
          <div>Счет: {score}</div>
        </div>

        {/* Обратная связь */}
        {showFeedback && (
            <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg text-white z-10 ${
                feedback.includes('Правильно') ? 'bg-green-600' : 'bg-red-600'
            }`}>
              {feedback}
            </div>
        )}
      </div>
  );
};

export default MathLab;