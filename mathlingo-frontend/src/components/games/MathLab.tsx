// src/components/games/MathLab.tsx
import React, { useState, useEffect, useCallback } from 'react';
// Если пакеты не установлены, выполните:
// npm install recharts @types/recharts mathjs @types/mathjs
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as math from 'mathjs';
import Button from '../Button';
import { gameDataSource } from '../../utils/gameDataSource';

interface MathLabProps {
  mode?: 'derivatives' | 'integrals';
  difficulty?: number;
  onComplete: (score: number, maxScore: number) => void;
}

interface Task {
  id: number | string;
  type: 'analyze' | 'find' | 'calculate';
  question: string;
  functionExpression: string;
  correctAnswer: string | number;
  options?: string[];
  difficulty: number;
  hints: string[];
}

const MathLab: React.FC<MathLabProps> = ({ mode = 'derivatives', difficulty = 3, onComplete }) => {
  // Состояния
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [userFunction, setUserFunction] = useState('');
  const [isValidFunction, setIsValidFunction] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'explorer' | 'challenge'>('explorer');

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
  const [timeRemaining, setTimeRemaining] = useState(60); // Сокращаем до 1 минуты

  // Загрузка задач при инициализации
  useEffect(() => {
    const loadTasks = async () => {
      setLoading(true);
      try {
        // Загружаем производные или интегралы в зависимости от режима
        let problems;
        if (mode === 'derivatives') {
          problems = await gameDataSource.fetchDerivativeProblems();

          // Преобразуем задачи по производным в нужный формат
          const derivativeTasks: Task[] = problems.map(problem => ({
            id: problem.id,
            type: 'calculate',
            question: `Найдите производную: ${problem.problem}`,
            functionExpression: problem.problem.replace("y'(x) =", "").trim(),
            correctAnswer: problem.answer,
            options: problem.options,
            difficulty: problem.difficulty === 'easy' ? 1 :
                problem.difficulty === 'medium' ? 3 : 5,
            hints: [
              'Используйте правила дифференцирования',
              'Вспомните формулу производной степенной функции',
              'Применяйте правило дифференцирования по частям, если необходимо'
            ]
          }));

          setTasks(derivativeTasks);
        } else {
          problems = await gameDataSource.fetchIntegralProblems();

          // Преобразуем задачи по интегралам в нужный формат
          const integralTasks: Task[] = problems.map(problem => ({
            id: problem.id,
            type: 'find',
            question: `Вычислите интеграл: ${problem.question}`,
            functionExpression: problem.question.replace("∫", "").replace("dx", "").trim(),
            correctAnswer: problem.solutionPieces.join(''),
            options: [...problem.solutionPieces, ...problem.distractors].slice(0, 4),
            difficulty: problem.difficulty === 'easy' ? 1 :
                problem.difficulty === 'medium' ? 3 : 5,
            hints: [
              'Найдите первообразную функции',
              'Вспомните формулы интегрирования',
              'Не забудьте про константу интегрирования'
            ]
          }));

          setTasks(integralTasks);
        }
      } catch (error) {
        console.error('Ошибка при загрузке заданий:', error);

        // Если не удалось загрузить задания из источника, используем базовый набор
        if (mode === 'derivatives') {
          setTasks([
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
            }
          ]);
        } else {
          setTasks([
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
            }
          ]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [mode]);

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
  }, [userFunction, xMin, xMax, generateGraphPoints, computeDerivative, mode, computeDefiniteIntegral]);

  // Загрузка задания при запуске или переходе к следующему
  const loadTask = useCallback(() => {
    if (tasks.length === 0) return;

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

  // Таймер обратного отсчета
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (gameStarted && !gameOver) {
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer as NodeJS.Timeout);
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [gameStarted, gameOver]);

  // Функция запуска игры
  const startGame = () => {
    setGameStarted(true);
    setScore(0);
    setTasksCompleted(0);
    setTimeRemaining(60); // 1 минута вместо 5
    loadTask();
  };

  // Функция завершения игры
  const endGame = () => {
    setGameOver(true);
    onComplete(score, tasksCompleted);
  };

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

  // Форматирование времени
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-full bg-gray-700 dark:bg-gray-200 rounded-lg p-6 transition-colors">
          <div className="text-xl text-gray-300 dark:text-gray-700">
            Загрузка заданий...
          </div>
        </div>
    );
  }

  if (!gameStarted) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-gray-700 dark:bg-gray-200 rounded-lg shadow-xl transition-colors">
          <h2 className="text-2xl font-bold mb-4 text-gray-100 dark:text-gray-900 transition-colors">
            Виртуальная Лаборатория {mode === 'derivatives' ? 'Производных' : 'Интегралов'}
          </h2>
          <p className="mb-6 text-gray-300 dark:text-gray-700 transition-colors">
            Изучайте функции, их {mode === 'derivatives' ? 'производные' : 'интегралы'} и решайте задачи!
          </p>

          <div className="mb-6 bg-gray-600 dark:bg-gray-300 p-4 rounded transition-colors">
            <h3 className="text-lg font-semibold mb-2 text-gray-100 dark:text-gray-900 transition-colors">Что такое MathLab:</h3>
            <p className="mb-3 text-gray-300 dark:text-gray-700">
              Это интерактивная лаборатория для изучения и визуализации математических понятий.
              MathLab объединяет интерактивные графики и задачи в одном компоненте.
            </p>
            <div className="text-left text-gray-300 dark:text-gray-700">
              <p className="font-medium mb-1">В MathLab вы можете:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Визуализировать функции и их {mode === 'derivatives' ? 'производные' : 'интегралы'}</li>
                <li>Менять параметры функций и видеть, как меняются графики</li>
                <li>Решать задачи, проверяя свое понимание</li>
                <li>Получать мгновенную обратную связь и подсказки</li>
              </ul>
            </div>
          </div>

          <Button onClick={startGame}>Начать исследование</Button>
        </div>
    );
  }

  if (gameOver) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-gray-700 dark:bg-gray-200 rounded-lg shadow-xl transition-colors">
          <h2 className="text-2xl font-bold mb-4 text-gray-100 dark:text-gray-900 transition-colors">Исследование завершено!</h2>

          <div className="mb-6 w-full max-w-md">
            <div className="bg-gray-600 dark:bg-gray-300 p-4 rounded mb-4 transition-colors">
              <h3 className="text-lg font-semibold mb-2 text-gray-100 dark:text-gray-900 transition-colors">Ваши результаты:</h3>
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

          <Button onClick={() => startGame()}>Начать заново</Button>
        </div>
    );
  }

  // Изменённый интерфейс с вкладками вместо скроллинга
  return (
      <div className="flex flex-col h-full bg-gray-700 dark:bg-gray-200 rounded-lg shadow-xl overflow-hidden transition-colors">
        {/* Верхняя панель с информацией и таймером */}
        <div className="flex justify-between items-center p-2 bg-gray-600 dark:bg-gray-300 border-b border-gray-500 dark:border-gray-400">
          <div className="flex space-x-4 items-center">
            <div className="text-gray-100 dark:text-gray-900">
              Счет: <span className="font-bold">{score}</span>
            </div>
            <div className="text-gray-100 dark:text-gray-900">
              Задач: <span className="font-bold">{tasksCompleted}</span>
            </div>
          </div>

          <div className="text-yellow-400 dark:text-yellow-600 font-bold">
            Время: {formatTime(timeRemaining)}
          </div>
        </div>

        {/* Вкладки для переключения между режимами */}
        <div className="flex bg-gray-600 dark:bg-gray-300 border-b border-gray-500 dark:border-gray-400">
          <button
              className={`px-4 py-2 text-base font-medium transition-colors ${
                  activeTab === 'explorer'
                      ? 'bg-gray-700 dark:bg-gray-200 text-gray-100 dark:text-gray-900 border-b-2 border-blue-500 dark:border-blue-600'
                      : 'text-gray-300 dark:text-gray-700 hover:bg-gray-500 dark:hover:bg-gray-400'
              }`}
              onClick={() => setActiveTab('explorer')}
          >
            Графики
          </button>
          <button
              className={`px-4 py-2 text-base font-medium transition-colors ${
                  activeTab === 'challenge'
                      ? 'bg-gray-700 dark:bg-gray-200 text-gray-100 dark:text-gray-900 border-b-2 border-blue-500 dark:border-blue-600'
                      : 'text-gray-300 dark:text-gray-700 hover:bg-gray-500 dark:hover:bg-gray-400'
              }`}
              onClick={() => setActiveTab('challenge')}
          >
            Задачи
          </button>
        </div>

        {/* Содержимое вкладки "Графики" */}
        {activeTab === 'explorer' && (
            <div className="flex-1 p-4 overflow-auto">
              <div className="mb-4 p-4 bg-gray-600 dark:bg-gray-300 rounded-lg">
                <h3 className="text-lg font-semibold mb-2 text-gray-100 dark:text-gray-900">
                  Исследование функций:
                </h3>
                <p className="text-gray-300 dark:text-gray-700 mb-3">
                  Введите функцию и настройте параметры для визуализации графика и его {mode === 'derivatives' ? 'производной' : 'интеграла'}.
                </p>

                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-gray-100 dark:text-gray-900">f(x) =</span>
                  <input
                      type="text"
                      value={userFunction}
                      onChange={handleFunctionChange}
                      className={`flex-grow p-2 rounded bg-gray-700 dark:bg-gray-100 border ${
                          isValidFunction
                              ? 'border-gray-500 dark:border-gray-400'
                              : 'border-red-500'
                      } text-gray-100 dark:text-gray-900 transition-colors`}
                      placeholder="Введите математическое выражение, например: x^2"
                  />
                </div>

                {!isValidFunction && (
                    <p className="text-red-500 mb-3">{errorMessage || 'Неверное выражение'}</p>
                )}

                <div className="flex flex-wrap gap-2 mb-3">
                  <div className="flex items-center">
                    <span className="text-gray-100 dark:text-gray-900 mr-2">X min:</span>
                    <input
                        type="number"
                        value={xMin}
                        onChange={(e) => handleLimitsChange(Number(e.target.value), xMax)}
                        className="p-1 w-16 rounded bg-gray-700 dark:bg-gray-100 border border-gray-500 dark:border-gray-400 text-gray-100 dark:text-gray-900"
                    />
                  </div>
                  <div className="flex items-center mx-2">
                    <span className="text-gray-100 dark:text-gray-900 mr-2">X max:</span>
                    <input
                        type="number"
                        value={xMax}
                        onChange={(e) => handleLimitsChange(xMin, Number(e.target.value))}
                        className="p-1 w-16 rounded bg-gray-700 dark:bg-gray-100 border border-gray-500 dark:border-gray-400 text-gray-100 dark:text-gray-900"
                    />
                  </div>
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
                </div>
              </div>

              <div className="mb-4 p-4 bg-gray-600 dark:bg-gray-300 rounded-lg">
                <h3 className="text-lg font-semibold mb-2 text-gray-100 dark:text-gray-900">
                  График функции:
                </h3>
                <div className="h-64 bg-gray-800 dark:bg-gray-100 rounded-lg p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
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

                      <Line
                          data={graphData}
                          type="monotone"
                          dataKey="y"
                          name="f(x)"
                          stroke="#8884d8"
                          dot={false}
                          isAnimationActive={false}
                      />

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
            </div>
        )}

        {/* Содержимое вкладки "Задачи" */}
        {activeTab === 'challenge' && (
            <div className="flex-1 p-4 overflow-auto">
              {/* Текущая задача */}
              <div className={`mb-4 p-4 bg-gray-600 dark:bg-gray-300 rounded-lg ${
                  animationActive ? 'animate-pulse' : ''
              }`}>
                <h3 className="text-lg font-semibold mb-2 text-gray-100 dark:text-gray-900">
                  Задача {tasksCompleted + 1}:
                </h3>
                <p className="text-gray-300 dark:text-gray-700 mb-4">
                  {currentTask?.question}
                </p>

                {showHints && currentTask && (
                    <div className="mt-3 p-2 bg-blue-700 dark:bg-blue-200 text-gray-100 dark:text-gray-900 rounded">
                      <p className="font-medium">Подсказка {currentHintIndex + 1}:</p>
                      <p>{currentTask.hints[currentHintIndex]}</p>
                    </div>
                )}
              </div>

              {/* Поле для ответа */}
              <div className="mb-4 p-4 bg-gray-600 dark:bg-gray-300 rounded-lg">
                <h3 className="text-lg font-semibold mb-2 text-gray-100 dark:text-gray-900">
                  Ваш ответ:
                </h3>

                {currentTask?.options ? (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {currentTask.options.map((option, index) => (
                          <div
                              key={index}
                              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                                  selectedOption === option
                                      ? 'bg-blue-700 dark:bg-blue-200 text-gray-100 dark:text-gray-900'
                                      : 'bg-gray-700 dark:bg-gray-100 text-gray-300 dark:text-gray-700 hover:bg-gray-500 dark:hover:bg-gray-300'
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
                          className="w-full p-2 rounded bg-gray-700 dark:bg-gray-100 border border-gray-500 dark:border-gray-400 text-gray-100 dark:text-gray-900"
                      />
                    </div>
                )}

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
            </div>
        )}

        {/* Обратная связь */}
        {showFeedback && (
            <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-10 ${
                feedback.includes('Правильно') ? 'bg-green-700 dark:bg-green-200 text-gray-100 dark:text-gray-900' :
                    'bg-red-700 dark:bg-red-200 text-gray-100 dark:text-gray-900'
            }`}>
              {feedback}
            </div>
        )}
      </div>
  );
};

export default MathLab;