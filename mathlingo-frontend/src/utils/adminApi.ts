// Updated adminApi.ts with improved error handling
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Create axios instance with base settings
export const adminApi = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
    // Important: Include credentials to ensure cookies are sent
    withCredentials: true,
});

// Add token to requests
adminApi.interceptors.request.use((config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    console.error("Request error:", error);
    return Promise.reject(error);
});

// Add response interceptor for better error handling
adminApi.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle CORS errors
        if (error.message === 'Network Error') {
            console.error('CORS or network error:', error);
            return Promise.reject(new Error('Проблема с сетевым подключением. Возможно, CORS не настроен на сервере.'));
        }

        // Return the error response data if it exists (for confirmation flow)
        if (error.response && error.response.data) {
            return Promise.resolve(error.response);
        }

        return Promise.reject(error);
    }
);

// Data interfaces
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

// Task functions
export const fetchTasks = async (): Promise<Task[]> => {
    try {
        const response = await adminApi.get("/admin/tasks");
        return response.data;
    } catch (error) {
        console.error('Error fetching tasks:', error);
        throw error;
    }
};

export const fetchTask = async (id: number): Promise<Task> => {
    try {
        const response = await adminApi.get(`/admin/tasks/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching task ${id}:`, error);
        throw error;
    }
};

export const createTask = async (task: Task): Promise<Task> => {
    try {
        const response = await adminApi.post("/admin/tasks", task);
        return response.data;
    } catch (error) {
        console.error('Error creating task:', error);
        throw error;
    }
};

export const updateTask = async (id: number, task: Partial<Task>): Promise<Task> => {
    try {
        const response = await adminApi.put(`/admin/tasks/${id}`, task);
        return response.data;
    } catch (error) {
        console.error(`Error updating task ${id}:`, error);
        throw error;
    }
};

export const deleteTask = async (id: number): Promise<void> => {
    try {
        await adminApi.delete(`/admin/tasks/${id}`);
    } catch (error) {
        console.error(`Error deleting task ${id}:`, error);
        throw error;
    }
};

// User functions
export const fetchUsers = async (): Promise<User[]> => {
    try {
        const response = await adminApi.get("/admin/users");
        return response.data;
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
};

// Subject functions
export const fetchSubjects = async (): Promise<Subject[]> => {
    try {
        const response = await adminApi.get("/admin/subjects");
        return response.data;
    } catch (error) {
        console.error('Error fetching subjects:', error);
        throw error;
    }
};

export const fetchSubject = async (id: number): Promise<Subject> => {
    try {
        const response = await adminApi.get(`/admin/subjects/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching subject ${id}:`, error);
        throw error;
    }
};

export const createSubject = async (subject: Subject): Promise<Subject> => {
    try {
        const response = await adminApi.post("/admin/subjects", subject);
        return response.data;
    } catch (error) {
        console.error('Error creating subject:', error);
        throw error;
    }
};

export const updateSubject = async (id: number, subject: Partial<Subject>): Promise<Subject> => {
    try {
        const response = await adminApi.put(`/admin/subjects/${id}`, subject);
        return response.data;
    } catch (error) {
        console.error(`Error updating subject ${id}:`, error);
        throw error;
    }
};

export const deleteSubject = async (id: number, force: boolean = false): Promise<any> => {
    try {
        // Use axios directly to handle all response statuses as success
        const response = await adminApi.delete(`/admin/subjects/${id}${force ? '?force=true' : ''}`);
        return response.data;
    } catch (error: any) {
        // If we received a well-formed response, return it
        if (error.response && error.response.data) {
            return error.response.data;
        }
        // Otherwise throw the error
        throw error;
    }
};

export const deleteUser = async (userId: number): Promise<void> => {
    try {
        await adminApi.delete(`/admin/users/${userId}`);
    } catch (error) {
        console.error(`Error deleting user ${userId}:`, error);
        throw error;
    }
};

export const updateUserStatus = async (userId: number, isActive: boolean): Promise<void> => {
    try {
        await adminApi.put(`/admin/users/${userId}/status`, { is_active: isActive });
    } catch (error) {
        console.error(`Error updating user status ${userId}:`, error);
        throw error;
    }
};

// Adventure map functions
export const deleteAdventureMap = async (mapId: number, force: boolean = false): Promise<any> => {
    try {
        const response = await adminApi.delete(`/admin/gamification/maps/${mapId}${force ? '?force=true' : ''}`);
        return response.data;
    } catch (error: any) {
        // If we received a well-formed response, return it (for confirmation flow)
        if (error.response && error.response.data) {
            return error.response.data;
        }
        throw error;
    }
};