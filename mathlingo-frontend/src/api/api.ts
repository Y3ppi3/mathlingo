import axios from "axios";

const API_URL = "http://127.0.0.1:8000/api"; // Базовый URL бэкенда

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Функция для регистрации пользователя
export const registerUser = async (username: string, email: string, password: string) => {
    try {
        const response = await api.post("/register/", {
            username,
            email,
            password,
        });
        console.log("Ответ от сервера:", response.data);
        return response.data;
    } catch (error) {
        console.error("Ошибка регистрации:", error);
        throw error;
    }
};

// Функция для входа пользователя (если у тебя уже есть логин API)
export const loginUser = async (email: string, password: string) => {
    try {
        const response = await api.post("/login/", {
            email,
            password,
        });
        return response.data;
    } catch (error) {
        console.error("Ошибка входа:", error);
        throw error;
    }
};
