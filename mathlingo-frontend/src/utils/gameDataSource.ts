// src/utils/gameDataSource.ts

// Интерфейсы для заданий
export interface DerivativeProblem {
    id: string;
    problem: string;
    options: string[];
    answer: string;
    difficulty: 'easy' | 'medium' | 'hard';
}

export interface IntegralProblem {
    id: string;
    question: string;
    solutionPieces: string[];
    distractors: string[];
    difficulty: 'easy' | 'medium' | 'hard';
}

// Интерфейс для источника данных игры
export interface GameDataSource {
    fetchDerivativeProblems: () => Promise<DerivativeProblem[]>;
    fetchIntegralProblems: () => Promise<IntegralProblem[]>;

    // Для более продвинутых вариантов можно добавить:
    fetchDerivativeProblemsByDifficulty: (difficulty: 'easy' | 'medium' | 'hard') => Promise<DerivativeProblem[]>;
    fetchIntegralProblemsByDifficulty: (difficulty: 'easy' | 'medium' | 'hard') => Promise<IntegralProblem[]>;
    submitResult: (gameType: string, score: number, maxScore: number) => Promise<void>;
}

// Моковые данные для заданий по производным
const derivativeProblems: DerivativeProblem[] = [
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

// Моковые данные для заданий по интегралам
const integralProblems: IntegralProblem[] = [
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
    },
    {
        id: "i9",
        question: "∫ x·e^x dx",
        solutionPieces: ["x·e^x", "-e^x", "+C"],
        distractors: ["e^x", "x²·e^x/2", "e^x/x"],
        difficulty: "hard"
    },
    {
        id: "i10",
        question: "∫ tan x dx",
        solutionPieces: ["-ln|cos x|", "+C"],
        distractors: ["ln|sin x|", "ln|tan x|", "sin x/cos x"],
        difficulty: "hard"
    },
    {
        id: "i11",
        question: "∫ x·sin x dx",
        solutionPieces: ["-x·cos x", "+sin x", "+C"],
        distractors: ["x·sin x", "cos x", "-cos x", "x·cos x"],
        difficulty: "hard"
    },
    {
        id: "i12",
        question: "∫ √x dx",
        solutionPieces: ["2x^(3/2)/3", "+C"],
        distractors: ["x^(3/2)/3", "2√x", "√x/2", "x·√x"],
        difficulty: "medium"
    }
];

// Имплементация моделируемого API для получения данных
class MockGameDataSource implements GameDataSource {
    async fetchDerivativeProblems(): Promise<DerivativeProblem[]> {
        // Имитация задержки API
        await new Promise(resolve => setTimeout(resolve, 300));
        return [...derivativeProblems];
    }

    async fetchIntegralProblems(): Promise<IntegralProblem[]> {
        // Имитация задержки API
        await new Promise(resolve => setTimeout(resolve, 300));
        return [...integralProblems];
    }

    async fetchDerivativeProblemsByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): Promise<DerivativeProblem[]> {
        // Имитация задержки API
        await new Promise(resolve => setTimeout(resolve, 300));
        return derivativeProblems.filter(p => p.difficulty === difficulty);
    }

    async fetchIntegralProblemsByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): Promise<IntegralProblem[]> {
        // Имитация задержки API
        await new Promise(resolve => setTimeout(resolve, 300));
        return integralProblems.filter(p => p.difficulty === difficulty);
    }

    async submitResult(gameType: string, score: number, maxScore: number): Promise<void> {
        // Имитация отправки результатов на сервер
        console.log(`Отправка результатов игры "${gameType}": ${score}/${maxScore}`);
        await new Promise(resolve => setTimeout(resolve, 300));
        console.log('Результаты успешно сохранены');
    }
}

// Создание экспортируемого экземпляра источника данных
export const gameDataSource = new MockGameDataSource();

// В будущем можно реализовать API-версию, которая будет делать реальные запросы к серверу
export class ApiGameDataSource implements GameDataSource {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    async fetchDerivativeProblems(): Promise<DerivativeProblem[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/games/derivatives`);
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Ошибка при получении заданий по производным:', error);
            return [...derivativeProblems]; // Возвращаем моковые данные при ошибке
        }
    }

    async fetchIntegralProblems(): Promise<IntegralProblem[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/games/integrals`);
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Ошибка при получении заданий по интегралам:', error);
            return [...integralProblems]; // Возвращаем моковые данные при ошибке
        }
    }

    async fetchDerivativeProblemsByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): Promise<DerivativeProblem[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/games/derivatives?difficulty=${difficulty}`);
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Ошибка при получении заданий по производным (сложность: ${difficulty}):`, error);
            return derivativeProblems.filter(p => p.difficulty === difficulty);
        }
    }

    async fetchIntegralProblemsByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): Promise<IntegralProblem[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/games/integrals?difficulty=${difficulty}`);
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Ошибка при получении заданий по интегралам (сложность: ${difficulty}):`, error);
            return integralProblems.filter(p => p.difficulty === difficulty);
        }
    }

    async submitResult(gameType: string, score: number, maxScore: number): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/api/games/results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    gameType,
                    score,
                    maxScore,
                    timestamp: new Date().toISOString()
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
        } catch (error) {
            console.error('Ошибка при отправке результатов:', error);
        }
    }
}

// Экспорт фабричного метода для создания нужного источника данных
export const createGameDataSource = (useApi = false, baseUrl = ''): GameDataSource => {
    if (useApi && baseUrl) {
        return new ApiGameDataSource(baseUrl);
    }
    return new MockGameDataSource();
};

// По умолчанию используем моковый источник данных
export default gameDataSource;