// src/utils/auth.ts (исправленный)
import { getCurrentUser } from './api';

// Функции для обычных пользователей
export const login = async (email: string, password: string): Promise<any> => {
    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/login/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
            credentials: "include",
        });

        if (!response.ok) {
            throw new Error("Неверные учетные данные");
        }

        const userData = await response.json();
        localStorage.setItem('userId', userData.id.toString());
        localStorage.setItem('username', userData.username);
        return userData;
    } catch (err) {
        console.error("Ошибка входа:", err);
        throw err;
    }
};

export const register = async (username: string, email: string, password: string): Promise<any> => {
    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/register/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password }),
            credentials: "include",
        });

        if (!response.ok) {
            throw new Error("Ошибка при регистрации");
        }

        const userData = await response.json();
        localStorage.setItem('userId', userData.id.toString());
        localStorage.setItem('username', userData.username);
        return userData;
    } catch (err) {
        console.error("Ошибка регистрации:", err);
        throw err;
    }
};

export const logout = async (): Promise<void> => {
    // Очищаем локальное хранилище
    localStorage.removeItem('userId');
    localStorage.removeItem('username');

    // Отправляем запрос на сервер для удаления cookie
    try {
        await fetch(`${import.meta.env.VITE_API_URL}/api/logout/`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("Ошибка при выходе:", err);
    }
};

export const isAuthenticated = async (): Promise<boolean> => {
    try {
        await getCurrentUser();
        return true;
    } catch (err) {
        return false;
    }
};

// Функции для администраторов - переименованы, чтобы избежать конфликтов
export const adminLogin = async (email: string, password: string): Promise<any> => {
    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            throw new Error("Неверные учетные данные администратора");
        }

        const adminData = await response.json();
        localStorage.setItem('adminToken', adminData.token);
        localStorage.setItem('adminId', adminData.id.toString());
        localStorage.setItem('adminUsername', adminData.username);
        return adminData;
    } catch (err) {
        console.error("Ошибка входа администратора:", err);
        throw err;
    }
};

export const adminLogout = (): void => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminId');
    localStorage.removeItem('adminUsername');
};

export const isAdminAuthenticated = (): boolean => {
    return !!localStorage.getItem('adminToken');
};