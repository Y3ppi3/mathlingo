// src/api/studentApi.ts
import axios from "axios";
import { clearLocalUserData } from "../utils/LocalUserStorage";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Хранение CSRF-токена
let csrfToken: string | null = null;

// Создаем экземпляр API
export const api = axios.create({
    baseURL: API_URL,
    withCredentials: true, // Для передачи cookies
    headers: {
        "Content-Type": "application/json",
    },
});

// Интерцептор для добавления токенов и CSRF
api.interceptors.request.use(async (config) => {
    // Добавляем авторизационные токены
    const adminToken = localStorage.getItem('adminToken');
    const userToken = localStorage.getItem('token');

    if (config.url?.startsWith('/admin') && adminToken) {
        config.headers['Authorization'] = `Bearer ${adminToken}`;
    } else if (userToken) {
        config.headers['Authorization'] = `Bearer ${userToken}`;
    }

    // Добавляем CSRF-токен для методов, изменяющих данные. Админские
    // эндпоинты аутентифицируются Bearer-токеном, а не cookie-сессией, и
    // backend их из CSRF-проверки исключает (main.py) — им это не нужно.
    const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase() || '');
    const isAdminRequest = config.url?.startsWith('/admin');
    if (isMutating && !isAdminRequest) {
        // Токена ещё нет (например, самая первая мутация за сессию, пока
        // AuthContext/login ещё не успели дёрнуть /api/me) — получаем его
        // ДО отправки запроса, а не постфактум через retry в
        // response-интерцепторе. Раньше это означало гарантированный первый
        // 403 (самовосстанавливающийся, но видимый в консоли браузера как
        // красная ошибка сети независимо от того, что JS его обработал).
        if (!csrfToken) {
            try {
                await api.get('/api/me');
            } catch {
                // не авторизован/нет сети — отправляем как есть, дальше
                // сработает обычная обработка 403 в response-интерцепторе.
            }
        }
        if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
            console.log('Отправляем CSRF-токен:', csrfToken);
        } else {
            console.warn('CSRF-токен отсутствует для запроса:', config.url);
        }
    }

    return config;
});

// Перехватчик для извлечения CSRF-токена из ответов
api.interceptors.response.use(
    (response) => {
        // Получаем CSRF-токен из заголовка
        const newCsrfToken = response.headers['x-csrf-token'];
        if (newCsrfToken) {
            csrfToken = newCsrfToken;
            console.log('Получен новый CSRF-токен:', newCsrfToken);
        }
        return response;
    },
    async (error) => {
        // Для 403 ошибок, связанных с CSRF — токен в памяти протух (Redis TTL
        // 3600с при более долгой сессии) либо отсутствовал (гонка на старте).
        // Раньше здесь только "тихо" освежали токен на будущее, а исходный
        // запрос (например, отправка результата только что сыгранной игры)
        // считался окончательно проваленным — результат терялся безвозвратно
        // (см. отчёт "прошёл DerivFall на 120/120, очки не засчитало", 403 в
        // логах на submit-attempt). Теперь повторяем исходный запрос один раз
        // со свежим токеном вместо того, чтобы просто готовиться к следующему.
        const originalRequest = error.config;
        if (
            error.response && error.response.status === 403 &&
            error.response.data?.detail?.includes('CSRF') &&
            originalRequest && !originalRequest._csrfRetry
        ) {
            originalRequest._csrfRetry = true;
            try {
                const meResponse = await api.get('/api/me');
                const freshToken = meResponse.headers['x-csrf-token'];
                if (freshToken) {
                    originalRequest.headers['X-CSRF-Token'] = freshToken;
                    return api.request(originalRequest);
                }
            } catch {
                // Не авторизован либо сеть недоступна — падаем в обычную обработку ниже.
            }
        }

        // Аккаунт деактивирован администратором уже ПОСЛЕ выдачи токена
        // (см. app/auth.py get_current_user) — токен ещё формально валиден,
        // но доступ закрыт. Раньше пользователь просто видел обрыв
        // очередного запроса без объяснений; теперь — выходим и объясняем.
        if (
            error.response && error.response.status === 403 &&
            error.response.data?.detail === 'Аккаунт деактивирован' &&
            window.location.pathname !== '/account-deactivated'
        ) {
            clearLocalUserData();
            window.location.href = '/account-deactivated';
        }

        return Promise.reject(error);
    }
);

// Функция для принудительного обновления CSRF-токена
export const refreshCsrfToken = async () => {
    try {
        await api.get('/api/me');
        return true;
    } catch (error) {
        console.error('Не удалось обновить CSRF-токен:', error);
        return false;
    }
};

// --- Функции для обычных пользователей ---

export const registerUser = async (username: string, email: string, password: string) => {
    try {
        const response = await api.post("/api/register/", { username, email, password });
        return response.data;
    } catch (error) {
        console.error("Ошибка регистрации:", error);
        throw error;
    }
};

export const loginUser = async (email: string, password: string) => {
    try {
        const response = await api.post("/api/login/", { email, password });
        return response.data;
    } catch (error) {
        console.error("Ошибка входа:", error);
        throw error;
    }
};

export const getCurrentUser = async () => {
    try {
        const response = await api.get("/api/me");
        return response.data;
    } catch (error) {
        console.error("Ошибка получения данных пользователя:", error);
        throw error;
    }
};

// Сброс пароля (R4) — /request всегда 204 независимо от того, существует
// ли email (см. app/routes/password_reset.py), поэтому фронтенду не нужно
// (и не следует) различать "email не найден" от "письмо отправлено".
export const requestPasswordReset = async (email: string): Promise<void> => {
    await api.post("/api/password-reset/request", { email });
};

export const confirmPasswordReset = async (token: string, newPassword: string): Promise<void> => {
    await api.post("/api/password-reset/confirm", { token, new_password: newPassword });
};

// --- Функции для администраторов ---

export const loginAdmin = async (email: string, password: string) => {
    try {
        const response = await api.post("/admin/login", { email, password });
        return response.data;
    } catch (error) {
        console.error("Ошибка входа администратора:", error);
        throw error;
    }
};

export const registerAdmin = async (username: string, email: string, password: string) => {
    try {
        const response = await api.post("/admin/register", { username, email, password });
        return response.data;
    } catch (error) {
        console.error("Ошибка регистрации администратора:", error);
        throw error;
    }
};

// --- Функции для работы с заданиями ---

export const fetchAllTasks = async () => {
    try {
        const response = await api.get("/admin/tasks");
        return response.data;
    } catch (error) {
        console.error("Ошибка получения заданий:", error);
        throw error;
    }
};

export const fetchTaskById = async (taskId: number) => {
    try {
        const response = await api.get(`/admin/tasks/${taskId}`);
        return response.data;
    } catch (error) {
        console.error(`Ошибка получения задания ${taskId}:`, error);
        throw error;
    }
};

export const createTask = async (taskData: {
    title: string;
    description?: string;
    subject: string;
    owner_id?: number;
}) => {
    try {
        const response = await api.post("/admin/tasks", taskData);
        return response.data;
    } catch (error) {
        console.error("Ошибка создания задания:", error);
        throw error;
    }
};

export const updateTask = async (
    taskId: number,
    taskData: {
        title?: string;
        description?: string;
        subject?: string;
        owner_id?: number;
    }
) => {
    try {
        const response = await api.put(`/admin/tasks/${taskId}`, taskData);
        return response.data;
    } catch (error) {
        console.error(`Ошибка обновления задания ${taskId}:`, error);
        throw error;
    }
};

export const deleteTask = async (taskId: number) => {
    try {
        await api.delete(`/admin/tasks/${taskId}`);
        return true;
    } catch (error) {
        console.error(`Ошибка удаления задания ${taskId}:`, error);
        throw error;
    }
};

export const getUserTasks = async () => {
    try {
        const response = await api.get("/api/tasks/");
        return response.data;
    } catch (error) {
        console.error("Ошибка получения заданий пользователя:", error);
        throw error;
    }
};

export const fetchAllUsers = async () => {
    try {
        const response = await api.get("/admin/users");
        return response.data;
    } catch (error) {
        console.error("Ошибка получения пользователей:", error);
        throw error;
    }
};

// --- Функции для карт и геймификации ---

export const fetchMapData = async (subjectId: number) => {
    try {
        // Получаем доступные карты для предмета
        const mapsResponse = await api.get(`/gamification/maps/${subjectId}`);
        const maps = mapsResponse.data;

        if (!maps || maps.length === 0) {
            throw new Error('Карты не найдены для этого предмета');
        }

        // Берем первую карту (для простоты)
        const mapId = maps[0].id;

        // Получаем детальные данные карты с прогрессом пользователя
        const mapDataResponse = await api.get(`/gamification/maps/${mapId}/data`);
        return mapDataResponse.data;
    } catch (error) {
        console.error('Ошибка при получении данных карты:', error);
        throw error;
    }
};

// API для групп заданий
export const fetchTaskGroup = async (groupId: number) => {
    try {
        // Меняем метод на POST, так как бэкенд не принимает GET запросы
        const response = await api.post(`/gamification/task-groups/${groupId}/data`);
        return response.data;
    } catch (error) {
        console.error('Ошибка при получении группы заданий:', error);

        // Дополнительная обработка для более подробной диагностики
        if (axios.isAxiosError(error)) {
            const statusCode = error.response?.status;
            const errorMessage = error.response?.data?.detail || error.message;
            console.error(`Код ошибки: ${statusCode}, Сообщение: ${errorMessage}`);

            // Если ошибка 405 (метод не разрешен), пробуем альтернативный путь
            if (statusCode === 405) {
                try {
                    console.log('Пробуем альтернативный путь...');
                    const altResponse = await api.get(`/api/games/${groupId}`);
                    return altResponse.data;
                } catch (altError) {
                    console.error('Альтернативный запрос также не сработал:', altError);
                }
            }
        }

        throw error;
    }
};

// API для отправки ответов на задания
export const submitTaskAnswer = async (
    taskId: number,
    answer: string,
    timeSpentMs?: number,
    hintsUsed: number = 0,
) => {
    try {
        const response = await api.post('/gamification/submit-answer', {
            task_id: taskId,
            answer: answer,
            time_spent_ms: timeSpentMs,
            hints_used: hintsUsed,
        });
        return response.data;
    } catch (error) {
        console.error('Ошибка при отправке ответа:', error);
        throw error;
    }
};

// Диагностика по теме (R2 task 3)
export interface DiagnosticTask {
    id: number;
    title: string;
    content: string;
    options?: string[];
    answer_type: 'single_answer' | 'multiple_choice';
}

export interface DiagnosticData {
    id: number;
    skill_id: number;
    tasks: DiagnosticTask[];
}

export interface DiagnosticAnswer {
    task_id: number;
    answer: string;
    time_spent_ms?: number;
    hints_used?: number;
}

export interface MasteryResult {
    skill_id: number;
    level: 'basic' | 'standard' | 'advanced';
    confidence: number;
    sample_size: number;
    factors: { accuracy: number; avg_time_ratio: number | null; hints_rate: number } | null;
}

export interface DiagnosticSubmitResult {
    results: { task_id: number; is_correct: boolean }[];
    correct_count: number;
    total_count: number;
    mastery: MasteryResult;
}

export const fetchSkillDiagnostic = async (skillId: number): Promise<DiagnosticData> => {
    const response = await api.get(`/gamification/skills/${skillId}/diagnostic`);
    return response.data;
};

export const submitDiagnostic = async (diagnosticId: number, answers: DiagnosticAnswer[]): Promise<DiagnosticSubmitResult> => {
    const response = await api.post(`/gamification/diagnostics/${diagnosticId}/submit`, { answers });
    return response.data;
};

export const fetchSkillMastery = async (skillId: number): Promise<MasteryResult> => {
    const response = await api.get(`/gamification/skills/${skillId}/mastery`);
    return response.data;
};

// Уровень с "причиной" + временный выбор соседнего (R2 task 4)
export type SkillLevelValue = 'basic' | 'standard' | 'advanced';

export interface LevelOverrideInfo {
    chosen_level: SkillLevelValue;
    reason: string;
    expires_at: string;
}

export interface SkillLevel {
    skill_id: number;
    computed_level: SkillLevelValue | null;
    confidence: number;
    sample_size: number;
    factors: { accuracy: number; avg_time_ratio: number | null; hints_rate: number } | null;
    override: LevelOverrideInfo | null;
    effective_level: SkillLevelValue | null;
}

export const fetchSkillLevel = async (skillId: number): Promise<SkillLevel> => {
    const response = await api.get(`/gamification/skills/${skillId}/level`);
    return response.data;
};

export const setSkillLevelOverride = async (skillId: number, chosenLevel: SkillLevelValue): Promise<SkillLevel> => {
    const response = await api.post(`/gamification/skills/${skillId}/level-override`, { chosen_level: chosenLevel });
    return response.data;
};

export const clearSkillLevelOverride = async (skillId: number): Promise<SkillLevel> => {
    const response = await api.delete(`/gamification/skills/${skillId}/level-override`);
    return response.data;
};

// Конфиг игрового сценария (R3 task 3) — DerivFall больше не хранит задания
// в коде, а запрашивает текущий опубликованный сценарий шаблона здесь.
export interface DerivFallProblemConfig {
    id: string;
    problem: string;
    options: string[];
    answer: string;
    difficulty: 'easy' | 'medium' | 'hard';
}

export interface DerivFallGameConfig {
    difficulty: number;
    time_limit: number;
    problems: DerivFallProblemConfig[];
}

// R3 task 4
export interface IntegralBuilderProblemConfig {
    id: string;
    question: string;
    solution_pieces: string[];
    distractors: string[];
    difficulty: 'easy' | 'medium' | 'hard';
}

export interface IntegralBuilderGameConfig {
    initial_difficulty: number;
    time_limit: number;
    problems: IntegralBuilderProblemConfig[];
}

export interface MathLabTaskConfig {
    id: string;
    type: 'analyze' | 'find' | 'calculate' | 'limit' | 'series' | 'slope';
    question: string;
    function_expression: string;
    correct_answer: string;
    options?: string[];
    difficulty: number;
    hints: string[];
    // Точка приближения (R4, mode="limits") — "2", "infinity", "-infinity".
    approach_x?: string | null;
    // Точка старта траектории [x0, y0] (R4, mode="slopefield").
    start_point?: [number, number] | null;
}

export interface MathLabGameConfig {
    mode: 'derivatives' | 'integrals' | 'limits' | 'series' | 'slopefield';
    difficulty: number;
    tasks: MathLabTaskConfig[];
}

// Мапперы snake_case (API) -> camelCase (пропсы компонентов) — общие для
// GamePage.tsx (студенческий рендер) и admin GameScenariosPanel.tsx
// (live-предпросмотр "от лица ученика" при конструировании сценария).
export interface IntegralBuilderProblemProp {
    id: string;
    question: string;
    solutionPieces: string[];
    distractors: string[];
    difficulty: 'easy' | 'medium' | 'hard';
}

export const mapIntegralBuilderProblems = (problems: IntegralBuilderProblemConfig[]): IntegralBuilderProblemProp[] =>
    problems.map(p => ({
        id: p.id,
        question: p.question,
        solutionPieces: p.solution_pieces,
        distractors: p.distractors,
        difficulty: p.difficulty,
    }));

export interface MathLabTaskProp {
    id: string;
    type: 'analyze' | 'find' | 'calculate' | 'limit';
    question: string;
    functionExpression: string;
    correctAnswer: string;
    options?: string[];
    difficulty: number;
    hints: string[];
    approachX?: string | null;
}

export const mapMathLabTasks = (tasks: MathLabTaskConfig[]): MathLabTaskProp[] =>
    tasks.map(t => ({
        id: t.id,
        type: t.type,
        question: t.question,
        functionExpression: t.function_expression,
        correctAnswer: t.correct_answer,
        options: t.options,
        difficulty: t.difficulty,
        hints: t.hints,
        approachX: t.approach_x,
    }));

// mode="limits" (R4, игра "Приближение") гарантирует approach_x/options на
// бэкенде (см. game_config.py) — здесь просто сужаем тип под это
// гарантированное подмножество, без доп. проверок в компоненте игры.
export interface LimitsTaskProp {
    id: string;
    question: string;
    functionExpression: string;
    approachX: string;
    correctAnswer: string;
    options: string[];
    difficulty: number;
    hints: string[];
}

export const mapLimitsTasks = (tasks: MathLabTaskConfig[]): LimitsTaskProp[] =>
    tasks.map(t => ({
        id: t.id,
        question: t.question,
        functionExpression: t.function_expression,
        approachX: t.approach_x as string,
        correctAnswer: t.correct_answer,
        options: t.options as string[],
        difficulty: t.difficulty,
        hints: t.hints,
    }));

// mode="series" (R4, игра "Наполнение") — function_expression здесь
// хранит формулу общего члена a(n) (переменная n, не x), см. game_config.py.
export interface SeriesTaskProp {
    id: string;
    question: string;
    termExpression: string;
    correctAnswer: string;
    options: string[];
    difficulty: number;
    hints: string[];
}

export const mapSeriesTasks = (tasks: MathLabTaskConfig[]): SeriesTaskProp[] =>
    tasks.map(t => ({
        id: t.id,
        question: t.question,
        termExpression: t.function_expression,
        correctAnswer: t.correct_answer,
        options: t.options as string[],
        difficulty: t.difficulty,
        hints: t.hints,
    }));

// mode="slopefield" (R4, игра "Наклон") — function_expression здесь хранит
// правую часть ОДУ f(x,y) в dy/dx = f(x,y) (переменные x И y), см.
// game_config.py. options — явные формулы y(x) кандидатных кривых, они же
// строки для отображения (тот же паттерн, что у limits/series).
export interface SlopeFieldTaskProp {
    id: string;
    question: string;
    fieldExpression: string;
    startPoint: [number, number];
    correctAnswer: string;
    options: string[];
    difficulty: number;
    hints: string[];
}

export const mapSlopeFieldTasks = (tasks: MathLabTaskConfig[]): SlopeFieldTaskProp[] =>
    tasks.map(t => ({
        id: t.id,
        question: t.question,
        fieldExpression: t.function_expression,
        startPoint: t.start_point as [number, number],
        correctAnswer: t.correct_answer,
        options: t.options as string[],
        difficulty: t.difficulty,
        hints: t.hints,
    }));

export interface ActiveGameScenario<TConfig> {
    id: number;
    template_key: string;
    config: TConfig;
    level_range: number[] | null;
}

export const fetchActiveGameScenario = async <TConfig,>(templateKey: string, mode?: string): Promise<ActiveGameScenario<TConfig>> => {
    const response = await api.get(`/gamification/game-scenarios/active/${templateKey}`, { params: mode ? { mode } : undefined });
    return response.data;
};

// R3 task 6: одна попытка на всю сыгранную сессию (не на каждый
// внутриигровой ответ) — см. app/services/game_attempts.py на бэкенде.
export interface GameAttemptSubmission {
    is_correct: boolean;
}

export const submitGameAttempt = async (
    scenarioId: number,
    score: number,
    maxScore: number,
    timeSpentMs?: number,
): Promise<GameAttemptSubmission> => {
    const response = await api.post(`/gamification/game-scenarios/${scenarioId}/submit-attempt`, {
        score, max_score: maxScore, time_spent_ms: timeSpentMs,
    });
    return response.data;
};

// Сводка для Dashboard.tsx (R4) — реальная активность/очки/прогресс по
// темам вместо захардкоженных STATS/RECENT/TOPICS_PROGRESS. Раньше здесь
// был fetchUserProgress(), дёргавший несуществующий /gamification/progress
// (мёртвый код — ни разу не вызывался, эндпоинта не было вовсе).
export interface StudentActivityStats {
    total_attempts: number;
    accuracy_pct: number;
    streak_days: number;
    total_time_hours: number;
    total_points: number;
}

export interface StudentActivityItem {
    id: number;
    title: string;
    topic: string;
    is_correct: boolean;
    time_spent_ms: number | null;
    created_at: string;
}

export interface StudentTopicProgress {
    skill_id: number;
    skill_name: string;
    level: 'basic' | 'standard' | 'advanced';
    progress_pct: number;
    done: number;
}

export interface StudentDashboard {
    activity: StudentActivityStats;
    recent_activity: StudentActivityItem[];
    topics_progress: StudentTopicProgress[];
}

export const fetchStudentDashboard = async (): Promise<StudentDashboard> => {
    const response = await api.get('/gamification/dashboard');
    return response.data;
};