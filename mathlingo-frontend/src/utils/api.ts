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