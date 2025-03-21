// src/components/games/IntegralBuilder.tsx
import React, { useState } from 'react';
import Button from '../Button';

// Определение типов для перетаскиваемых элементов
interface DraggableItem {
  id: number;
  type: 'integralSign' | 'function' | 'bounds' | 'dx' | 'result' | 'constant';
  content: string;
  correctPosition?: number; // индекс правильной позиции в решении
  latex?: string; // представление в LaTeX для более сложных выражений
}

// Определение типа задания
interface IntegralTask {
  id: number;
  question: string;
  pieces: DraggableItem[];
  solution: number[]; // индексы элементов в правильном порядке
  correctPreview: string; // правильное решение в текстовом виде
  difficulty: number; // сложность от 1 до 5
}

// Свойства компонента
interface IntegralBuilderProps {
  initialDifficulty?: number;
  timeLimit?: number;
  onComplete: (score: number, maxScore: number) => void;
}

// Типы для DnD
const ItemTypes = {
  INTEGRAL_PIECE: 'integral_piece'
};

// Предопределенный набор заданий по интегралам разной сложности
const integralTasks: IntegralTask[] = [
  // Уровень 1 - простые интегралы
  {
    id: 1,
    question: 'Соберите интеграл от функции x²',
    pieces: [
      { id: 1, type: 'integralSign', content: '∫', correctPosition: 0 },
      { id: 2, type: 'function', content: 'x²', correctPosition: 1 },
      { id: 3, type: 'dx', content: 'dx', correctPosition: 2 },
      { id: 4, type: 'result', content: 'x³/3', correctPosition: 3 },
      { id: 5, type: 'constant', content: '+ C', correctPosition: 4 },
    ],
    solution: [1, 2, 3, 4, 5],
    correctPreview: '∫ x² dx = x³/3 + C',
    difficulty: 1
  },
  {
    id: 2,
    question: 'Соберите интеграл от функции 3x',
    pieces: [
      { id: 1, type: 'integralSign', content: '∫', correctPosition: 0 },
      { id: 2, type: 'function', content: '3x', correctPosition: 1 },
      { id: 3, type: 'dx', content: 'dx', correctPosition: 2 },
      { id: 4, type: 'result', content: '3x²/2', correctPosition: 3 },
      { id: 5, type: 'constant', content: '+ C', correctPosition: 4 },
    ],
    solution: [1, 2, 3, 4, 5],
    correctPreview: '∫ 3x dx = 3x²/2 + C',
    difficulty: 1
  },

  // Уровень 2 - определенные интегралы
  {
    id: 3,
    question: 'Соберите определенный интеграл от x от 0 до 1',
    pieces: [
      { id: 1, type: 'bounds', content: '₁₀', correctPosition: 0 },
      { id: 2, type: 'integralSign', content: '∫', correctPosition: 1 },
      { id: 3, type: 'function', content: 'x', correctPosition: 2 },
      { id: 4, type: 'dx', content: 'dx', correctPosition: 3 },
      { id: 5, type: 'result', content: '= [x²/2]₀¹', correctPosition: 4 },
      { id: 6, type: 'result', content: '= 1/2', correctPosition: 5 },
    ],
    solution: [1, 2, 3, 4, 5, 6],
    correctPreview: '∫₀¹ x dx = [x²/2]₀¹ = 1/2',
    difficulty: 2
  },
  {
    id: 4,
    question: 'Соберите определенный интеграл от sin(x) от 0 до π',
    pieces: [
      { id: 1, type: 'bounds', content: 'ᵗ₀', correctPosition: 0 },
      { id: 2, type: 'integralSign', content: '∫', correctPosition: 1 },
      { id: 3, type: 'function', content: 'sin(x)', correctPosition: 2 },
      { id: 4, type: 'dx', content: 'dx', correctPosition: 3 },
      { id: 5, type: 'result', content: '= [-cos(x)]₀ᵗ', correctPosition: 4 },
      { id: 6, type: 'result', content: '= 2', correctPosition: 5 },
    ],
    solution: [1, 2, 3, 4, 5, 6],
    correctPreview: '∫₀ᵗ sin(x) dx = [-cos(x)]₀ᵗ = 2',
    difficulty: 2
  },

  // Уровень 3 - интегралы с подстановкой
  {
    id: 5,
    question: 'Соберите интеграл от e^x',
    pieces: [
      { id: 1, type: 'integralSign', content: '∫', correctPosition: 0 },
      { id: 2, type: 'function', content: 'e^x', correctPosition: 1 },
      { id: 3, type: 'dx', content: 'dx', correctPosition: 2 },
      { id: 4, type: 'result', content: '= e^x', correctPosition: 3 },
      { id: 5, type: 'constant', content: '+ C', correctPosition: 4 },
    ],
    solution: [1, 2, 3, 4, 5],
    correctPreview: '∫ e^x dx = e^x + C',
    difficulty: 3
  },
  {
    id: 6,
    question: 'Соберите интеграл от 1/x',
    pieces: [
      { id: 1, type: 'integralSign', content: '∫', correctPosition: 0 },
      { id: 2, type: 'function', content: '1/x', correctPosition: 1 },
      { id: 3, type: 'dx', content: 'dx', correctPosition: 2 },
      { id: 4, type: 'result', content: '= ln|x|', correctPosition: 3 },
      { id: 5, type: 'constant', content: '+ C', correctPosition: 4 },
    ],
    solution: [1, 2, 3, 4, 5],
    correctPreview: '∫ 1/x dx = ln|x| + C',
    difficulty: 3
  },

  // Уровень 4 - интегрирование по частям или сложная подстановка
  {
    id: 7,
    question: 'Соберите интеграл от x·sin(x) (интегрирование по частям)',
    pieces: [
      { id: 1, type: 'integralSign', content: '∫', correctPosition: 0 },
      { id: 2, type: 'function', content: 'x·sin(x)', correctPosition: 1 },
      { id: 3, type: 'dx', content: 'dx', correctPosition: 2 },
      { id: 4, type: 'result', content: '= -x·cos(x)', correctPosition: 3 },
      { id: 5, type: 'result', content: '+ ∫cos(x)dx', correctPosition: 4 },
      { id: 6, type: 'result', content: '= -x·cos(x) + sin(x)', correctPosition: 5 },
      { id: 7, type: 'constant', content: '+ C', correctPosition: 6 },
    ],
    solution: [1, 2, 3, 4, 5, 6, 7],
    correctPreview: '∫ x·sin(x) dx = -x·cos(x) + ∫cos(x)dx = -x·cos(x) + sin(x) + C',
    difficulty: 4
  },

  // Уровень 5 - сложные интегралы
  {
    id: 8,
    question: 'Соберите интеграл от 1/(1+x²)',
    pieces: [
      { id: 1, type: 'integralSign', content: '∫', correctPosition: 0 },
      { id: 2, type: 'function', content: '1/(1+x²)', correctPosition: 1 },
      { id: 3, type: 'dx', content: 'dx', correctPosition: 2 },
      { id: 4, type: 'result', content: '= arctan(x)', correctPosition: 3 },
      { id: 5, type: 'constant', content: '+ C', correctPosition: 4 },
    ],
    solution: [1, 2, 3, 4, 5],
    correctPreview: '∫ 1/(1+x²) dx = arctan(x) + C',
    difficulty: 5
  },
  {
    id: 9,
    question: 'Соберите интеграл от 1/√(1-x²)',
    pieces: [
      { id: 1, type: 'integralSign', content: '∫', correctPosition: 0 },
      { id: 2, type: 'function', content: '1/√(1-x²)', correctPosition: 1 },
      { id: 3, type: 'dx', content: 'dx', correctPosition: 2 },
      { id: 4, type: 'result', content: '= arcsin(x)', correctPosition: 3 },
      { id: 5, type: 'constant', content: '+ C', correctPosition: 4 },
    ],
    solution: [1, 2, 3, 4, 5],
    correctPreview: '∫ 1/√(1-x²) dx = arcsin(x) + C',
    difficulty: 5
  }
];

// Компонент перетаскиваемого элемента
const DraggablePiece: React.FC<{
  item: DraggableItem;
  isInCorrectSpot?: boolean;
  // Не используем индекс в упрощенной версии без DnD
  // Но оставляем его в типе для будущей совместимости
  index?: number;
}> = ({ item, isInCorrectSpot }) => {
  // Заглушка вместо DnD для демонстрации
  return (
      <div
          className={`
        px-3 py-2 m-1 rounded-lg font-mono text-lg cursor-grab
        ${isInCorrectSpot
              ? 'bg-green-600 text-white dark:bg-green-500'
              : 'bg-blue-600 text-white dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600'}
        ${item.type === 'integralSign' ? 'text-2xl' : ''}
        transition-colors
      `}
          style={{ touchAction: 'none' }}
      >
        {item.content}
      </div>
  );
};

// Компонент области для перетаскивания
const DropTarget: React.FC<{
  accept: string;
  onDrop: (item: DraggableItem & { index?: number }) => void;
  children: React.ReactNode;
  isActive: boolean;
}> = ({ children, isActive }) => {
  // Заглушка вместо DnD для демонстрации
  return (
      <div
          className={`
        min-w-[50px] min-h-[50px] m-1 p-2 rounded-lg border-2 border-dashed
        flex items-center justify-center
        ${!isActive ? 'border-gray-300 bg-gray-100 dark:bg-gray-800' : 'border-blue-300 bg-blue-50 dark:bg-blue-900'}
        transition-colors
      `}
      >
        {children}
      </div>
  );
};

// Основной компонент IntegralBuilder
const IntegralBuilder: React.FC<IntegralBuilderProps> = ({
                                                           initialDifficulty = 1,
                                                           timeLimit = 300, // 5 минут по умолчанию
                                                           onComplete
                                                         }) => {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [currentTask, setCurrentTask] = useState<IntegralTask | null>(null);
  const [availablePieces, setAvailablePieces] = useState<DraggableItem[]>([]);
  const [solutionPieces, setSolutionPieces] = useState<Array<DraggableItem | null>>([]);
  const [score, setScore] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [showHint, setShowHint] = useState(false);
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  // Старт игры
  const startGame = () => {
    setGameStarted(true);
    setScore(0);
    setTotalTasks(0);
    setTimeLeft(timeLimit);
    setDifficulty(initialDifficulty);
    loadNewTask();

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

    return () => clearInterval(timer);
  };

  // Завершение игры
  const endGame = () => {
    setGameOver(true);
    onComplete(score, totalTasks);
  };

  // Загрузка нового задания
  const loadNewTask = () => {
    // Фильтруем задания по сложности (±1 от текущей)
    const eligibleTasks = integralTasks.filter(
        task => Math.abs(task.difficulty - difficulty) <= 1
    );

    if (eligibleTasks.length === 0) {
      // Fallback на любые задания, если нет подходящих по сложности
      const randomTask = integralTasks[Math.floor(Math.random() * integralTasks.length)];
      setupTask(randomTask);
    } else {
      const randomTask = eligibleTasks[Math.floor(Math.random() * eligibleTasks.length)];
      setupTask(randomTask);
    }

    setTotalTasks(prev => prev + 1);
    setShowHint(false);
  };

  // Настройка выбранного задания
  const setupTask = (task: IntegralTask) => {
    setCurrentTask(task);

    // Перемешиваем кусочки
    const shuffledPieces = [...task.pieces].sort(() => Math.random() - 0.5);
    setAvailablePieces(shuffledPieces);

    // Создаем пустые места для решения
    setSolutionPieces(Array(task.solution.length).fill(null));
  };

  // Обработка перетаскивания пазла из доступных в решение
  const handleDropToSolution = (index: number) => (item: DraggableItem & { index?: number }) => {
    // Если это перетаскивание из доступных
    if (item.index === undefined) {
      const draggedItemIndex = availablePieces.findIndex(piece => piece.id === item.id);

      if (draggedItemIndex !== -1) {
        // Удаляем из доступных
        const newAvailablePieces = [...availablePieces];
        const [draggedItem] = newAvailablePieces.splice(draggedItemIndex, 1);

        // Добавляем в решение
        const newSolutionPieces = [...solutionPieces];

        // Если место занято, возвращаем предыдущий элемент в доступные
        if (newSolutionPieces[index] !== null) {
          newAvailablePieces.push(newSolutionPieces[index]!);
        }

        newSolutionPieces[index] = draggedItem;

        setAvailablePieces(newAvailablePieces);
        setSolutionPieces(newSolutionPieces);
      }
    }
    // Если это перетаскивание из решения в решение
    else {
      const fromIndex = item.index;

      // Перемещаем элемент
      const newSolutionPieces = [...solutionPieces];
      const draggedItem = newSolutionPieces[fromIndex];

      // Меняем местами, если место занято
      if (newSolutionPieces[index] !== null) {
        newSolutionPieces[fromIndex] = newSolutionPieces[index];
      } else {
        newSolutionPieces[fromIndex] = null;
      }

      newSolutionPieces[index] = draggedItem;

      setSolutionPieces(newSolutionPieces);
    }
  };

  // Обработка перетаскивания пазла из решения обратно в доступные
  const handleDropToAvailable = (item: DraggableItem & { index?: number }) => {
    if (item.index !== undefined) {
      // Возвращаем элемент из решения обратно в доступные
      const newSolutionPieces = [...solutionPieces];
      const draggedItem = newSolutionPieces[item.index];

      if (draggedItem) {
        newSolutionPieces[item.index] = null;
        setAvailablePieces([...availablePieces, draggedItem]);
        setSolutionPieces(newSolutionPieces);
      }
    }
  };

  // Проверка решения
  const checkSolution = () => {
    if (!currentTask) return;

    // Проверка, что все места заполнены
    if (solutionPieces.includes(null)) {
      setFeedback('Заполните все пустые места!');
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 2000);
      return;
    }

    // Проверка правильности решения
    const isCorrect = currentTask.solution.every((correctId, index) => {
      const pieceInSolution = solutionPieces[index];
      return pieceInSolution?.id === correctId;
    });

    if (isCorrect) {
      // Увеличиваем счет и сложность
      setScore(prev => prev + 1);

      // Показываем положительный фидбек
      setFeedback('Правильно! Отличная работа!');
      setShowFeedback(true);
      setTimeout(() => {
        setShowFeedback(false);

        // Увеличиваем сложность каждые 2 правильных ответа
        if (score % 2 === 1 && difficulty < 5) {
          setDifficulty(prev => Math.min(prev + 1, 5));
        }

        // Загружаем новое задание
        loadNewTask();
      }, 1500);
    } else {
      // Показываем отрицательный фидбек
      setFeedback('Не совсем верно. Попробуйте еще раз!');
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 2000);
    }
  };

  // Обработка показа подсказки
  const toggleHint = () => {
    setShowHint(prev => !prev);
  };

  // Форматирование времени
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!gameStarted) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-gray-800 dark:bg-gray-100 rounded-lg shadow-xl transition-colors">
          <h2 className="text-2xl font-bold mb-4 text-white dark:text-gray-900 transition-colors">Игра "IntegralBuilder"</h2>
          <p className="mb-6 text-gray-300 dark:text-gray-700 transition-colors">
            Соберите правильные интегралы из предложенных частей!
          </p>

          <div className="mb-6 bg-gray-700 dark:bg-gray-200 p-4 rounded transition-colors">
            <h3 className="text-lg font-semibold mb-2 text-white dark:text-gray-900 transition-colors">Правила:</h3>
            <ul className="text-left list-disc pl-5 text-gray-300 dark:text-gray-700 transition-colors">
              <li>Перетаскивайте кусочки из нижней панели в поля для ответа</li>
              <li>Расположите их в правильном порядке</li>
              <li>Нажмите "Проверить" для подтверждения решения</li>
              <li>У вас есть {formatTime(timeLimit)} на решение максимального количества заданий</li>
              <li>Начальный уровень сложности: {initialDifficulty} из 5</li>
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

                <div>Всего заданий:</div>
                <div className="font-bold">{totalTasks}</div>

                <div>Достигнутый уровень:</div>
                <div className="font-bold">{difficulty}</div>

                <div>Точность:</div>
                <div className="font-bold">
                  {totalTasks > 0
                      ? Math.round((score / totalTasks) * 100)
                      : 0}%
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            <Button onClick={() => startGame()}>Играть снова</Button>
            <Button variant="outline" onClick={() => onComplete(score, totalTasks)}>Вернуться к карте</Button>
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
              <span className="font-bold">Уровень:</span> {difficulty}
            </div>
            <div className="text-white dark:text-gray-900 transition-colors">
              <span className="font-bold">Счет:</span> {score}/{totalTasks}
            </div>
          </div>

          <div className="flex items-center">
            <div className="text-white dark:text-gray-900 transition-colors">
              <span className="font-bold">Время:</span> {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        {/* Фидбек */}
        {showFeedback && (
            <div className={`mb-4 p-3 rounded-lg text-center transition-colors ${
                feedback.includes('Правильно')
                    ? 'bg-green-600 text-white'
                    : 'bg-red-600 text-white'
            }`}>
              {feedback}
            </div>
        )}

        {/* Основная область */}
        {currentTask && (
            <div className="flex-grow flex flex-col">
              {/* Задание */}
              <div className="mb-4 p-4 bg-gray-700 dark:bg-gray-200 rounded-lg transition-colors">
                <h3 className="text-xl font-semibold mb-2 text-white dark:text-gray-900 transition-colors">
                  {currentTask.question}
                </h3>

                {showHint && (
                    <div className="mt-2 p-2 bg-blue-600 text-white rounded transition-colors">
                      <p>Правильное решение: {currentTask.correctPreview}</p>
                    </div>
                )}
              </div>

              {/* Область для сборки решения */}
              <div className="mb-6">
                <h4 className="text-lg font-medium mb-2 text-white dark:text-gray-900 transition-colors">
                  Соберите решение:
                </h4>
                <div className="flex flex-wrap items-center justify-center border border-gray-600 dark:border-gray-300 rounded-lg p-3 min-h-[100px] bg-gray-700 dark:bg-gray-200 transition-colors">
                  {solutionPieces.map((piece, index) => (
                      <DropTarget
                          key={`solution_${index}`}
                          accept={ItemTypes.INTEGRAL_PIECE}
                          onDrop={handleDropToSolution(index)}
                          isActive={true}
                      >
                        {piece && (
                            <DraggablePiece
                                item={piece}
                                isInCorrectSpot={piece.id === currentTask.solution[index]}
                                index={index}
                            />
                        )}
                      </DropTarget>
                  ))}
                </div>
              </div>

              {/* Доступные элементы */}
              <div className="mt-auto">
                <h4 className="text-lg font-medium mb-2 text-white dark:text-gray-900 transition-colors">
                  Доступные элементы:
                </h4>
                <DropTarget
                    accept={ItemTypes.INTEGRAL_PIECE}
                    onDrop={handleDropToAvailable}
                    isActive={true}
                >
                  <div className="flex flex-wrap items-center justify-center">
                    {availablePieces.map((piece) => (
                        <DraggablePiece key={piece.id} item={piece} />
                    ))}
                  </div>
                </DropTarget>
              </div>

              {/* Кнопки управления */}
              <div className="flex justify-between mt-4">
                <Button
                    variant="outline"
                    onClick={toggleHint}
                >
                  {showHint ? 'Скрыть подсказку' : 'Показать подсказку'}
                </Button>

                <Button onClick={checkSolution}>
                  Проверить решение
                </Button>
              </div>
            </div>
        )}
      </div>
  );
};

export default IntegralBuilder;