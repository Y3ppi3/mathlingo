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
  // Основные состояния
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gamePaused, setGamePaused] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [userFunction, setUserFunction] = useState('');
  const [isValidFunction, setIsValidFunction] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'explorer' | 'challenge'>('explorer');

  const normalizeExpression = (expression: string): string => {
    if (!expression) return '';

    let normalized = expression.trim();

    // Замена надстрочных символов на стандартные обозначения степеней
    normalized = normalized
        // Основная обработка степеней
        .replace(/x²/g, 'x^2')
        .replace(/x³/g, 'x^3')
        .replace(/x⁷/g, 'x^7')
        .replace(/x⁴/g, 'x^4')
        .replace(/x⁻²/g, 'x^(-2)')
        .replace(/x⁻³/g, 'x^(-3)')
        .replace(/x⁻⁴/g, 'x^(-4)')

        // Общие случаи для других выражений
        .replace(/(\w)\^(\d+)/g, '$1^$2') // Нормализуем синтаксис степеней
        .replace(/(\w+|\))²/g, '$1^2')
        .replace(/(\w+|\))³/g, '$1^3')
        .replace(/(\w+|\))⁷/g, '$1^7')
        .replace(/(\w+|\))⁴/g, '$1^4')

        // Обработка скобок
        .replace(/\(([^()]+)\)²/g, '($1)^2')
        .replace(/\(([^()]+)\)³/g, '($1)^3')
        .replace(/\(([^()]+)\)⁷/g, '($1)^7')
        .replace(/\(([^()]+)\)⁴/g, '($1)^4')

        // Квадратные корни
        .replace(/√(\w+|\(.*?\))/g, 'sqrt($1)')

        // Дополнительные трансформации
        .replace(/sin\s*\(/g, 'sin(')
        .replace(/cos\s*\(/g, 'cos(')
        .replace(/tan\s*\(/g, 'tan(')
        .replace(/ln\s*\(/g, 'log(');

    console.log(`Нормализация: "${expression}" → "${normalized}"`);
    return normalized;
  };

// Функция для безопасного вычисления математических выражений
  const safeEvaluate = (expressionStr: string, xValue?: number): number => {
    try {
      const normalized = normalizeExpression(expressionStr);

      // Если задано значение x, используем его для вычисления
      if (xValue !== undefined) {
        const parser = math.parser();
        parser.set('x', xValue);
        return parser.evaluate(normalized);
      }

      return math.evaluate(normalized);
    } catch (error) {
      console.error('Ошибка вычисления:', error);
      return NaN;
    }
  };

  const [graphData, setGraphData] = useState<GraphDataPoint[]>([]);
  const [derivativeData, setDerivativeData] = useState<GraphDataPoint[]>([]);
  const [integralData, setIntegralData] = useState<GraphDataPoint[]>([]);
  const [xMin, setXMin] = useState(-5);
  const [xMax, setXMax] = useState(5);

  // Состояния для ответов и прогресса
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const [animationActive, setAnimationActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(60); // 60 секунд
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Ссылки на таймеры
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Загрузка задач при инициализации
  useEffect(() => {
    const loadTasks = async () => {
      setLoading(true);
      try {
        // Загружаем задачи...
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

        console.log(`Загружено ${problems.length} задач для режима ${mode}`);
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
    if (!expression) {
      setIsValidFunction(false);
      setErrorMessage('Введите выражение');
      return [];
    }

    const data = [];
    const step = (max - min) / points;

    try {
      // Нормализуем выражение
      const normalized = normalizeExpression(expression);
      console.log(`Выражение для графика: ${normalized}`);

      const parser = math.parser();

      for (let i = 0; i <= points; i++) {
        const x = min + i * step;
        try {
          parser.set('x', x);
          const y = parser.evaluate(normalized);

          if (typeof y === 'number' && !isNaN(y) && Math.abs(y) < 1000) {
            data.push({ x, y });
          }
        } catch (localError) {
          // Пропускаем точки с ошибками
          console.warn(`Пропуск точки x=${x}: ${localError.message}`);
        }
      }

      if (data.length === 0) {
        setIsValidFunction(false);
        setErrorMessage('Не удалось построить график');
      } else {
        setIsValidFunction(true);
        setErrorMessage('');
      }

      return data;
    } catch (error) {
      console.error('Ошибка построения графика:', error);
      setIsValidFunction(false);
      setErrorMessage('Ошибка в выражении');
      return [];
    }
  }, []);

  // Функция для вычисления производной
  const computeDerivative = useCallback((expression: string) => {
    if (!expression) return null;

    try {
      const normalized = normalizeExpression(expression);
      console.log(`Выражение для производной: ${normalized}`);

      // Используем специальные правила для некоторых известных случаев
      if (normalized === 'x^7') return '7*x^6';
      if (normalized === 'x^2') return '2*x';
      if (normalized === 'x^3') return '3*x^2';
      if (normalized === 'x^4') return '4*x^3';

      // Для остальных случаев вычисляем производную через mathjs
      const derivative = math.derivative(normalized, 'x').toString();
      return derivative;
    } catch (error) {
      console.error('Ошибка вычисления производной:', error);
      return null;
    }
  }, []);

  // Функция для вычисления интеграла (имитация)
  const computeDefiniteIntegral = useCallback((expression: string, a: number, b: number): number => {
    try {
      // Нормализуем выражение перед вычислением интеграла
      const normalizedExpression = normalizeExpression(expression);
      console.log('Нормализованное выражение для интеграла:', normalizedExpression);

      // Используем метод трапеций для численного интегрирования
      const steps = 100; // Количество шагов
      const h = (b - a) / steps;
      let sum = 0;

      const parser = math.parser();

      for (let i = 0; i <= steps; i++) {
        const x = a + i * h;
        parser.set('x', x);

        let y = 0;
        try {
          y = parser.evaluate(normalizedExpression);
          if (i === 0 || i === steps) {
            sum += y / 2; // Для крайних точек делим на 2
          } else {
            sum += y;
          }
        } catch (error) {
          console.error(`Ошибка вычисления при x=${x}:`, error);
        }
      }

      return sum * h;
    } catch (error) {
      console.error('Ошибка вычисления интеграла:', error);
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

    // Фильтруем задачи по сложности
    const eligibleTasks = tasks.filter(
        task => Math.abs(task.difficulty - difficulty) <= 1
    );

    if (eligibleTasks.length === 0) {
      console.warn('Нет подходящих задач для текущей сложности');
      return;
    }

    // Выбираем случайную задачу
    const randomIndex = Math.floor(Math.random() * eligibleTasks.length);
    const task = eligibleTasks[randomIndex];

    console.log('Загружена задача:', task);

    // Нормализуем функцию если она есть
    if (task.functionExpression) {
      task.functionExpression = task.functionExpression.replace('y\'(x) =', '').trim();
      console.log(`Выражение функции: ${task.functionExpression}`);
    }

    setCurrentTask(task);
    setUserFunction(task.functionExpression || '');

    // Сбрасываем состояния
    setSelectedOption(null);
    setUserAnswer('');
    setCurrentHintIndex(0);
    setShowHints(false);

    // Анимация для привлечения внимания
    setAnimationActive(true);
    setTimeout(() => setAnimationActive(false), 1000);
  }, [tasks, difficulty]);

  // Таймер обратного отсчета
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (gameStarted && !gameOver && !gamePaused) {
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            if (timer) clearInterval(timer);
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      timerRef.current = timer;
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [gameStarted, gameOver, gamePaused]);

  // Начать игру с обратным отсчетом
  const startGameWithCountdown = () => {
    resetGame();
    setCountdownActive(true);
    setCountdown(3);

    // Запускаем обратный отсчет
    const countdownTimer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimer);
          setCountdownActive(false);
          startGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Сбросить игру
  const resetGame = () => {
    // Очищаем таймер
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Сбрасываем состояния
    setScore(0);
    setTasksCompleted(0);
    setTimeRemaining(60);
    setGameOver(false);
    setGameStarted(false);
    setGamePaused(false);
    setShowFeedback(false);
  };

  // Функция запуска игры
  const startGame = () => {
    setGameStarted(true);
    setGamePaused(false);
    setScore(0);
    setTasksCompleted(0);
    setTimeRemaining(60); // 1 минута
    loadTask();
  };

  // Поставить игру на паузу или возобновить
  const togglePause = () => {
    setGamePaused(prev => !prev);
  };

  // Функция завершения игры
  const endGame = () => {
    setGameOver(true);
    setGamePaused(false);

    // Очищаем таймер
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (onComplete) {
      onComplete(score, tasksCompleted);
    }
  };

  // Обработка отправки ответа
  const handleSubmitAnswer = () => {
    if (!currentTask) return;

    let isCorrect = false;
    const userAnswerNormalized = userAnswer.trim().toLowerCase();
    const selectedOptionValue = selectedOption?.trim().toLowerCase();

    // Специальная обработка задач на производные
    if (currentTask.question && currentTask.question.includes('производную')) {
      // Для задач с вариантами ответов (случай как на вашем скриншоте)
      if (currentTask.options && selectedOption) {
        // Нормализуем выбранный ответ и сравниваем с правильным
        const normalizedSelection = normalizeExpression(selectedOption);
        const correctAnswer = String(currentTask.correctAnswer).trim();

        console.log(`Сравнение ответов: "${normalizedSelection}" с "${correctAnswer}"`);

        // Прямое сравнение с известными правильными ответами
        if (currentTask.functionExpression === 'x^7' && normalizedSelection === '7*x^6') {
          isCorrect = true;
        } else if (currentTask.functionExpression === 'x^2' && normalizedSelection === '2*x') {
          isCorrect = true;
        } else {
          // Для других случаев пытаемся сравнить нормализованные выражения
          isCorrect = normalizeExpression(selectedOption) === normalizeExpression(String(currentTask.correctAnswer));
        }
      } else if (userAnswerNormalized) {
        // Обработка текстовых ответов
        const correctAnswerNorm = normalizeExpression(String(currentTask.correctAnswer));
        isCorrect = normalizeExpression(userAnswerNormalized) === correctAnswerNorm;
      }
    } else {
      // Стандартная логика для других типов задач
      if (currentTask.type === 'analyze' || currentTask.type === 'find') {
        if (currentTask.options) {
          isCorrect = selectedOptionValue === String(currentTask.correctAnswer).trim().toLowerCase();
        } else {
          isCorrect = userAnswerNormalized === String(currentTask.correctAnswer).trim().toLowerCase();
        }
      } else if (currentTask.type === 'calculate') {
        try {
          const userValue = safeEvaluate(userAnswerNormalized);
          const correctValue = typeof currentTask.correctAnswer === 'number'
              ? currentTask.correctAnswer
              : safeEvaluate(String(currentTask.correctAnswer));

          const tolerance = 0.001;
          isCorrect = !isNaN(userValue) && !isNaN(correctValue) &&
              Math.abs(userValue - correctValue) < tolerance;
        } catch (error) {
          console.error('Ошибка при проверке числового ответа:', error);
          isCorrect = false;
        }
      }
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

    setTimeout(() => {
      setShowFeedback(false);
      loadTask();
    }, 2000);
  };

  // Обработка изменения функции пользователем
  const handleFunctionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setUserFunction(input);

    try {
      // Проверяем выражение без вычисления
      const normalized = normalizeExpression(input);
      if (normalized) {
        setIsValidFunction(true);
        setErrorMessage('');
      }
    } catch (error) {
      setIsValidFunction(false);
      setErrorMessage('Некорректное выражение');
    }
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
          <div className="text-xl text-gray-300 dark:text-gray-700 transition-colors">
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
            <p className="mb-3 text-gray-300 dark:text-gray-700 transition-colors">
              Это интерактивная лаборатория для изучения и визуализации математических понятий.
              MathLab объединяет интерактивные графики и задачи в одном компоненте.
            </p>
            <div className="text-left text-gray-300 dark:text-gray-700 transition-colors">
              <p className="font-medium mb-1">В MathLab вы можете:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Визуализировать функции и их {mode === 'derivatives' ? 'производные' : 'интегралы'}</li>
                <li>Менять параметры функций и видеть, как меняются графики</li>
                <li>Решать задачи, проверяя свое понимание</li>
                <li>Получать мгновенную обратную связь и подсказки</li>
              </ul>
            </div>
          </div>

          <Button onClick={startGameWithCountdown}>Начать исследование</Button>
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

          <Button onClick={startGameWithCountdown}>Начать заново</Button>
        </div>
    );
  }

  // Обратный отсчет перед началом
  if (countdownActive) {
    return (
        <div className="flex items-center justify-center h-full bg-gray-700 dark:bg-gray-200 rounded-lg transition-colors">
          <div className="text-9xl font-bold text-gray-100 dark:text-gray-900 animate-pulse transition-colors">
            {countdown}
          </div>
        </div>
    );
  }

  // Изменённый интерфейс с вкладками вместо скроллинга
  return (
      <div className="flex flex-col h-full bg-gray-700 dark:bg-gray-200 rounded-lg shadow-xl overflow-hidden transition-colors">
        {/* Верхняя панель с информацией и таймером */}
        <div className="flex justify-between items-center p-2 bg-gray-600 dark:bg-gray-300 border-b border-gray-500 dark:border-gray-400 transition-colors">
          <div className="flex space-x-4 items-center">
            <div className="text-gray-100 dark:text-gray-900 transition-colors">
              Счет: <span className="font-bold">{score}</span>
            </div>
            <div className="text-gray-100 dark:text-gray-900 transition-colors">
              Задач: <span className="font-bold">{tasksCompleted}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
                className={`px-3 py-1 text-sm rounded ${
                    gamePaused
                        ? 'bg-green-700 dark:bg-green-200 text-white dark:text-gray-900'
                        : 'bg-amber-700 dark:bg-amber-200 text-white dark:text-gray-900'
                } transition-colors`}
                onClick={togglePause}
            >
              {gamePaused ? 'Продолжить' : 'Пауза'}
            </button>

            <div className="text-yellow-400 dark:text-yellow-600 font-bold transition-colors">
              Время: {formatTime(timeRemaining)}
            </div>
          </div>
        </div>

        {/* Вкладки для переключения между режимами */}
        <div className="flex bg-gray-600 dark:bg-gray-300 border-b border-gray-500 dark:border-gray-400 transition-colors">
          <button
              className={`px-4 py-2 text-base font-medium transition-colors ${
                  activeTab === 'explorer'
                      ? 'bg-gray-700 dark:bg-gray-200 text-gray-100 dark:text-gray-900 border-b-2 border-blue-500 dark:border-blue-600'
                      : 'text-gray-300 dark:text-gray-700 hover:bg-gray-500 dark:hover:bg-gray-400'
              }`}
              onClick={() => setActiveTab('explorer')}
              disabled={gamePaused}
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
              disabled={gamePaused}
          >
            Задачи
          </button>
        </div>

        {/* Наложение паузы */}
        {gamePaused && (
            <div className="absolute inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex flex-col items-center justify-center z-30 transition-colors">
              <div className="text-4xl font-bold text-white mb-6">ПАУЗА</div>
              <Button
                  onClick={togglePause}
              >
                Продолжить
              </Button>
            </div>
        )}

        {/* Содержимое вкладки "Графики" */}
        {activeTab === 'explorer' && (
            <div className="flex-1 p-4 overflow-auto">
              <div className="mb-4 p-4 bg-gray-600 dark:bg-gray-300 rounded-lg transition-colors">
                <h3 className="text-lg font-semibold mb-2 text-gray-100 dark:text-gray-900 transition-colors">
                  Исследование функций:
                </h3>
                <p className="text-gray-300 dark:text-gray-700 mb-3 transition-colors">
                  Введите функцию и настройте параметры для визуализации графика и его {mode === 'derivatives' ? 'производной' : 'интеграла'}.
                </p>

                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-gray-100 dark:text-gray-900 transition-colors">f(x) =</span>
                  <input
                      type="text"
                      value={userFunction}
                      onChange={handleFunctionChange}
                      disabled={gamePaused}
                      className={`flex-grow p-2 rounded bg-gray-700 dark:bg-gray-100 border ${
                          isValidFunction
                              ? 'border-gray-500 dark:border-gray-400'
                              : 'border-red-500'
                      } text-gray-100 dark:text-gray-900 transition-colors`}
                      placeholder="Введите математическое выражение, например: x^2"
                  />
                </div>

                {!isValidFunction && (
                    <p className="text-red-500 mb-3 transition-colors">{errorMessage || 'Неверное выражение'}</p>
                )}

                <div className="flex flex-wrap gap-2 mb-3">
                  <div className="flex items-center">
                    <span className="text-gray-100 dark:text-gray-900 mr-2 transition-colors">X min:</span>
                    <input
                        type="number"
                        value={xMin}
                        onChange={(e) => handleLimitsChange(Number(e.target.value), xMax)}
                        disabled={gamePaused}
                        className="p-1 w-16 rounded bg-gray-700 dark:bg-gray-100 border border-gray-500 dark:border-gray-400 text-gray-100 dark:text-gray-900 transition-colors"
                    />
                  </div>
                  <div className="flex items-center mx-2">
                    <span className="text-gray-100 dark:text-gray-900 mr-2 transition-colors">X max:</span>
                    <input
                        type="number"
                        value={xMax}
                        onChange={(e) => handleLimitsChange(xMin, Number(e.target.value))}
                        disabled={gamePaused}
                        className="p-1 w-16 rounded bg-gray-700 dark:bg-gray-100 border border-gray-500 dark:border-gray-400 text-gray-100 dark:text-gray-900 transition-colors"
                    />
                  </div>
                  <Button
                      variant="outline"
                      onClick={() => handleLimitsChange(-5, 5)}
                      disabled={gamePaused}
                      className="text-sm py-1"
                  >
                    [-5, 5]
                  </Button>
                  <Button
                      variant="outline"
                      onClick={() => handleLimitsChange(-Math.PI, Math.PI)}
                      disabled={gamePaused}
                      className="text-sm py-1"
                  >
                    [-π, π]
                  </Button>
                </div>
              </div>

              <div className="mb-4 p-4 bg-gray-600 dark:bg-gray-300 rounded-lg transition-colors">
                <h3 className="text-lg font-semibold mb-2 text-gray-100 dark:text-gray-900 transition-colors">
                  График функции:
                </h3>
                <div className="h-64 bg-gray-800 dark:bg-gray-100 rounded-lg p-2 transition-colors">
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
              } transition-colors`}>
                <h3 className="text-lg font-semibold mb-2 text-gray-100 dark:text-gray-900 transition-colors">
                  Задача {tasksCompleted + 1}:
                </h3>
                <p className="text-gray-300 dark:text-gray-700 mb-4 transition-colors">
                  {currentTask?.question}
                </p>

                {showHints && currentTask && (
                    <div className="mt-3 p-2 bg-blue-700 dark:bg-blue-200 text-gray-100 dark:text-gray-900 rounded transition-colors">
                      <p className="font-medium">Подсказка {currentHintIndex + 1}:</p>
                      <p>{currentTask.hints[currentHintIndex]}</p>
                    </div>
                )}
              </div>

              {/* Поле для ответа */}
              <div className="mb-4 p-4 bg-gray-600 dark:bg-gray-300 rounded-lg transition-colors">
                <h3 className="text-lg font-semibold mb-2 text-gray-100 dark:text-gray-900 transition-colors">
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
                              onClick={() => !gamePaused && handleOptionSelect(option)}
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
                          disabled={gamePaused}
                          placeholder="Введите ваш ответ..."
                          className="w-full p-2 rounded bg-gray-700 dark:bg-gray-100 border border-gray-500 dark:border-gray-400 text-gray-100 dark:text-gray-900 transition-colors"
                      />
                    </div>
                )}

                <div className="flex justify-between">
                  <Button
                      variant="outline"
                      onClick={showNextHint}
                      disabled={gamePaused || (showHints && currentHintIndex >= (currentTask?.hints.length || 0) - 1)}
                  >
                    {showHints ? 'Следующая подсказка' : 'Показать подсказку'}
                  </Button>

                  <Button
                      onClick={handleSubmitAnswer}
                      disabled={gamePaused ||
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
            } transition-colors`}>
              {feedback}
            </div>
        )}

        {/* CSS для анимаций */}
        <style>{`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
          }
          
          .animate-pulse {
            animation: pulse 1.5s infinite;
          }
        `}</style>
      </div>
  );
};

export default MathLab;