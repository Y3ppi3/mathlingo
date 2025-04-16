// src/components/games/DerivFall.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Button from '../Button';

// Interface for derivative problem
interface DerivativeProblem {
  id: string;
  problem: string;
  options: string[];
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

// Interface for component props
interface DerivFallProps {
  difficulty?: number;
  timeLimit?: number;
  problemsSource?: DerivativeProblem[];
  onComplete?: (score: number, maxScore: number) => void;
}

// Default problems to use if source is not provided
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

// Define fixed positions for problems to prevent overlap
const FIXED_POSITIONS = [20, 50, 80]; // Left, center, right positions

const DerivFall: React.FC<DerivFallProps> = ({
                                               difficulty = 3,
                                               timeLimit = 60, // Fixed at 1 minute exactly (60 seconds)
                                               problemsSource,
                                               onComplete
                                             }) => {
  console.log("DerivFall initialized with difficulty:", difficulty); // Log the received difficulty

  // Falling problems state
  const [problems, setProblems] = useState<Array<{
    id: string;
    problem: string;
    options: string[];
    answer: string;
    difficulty: 'easy' | 'medium' | 'hard';
    left: number;
    top: number;
    answered: boolean;
    correct?: boolean;
    column?: number; // Track which column the problem is in (0, 1, 2)
  }>>([]);

  // Game state
  const [score, setScore] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [pointsLost, setPointsLost] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePaused, setGamePaused] = useState(false);
  const [difficultyLevel, setDifficultyLevel] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [speed, setSpeed] = useState(6000); // milliseconds for falling
  const [timeRemaining, setTimeRemaining] = useState(60); // Fixed to 60 seconds (1 minute)
  const [problemBank, setProblemBank] = useState<DerivativeProblem[]>(DEFAULT_PROBLEMS);
  const [problemsCompleted, setProblemsCompleted] = useState(0);
  const [problemsIncorrect, setProblemsIncorrect] = useState(0);
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');

  // Add a state to track when we need to force create a problem after unpause
  const [needProblemAfterUnpause, setNeedProblemAfterUnpause] = useState(false);

  // Track which columns are currently in use
  const [usedColumns, setUsedColumns] = useState<boolean[]>([false, false, false]);

  // Limit simultaneous problems on screen
  const maxProblemsOnScreen = 3;

  // Refs
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const problemTimeoutsRef = useRef<{[key: string]: NodeJS.Timeout}>({});
  const gameActiveRef = useRef(false);
  // Add a ref to track the current score reliably
  const currentScoreRef = useRef(0);
  // Add the gameStateRef at the component level
  const gameStateRef = useRef({ isPaused: false });
  // Track last problem creation time
  const lastProblemTimeRef = useRef(0);

  // Update the gameStateRef when the pause state changes
  useEffect(() => {
    gameStateRef.current.isPaused = gamePaused;

    // Force create a problem when unpausing if needed
    if (!gamePaused && needProblemAfterUnpause && gameStarted && !gameOver) {
      console.log("Detecting unpause - will force create problem");

      setNeedProblemAfterUnpause(false);

      // Small delay to ensure state is up to date
      const timer = setTimeout(() => {
        const activeProblemsCount = problems.filter(p => !p.answered).length;
        console.log(`Active problems after unpause: ${activeProblemsCount}/${maxProblemsOnScreen}`);

        if (activeProblemsCount < maxProblemsOnScreen) {
          console.log("Creating problem directly after unpause");
          createProblem();
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [gamePaused]);

  // Initialize CSS variable for animation control
  useEffect(() => {
    document.documentElement.style.setProperty('--animations-paused', 'running');

    return () => {
      // Clean up when component unmounts
      document.documentElement.style.removeProperty('--animations-paused');
    };
  }, []);

  // Set feedback message
  const setFeedback = useCallback((message: string, type: 'success' | 'error') => {
    setFeedbackMessage(message);
    setFeedbackType(type);
    setShowFeedback(true);

    // Hide feedback after a short delay
    setTimeout(() => {
      setShowFeedback(false);
    }, 800);
  }, []);

  // Load problems from source or use defaults
  useEffect(() => {
    if (problemsSource && problemsSource.length > 0) {
      setProblemBank(problemsSource);
    } else {
      setProblemBank([...DEFAULT_PROBLEMS]);
    }
  }, [problemsSource]);

  // Set difficulty level based on props
  useEffect(() => {
    console.log("Setting difficulty level based on:", difficulty);

    if (difficulty <= 2) {
      setDifficultyLevel('easy');
      setSpeed(7000); // 7 seconds for falling in easy mode
      console.log("Setting EASY difficulty - speed: 7000ms");
    } else if (difficulty >= 5) {
      setDifficultyLevel('hard');
      setSpeed(4000); // 4 seconds for falling in hard mode
      console.log("Setting HARD difficulty - speed: 4000ms");
    } else {
      setDifficultyLevel('medium');
      setSpeed(5500); // 5.5 seconds for falling in medium mode
      console.log("Setting MEDIUM difficulty - speed: 5500ms");
    }
  }, [difficulty]);

  // End game function
  const endGame = useCallback(() => {
    setGameOver(true);
    setGameStarted(false);
    setGamePaused(false);
    gameActiveRef.current = false;

    // Clear all timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (gameIntervalRef.current) {
      clearInterval(gameIntervalRef.current);
      gameIntervalRef.current = null;
    }

    Object.values(problemTimeoutsRef.current).forEach(clearTimeout);
    problemTimeoutsRef.current = {};

    // Use the current score from the ref, which is always up-to-date
    const finalScore = currentScoreRef.current;

    // Debug log to trace score calculation
    console.log("Game ended with score:", finalScore);
    console.log("Problems completed:", problemsCompleted, "x 10 points =", problemsCompleted * 10);
    console.log("Current score ref value:", currentScoreRef.current);

    if (onComplete) {
      const maxScore = problemsCompleted > 0 ? problemsCompleted * 10 : 10;
      console.log("Passing to onComplete - score:", finalScore, "maxScore:", maxScore);

      // Pass the actual score from our ref
      onComplete(finalScore, maxScore);
    }
  }, [problemsCompleted, onComplete]);

  // Find a free column for a new problem to avoid overlap
  const getFreeColumn = useCallback(() => {
    // Update usedColumns based on current problems
    const activeProblems = problems.filter(p => !p.answered);
    const currentColumns = [false, false, false];

    activeProblems.forEach(problem => {
      if (problem.column !== undefined) {
        currentColumns[problem.column] = true;
      }
    });

    // Find the first free column
    const freeColumnIndex = currentColumns.findIndex(used => !used);

    if (freeColumnIndex !== -1) {
      return freeColumnIndex;
    }

    // If all columns are used, find the column with the fewest problems
    const columnCounts = [0, 0, 0];
    activeProblems.forEach(problem => {
      if (problem.column !== undefined) {
        columnCounts[problem.column]++;
      }
    });

    // Return the column with the fewest problems
    const minCount = Math.min(...columnCounts);
    return columnCounts.findIndex(count => count === minCount);
  }, [problems]);

  // Create a new falling problem
  const createProblem = useCallback(() => {
    console.log("Create problem called - checking conditions");

    // Check if we should create a new problem
    if (lives <= 0 || gameOver || !gameActiveRef.current || gameStateRef.current.isPaused) {
      console.log("Not creating problem - game inactive or paused");
      return;
    }

    // Don't create more than max problems
    const activeProblems = problems.filter(p => !p.answered);
    if (activeProblems.length >= maxProblemsOnScreen) {
      console.log("Not creating problem - already at max problems");
      return;
    }

    // Enforce minimum time between problem creation to prevent bunching
    const now = Date.now();
    if (now - lastProblemTimeRef.current < 1000) { // At least 1 second between problems
      console.log("Not creating problem - too soon after last problem");
      return;
    }

    lastProblemTimeRef.current = now;

    console.log("Creating new problem...");

    // Filter problems by difficulty
    let filteredProblems = problemBank.filter(p => {
      if (difficultyLevel === 'easy') return p.difficulty === 'easy';
      if (difficultyLevel === 'medium') return p.difficulty === 'easy' || p.difficulty === 'medium';
      return true; // For hard difficulty, use all problems
    });

    if (filteredProblems.length === 0) {
      filteredProblems = [...problemBank]; // Fallback to all problems
    }

    // Pick a random problem
    const randomIndex = Math.floor(Math.random() * filteredProblems.length);
    const problem = filteredProblems[randomIndex];
    const newProblemId = `prob-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Find a free column to place the problem
    const columnIndex = getFreeColumn();
    const leftPosition = FIXED_POSITIONS[columnIndex];

    console.log(`Adding new problem with ID: ${newProblemId} in column ${columnIndex} at position ${leftPosition}`);

    // Add the new problem
    setProblems(prev => [
      ...prev,
      {
        ...problem,
        id: newProblemId,
        left: leftPosition,
        top: 0,
        answered: false,
        column: columnIndex
      }
    ]);

    // Update used columns
    const newUsedColumns = [...usedColumns];
    newUsedColumns[columnIndex] = true;
    setUsedColumns(newUsedColumns);

    // Account for pause state in timeout calculation
    const fallDuration = speed + 1000;

    // Schedule removal when it falls out of view
    problemTimeoutsRef.current[newProblemId] = setTimeout(() => {
      // Check the current pause state from the ref
      if (gameStateRef.current.isPaused) {
        // If game is paused, don't remove the problem or penalize the player
        return;
      }

      setProblems(prev => {
        const problemExists = prev.find(p => p.id === newProblemId && !p.answered);
        if (problemExists) {
          // Only deduct life and points if game is not paused
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) {
              endGame();
            }
            return newLives;
          });

          // Deduct 5 points for missed problems
          const pointsToSubtract = 5;
          setPointsLost(prev => prev + pointsToSubtract);

          // Update both state and ref
          currentScoreRef.current = Math.max(0, currentScoreRef.current - pointsToSubtract);
          setScore(currentScoreRef.current);

          setFeedback("Пропущена задача! -5 очков", "error");

          // Free up the column
          if (problemExists.column !== undefined) {
            const newUsedColumns = [...usedColumns];
            newUsedColumns[problemExists.column] = false;
            setUsedColumns(newUsedColumns);
          }
        }
        return prev.filter(p => p.id !== newProblemId);
      });

      // Remove timer reference
      delete problemTimeoutsRef.current[newProblemId];
    }, fallDuration);
  }, [
    difficultyLevel, problemBank, problems, lives, gameOver,
    getFreeColumn, endGame, setFeedback, speed, usedColumns,
    maxProblemsOnScreen
  ]);

  // Setup problem generation interval
  const setupProblemGenerationInterval = useCallback(() => {
    // Clear any existing interval first
    if (gameIntervalRef.current) {
      clearInterval(gameIntervalRef.current);
      gameIntervalRef.current = null;
    }

    // Determine problem interval based on difficulty
    let problemInterval;
    if (difficultyLevel === 'easy') {
      // Increase to 5000ms (5 seconds)
      problemInterval = 5000;
    } else if (difficultyLevel === 'medium') {
      // Increase to 4000ms (4 seconds)
      problemInterval = 4000;
    } else {
      // Increase to 3000ms (3 seconds)
      problemInterval = 3000;
    }

    console.log(`Setting up problem generation interval: ${problemInterval}ms`);

    // Create new interval for problem generation
    gameIntervalRef.current = setInterval(() => {
      if (!gameStateRef.current.isPaused && gameActiveRef.current) {
        createProblem();
      }
    }, problemInterval);

    return () => {
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current);
        gameIntervalRef.current = null;
      }
    };
  }, [difficultyLevel, createProblem]);

  // Handle answer selection
  const handleAnswerSelect = useCallback((problemId: string, selectedOption: string, correctAnswer: string) => {
    // Mark problem as answered
    setProblems(prev => {
      const problem = prev.find(p => p.id === problemId);
      if (problem && problem.column !== undefined) {
        // Free up the column
        const newUsedColumns = [...usedColumns];
        newUsedColumns[problem.column] = false;
        setUsedColumns(newUsedColumns);
      }

      return prev.map(p => p.id === problemId ?
          {...p, answered: true, correct: selectedOption === correctAnswer} : p);
    });

    // Clear timeout for this problem
    if (problemTimeoutsRef.current[problemId]) {
      clearTimeout(problemTimeoutsRef.current[problemId]);
      delete problemTimeoutsRef.current[problemId];
    }

    if (selectedOption === correctAnswer) {
      // Correct answer - add 10 points
      const pointsToAdd = 10;
      setPointsEarned(prev => prev + pointsToAdd);

      // Update both state and ref for score
      currentScoreRef.current += pointsToAdd;
      setScore(currentScoreRef.current);

      setProblemsCompleted(p => p + 1);
      setFeedback("Правильно! +10 очков", "success");

      // Log for debugging score issue
      console.log("Correct answer! New score:", currentScoreRef.current, "Problems completed:", problemsCompleted + 1);
    } else {
      // Incorrect answer - subtract 5 points
      const pointsToSubtract = 5;
      setPointsLost(prev => prev + pointsToSubtract);

      // Update both state and ref, preventing negative score
      currentScoreRef.current = Math.max(0, currentScoreRef.current - pointsToSubtract);
      setScore(currentScoreRef.current);

      setProblemsIncorrect(p => p + 1);
      setFeedback(`Неверно! -5 очков. Ответ: ${correctAnswer}`, "error");

      // Log for debugging score issue
      console.log("Incorrect answer! New score:", currentScoreRef.current, "Problems incorrect:", problemsIncorrect + 1);
    }

    // Remove problem with animation
    setTimeout(() => {
      setProblems(prev => prev.filter(p => p.id !== problemId));
    }, 800);
  }, [usedColumns, setFeedback, problemsCompleted, problemsIncorrect]);

  // Reset game
  const resetGame = useCallback(() => {
    // Clear all timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (gameIntervalRef.current) {
      clearInterval(gameIntervalRef.current);
      gameIntervalRef.current = null;
    }

    Object.values(problemTimeoutsRef.current).forEach(clearTimeout);
    problemTimeoutsRef.current = {};

    // Reset all state
    setProblems([]);
    setScore(0);
    // Reset the score ref too
    currentScoreRef.current = 0;
    setPointsEarned(0);
    setPointsLost(0);
    setLives(3);
    setGameOver(false);
    setGameStarted(false);
    setGamePaused(false);
    setTimeRemaining(60); // Reset to exactly 60 seconds
    setProblemsCompleted(0);
    setProblemsIncorrect(0);
    setShowFeedback(false);
    setUsedColumns([false, false, false]);
    setNeedProblemAfterUnpause(false);

    gameActiveRef.current = false;
    gameStateRef.current.isPaused = false;
    lastProblemTimeRef.current = 0;
  }, []);

  // Start game
  const startGame = useCallback(() => {
    if (gameActiveRef.current) return; // Prevent double-start

    // Set initial game state
    setGameStarted(true);
    setGamePaused(false);
    gameStateRef.current.isPaused = false;
    setTimeRemaining(60); // Ensure exactly 60 seconds
    gameActiveRef.current = true;

    console.log("Starting game...");

    // Clear any existing timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    Object.values(problemTimeoutsRef.current).forEach(clearTimeout);
    problemTimeoutsRef.current = {};

    // Start game timer - 1 minute countdown
    timerRef.current = setInterval(() => {
      if (!gameStateRef.current.isPaused) {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    // Reset used columns
    setUsedColumns([false, false, false]);

    // Generate first problem after a short delay
    setTimeout(() => {
      createProblem();

      // Set up interval for creating subsequent problems
      setupProblemGenerationInterval();
    }, 1000);
  }, [createProblem, endGame, setupProblemGenerationInterval]);

  // Handle pause/unpause effects
  useEffect(() => {
    if (gameStarted && !gameOver) {
      // Set the CSS variable based on pause state
      document.documentElement.style.setProperty(
          '--animations-paused',
          gamePaused ? 'paused' : 'running'
      );
    }
  }, [gamePaused, gameStarted, gameOver]);

  // Start game with countdown
  const startGameWithCountdown = useCallback(() => {
    resetGame();
    setCountdownActive(true);
    setCountdown(3);

    // Start countdown
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
  }, [resetGame, startGame]);

  // Toggle pause with better handling for problem generation
  const togglePause = useCallback(() => {
    setGamePaused(prev => {
      const newPausedState = !prev;

      // Update the ref immediately
      gameStateRef.current.isPaused = newPausedState;

      if (newPausedState) {
        // --- PAUSING GAME ---
        console.log("Pausing game");

        // Pause CSS animations
        document.documentElement.style.setProperty('--animations-paused', 'paused');

        // Clear intervals
        if (gameIntervalRef.current) {
          clearInterval(gameIntervalRef.current);
          gameIntervalRef.current = null;
        }

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        // --- UNPAUSING GAME ---
        console.log("Unpausing game");

        // Resume CSS animations
        document.documentElement.style.setProperty('--animations-paused', 'running');

        // Restart timer
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

        // Flag that we need to create a problem after unpause
        setNeedProblemAfterUnpause(true);

        // Reset last problem time to allow immediate creation
        lastProblemTimeRef.current = 0;

        // Restart the problem generation interval
        setupProblemGenerationInterval();
      }

      return newPausedState;
    });
  }, [endGame, setupProblemGenerationInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
      Object.values(problemTimeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

  // Format time display
  const formatTime = (seconds: number): string => {
    // Ensure we display exactly 1:00 for 60 seconds
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  // Get difficulty display text
  const getDifficultyDisplayText = useCallback(() => {
    // Use the raw difficulty value rather than the mapped enum for better display
    if (difficulty <= 2) return 'Легкий';
    if (difficulty >= 5) return 'Сложный';
    return 'Средний';
  }, [difficulty]);

  return (
      <div
          className="w-full h-full flex flex-col bg-gray-700 dark:bg-gray-200 rounded-lg overflow-hidden transition-colors">
        {/* Header panel */}
        <div
            className="px-4 py-3 flex justify-between items-center bg-gray-600 dark:bg-gray-300 border-b border-gray-500 dark:border-gray-400 transition-colors">
          <div className="flex items-center space-x-6">
            <div className="text-gray-100 dark:text-gray-900 font-medium transition-colors">
              Счет: <span className="font-bold">{score}</span>
            </div>
            <div className="flex items-center">
              <span className="text-gray-100 dark:text-gray-900 mr-2 transition-colors">Жизни:</span>
              <span
                  className="text-red-500 dark:text-red-600 transition-colors">{Array(lives).fill('❤️').join('')}</span>
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

            <div
                className="px-2 py-1 rounded-md text-sm font-medium bg-gray-500 dark:bg-gray-400 text-white dark:text-gray-900 transition-colors">
              {getDifficultyDisplayText()} ({difficulty}/5)
            </div>
          </div>
        </div>

        {/* Game area */}
        <div
            ref={gameAreaRef}
            className="relative flex-1 overflow-hidden bg-gray-700 dark:bg-gray-200 transition-colors"
            style={{height: '500px'}}
        >
          {/* Falling problems */}
          {problems.map(problem => (
              !problem.answered ? (
                  <div
                      key={problem.id}
                      data-problem-id={problem.id}
                      className="absolute bg-blue-700 dark:bg-blue-200 p-3 rounded-lg shadow-lg text-center transition-colors"
                      style={{
                        left: `${problem.left}%`,
                        top: '-80px',
                        width: '200px', // Fixed width to avoid going off-screen
                        transform: 'translateX(-50%)', // Center based on left position
                        // Use CSS variable to control animation state
                        animation: gamePaused
                            ? 'none'
                            : `fallNew ${speed / 1000}s linear forwards`,
                        // Store current position when paused
                        animationPlayState: gamePaused ? 'paused' : 'running',
                        zIndex: parseInt(problem.id.split('-')[1]) % 10,
                      }}
                  >
                    <div className="text-lg mb-2 font-medium text-white dark:text-gray-900 transition-colors">
                      {problem.problem}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {problem.options.map((option, idx) => (
                          <button
                              key={idx}
                              className="bg-purple-700 dark:bg-purple-200 text-white dark:text-gray-900 hover:bg-purple-600 dark:hover:bg-purple-300 px-2 py-1 rounded-lg transition-colors truncate overflow-hidden h-10 flex items-center justify-center text-sm"
                              onClick={() => handleAnswerSelect(problem.id, option, problem.answer)}
                              disabled={gamePaused}
                              title={option} // Show full text on hover
                          >
                            {option}
                          </button>
                      ))}
                    </div>
                  </div>
              ) : (
                  <div
                      key={problem.id}
                      className="absolute p-3 rounded-lg shadow-lg text-center transition-colors"
                      style={{
                        left: `${problem.left}%`,
                        top: `${problem.top}%`,
                        width: '200px',
                        transform: 'translateX(-50%)',
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

          {/* Pause overlay */}
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

          {/* Game over screen */}
          {gameOver && (
              <div
                  className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 dark:bg-opacity-70 z-20 transition-colors">
                <div
                    className="text-center bg-gray-600 dark:bg-gray-300 p-6 rounded-lg shadow-xl max-w-md mx-auto transition-colors">
                  <h2 className="text-2xl mb-4 font-bold text-white dark:text-gray-900 transition-colors">
                    Игра окончена!
                  </h2>
                  <p className="mb-3 text-xl text-white dark:text-gray-900 transition-colors">
                    Итоговый счет: <span className="font-bold">{currentScoreRef.current}</span>
                  </p>
                  <div className="mb-6 grid grid-cols-2 gap-2 text-gray-300 dark:text-gray-700">
                    <div>Заработано очков:</div>
                    <div className="font-bold text-green-500">+{pointsEarned}</div>

                    <div>Потеряно очков:</div>
                    <div className="font-bold text-red-500">-{pointsLost}</div>

                    <div>Правильных ответов:</div>
                    <div className="font-bold">{problemsCompleted}</div>

                    <div>Неправильных ответов:</div>
                    <div className="font-bold">{problemsIncorrect}</div>

                    <div>Пропущенных задач:</div>
                    <div className="font-bold">{3 - lives}</div>
                  </div>
                  <Button onClick={startGameWithCountdown}>
                    Играть снова
                  </Button>
                </div>
              </div>
          )}

          {/* Start screen */}
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
                  {getDifficultyDisplayText()} ({difficulty}/5)
                </span>
                  </p>
                  <div className="mb-4 p-4 bg-gray-500 dark:bg-gray-400 rounded-lg transition-colors">
                    <h3 className="font-bold text-white dark:text-gray-900 mb-2 transition-colors">Как играть:</h3>
                    <ul className="text-left text-gray-200 dark:text-gray-800 list-disc pl-5 transition-colors">
                      <li>Выбирайте правильный ответ из вариантов</li>
                      <li>За каждый правильный ответ: +10 очков</li>
                      <li>За каждый неправильный ответ: -5 очков</li>
                      <li>За пропущенную задачу: -5 очков и -1 жизнь</li>
                      <li>3 пропущенные задачи = конец игры</li>
                      <li>У вас ровно 1 минута!</li>
                    </ul>
                  </div>
                  <Button onClick={startGameWithCountdown}>
                    Начать игру
                  </Button>
                </div>
              </div>
          )}

          {/* Countdown screen */}
          {countdownActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-30">
                <div className="text-9xl font-bold text-white animate-pulse">
                  {countdown}
                </div>
              </div>
          )}

          {/* Feedback notification */}
          {showFeedback && (
              <div
                  className="absolute bottom-8 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-40"
                  style={{
                    animation: 'bounce 0.5s',
                    backgroundColor: feedbackType === 'success'
                        ? 'var(--bg-green-700, rgb(21, 128, 61))'
                        : 'var(--bg-red-700, rgb(185, 28, 28))',
                    color: 'white'
                  }}
              >
                {feedbackMessage}
              </div>
          )}

          {/* Background grid */}
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 gap-0.5 pointer-events-none">
            {Array(48).fill(0).map((_, idx) => (
                <div
                    key={idx}
                    className="bg-gray-600 dark:bg-gray-300 bg-opacity-20 dark:bg-opacity-20 transition-colors"
                ></div>
            ))}
          </div>
        </div>

        {/* Animation styles */}
        <style>
          {`
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
          
          .animate-pulse {
            animation: pulse 1.5s infinite;
          }
          
          /* Fixed: The closing brace and selector were missing */
          * {
            animation-play-state: var(--animations-paused, running) !important;
          }
        `}
        </style>
      </div>
  );
};

export default DerivFall;