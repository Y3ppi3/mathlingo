// src/utils/api.ts (объединенный)
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({
    baseURL: API_URL,
    withCredentials: true, // Для передачи cookies
    headers: {
        "Content-Type": "application/json",
    },
});

// Интерцептор для добавления токенов
api.interceptors.request.use((config) => {
    const adminToken = localStorage.getItem('adminToken');
    const userToken = localStorage.getItem('token');

    if (config.url?.startsWith('/admin') && adminToken) {
        config.headers['Authorization'] = `Bearer ${adminToken}`;
    } else if (userToken) {
        config.headers['Authorization'] = `Bearer ${userToken}`;
    }

    return config;
});

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
export const submitTaskAnswer = async (taskId: number, answer: string) => {
    try {
        const response = await api.post('/gamification/submit-answer', {
            task_id: taskId,
            answer: answer
        });
        return response.data;
    } catch (error) {
        console.error('Ошибка при отправке ответа:', error);
        throw error;
    }
};

// API для прогресса пользователя
export const fetchUserProgress = async () => {
    try {
        const response = await api.get('/gamification/progress');
        return response.data;
    } catch (error) {
        console.error('Ошибка при получении прогресса пользователя:', error);
        throw error;
    }
};