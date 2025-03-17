// src/utils/adminApi.ts
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Создаем инстанс axios с базовыми настройками
export const adminApi = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Интерцептор для добавления токена в заголовок Authorization
adminApi.interceptors.request.use((config) => {
    const token = localStorage.getItem("adminToken");
    if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
});

// Интерфейсы для данных
export interface Task {
    id?: number;
    title: string;
    description?: string;
    subject: string;
    owner_id?: number;
}

export interface Subject {
    id?: number;
    name: string;
    code: string;
    description?: string;
    order?: number;
    icon?: string;
    is_active?: boolean;
    created_at?: string;
    tasks_count?: number;
}

export interface User {
    id: number;
    username: string;
    email: string;
    is_active: boolean;
    created_at: string;
}

// Функции для работы с задачами
export const fetchTasks = async (): Promise<Task[]> => {
    const response = await adminApi.get("/admin/tasks");
    return response.data;
};

export const fetchTask = async (id: number): Promise<Task> => {
    const response = await adminApi.get(`/admin/tasks/${id}`);
    return response.data;
};

export const createTask = async (task: Task): Promise<Task> => {
    const response = await adminApi.post("/admin/tasks", task);
    return response.data;
};

export const updateTask = async (id: number, task: Partial<Task>): Promise<Task> => {
    const response = await adminApi.put(`/admin/tasks/${id}`, task);
    return response.data;
};

export const deleteTask = async (id: number): Promise<void> => {
    await adminApi.delete(`/admin/tasks/${id}`);
};

// Функции для работы с пользователями
export const fetchUsers = async (): Promise<User[]> => {
    const response = await adminApi.get("/admin/users");
    return response.data;
};

// Функции для работы с разделами
export const fetchSubjects = async (): Promise<Subject[]> => {
    const response = await adminApi.get("/admin/subjects");
    return response.data;
};

export const fetchSubject = async (id: number): Promise<Subject> => {
    const response = await adminApi.get(`/admin/subjects/${id}`);
    return response.data;
};

export const createSubject = async (subject: Subject): Promise<Subject> => {
    const response = await adminApi.post("/admin/subjects", subject);
    return response.data;
};

export const updateSubject = async (id: number, subject: Partial<Subject>): Promise<Subject> => {
    const response = await adminApi.put(`/admin/subjects/${id}`, subject);
    return response.data;
};

export const deleteSubject = async (id: number): Promise<void> => {
    await adminApi.delete(`/admin/subjects/${id}`);
};