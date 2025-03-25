// src/utils/apiClient.ts
import { fetchWithRetry } from './fetchUtils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Базовые настройки запросов
const defaultOptions = {
    credentials: 'include' as RequestCredentials,
    headers: {
        'Content-Type': 'application/json'
    }
};

// Единый класс для API-запросов
class ApiClient {
    // Аутентификация
    async login(email: string, password: string) {
        return this.sendRequest('/api/login/', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }

    async register(username: string, email: string, password: string) {
        return this.sendRequest('/api/register/', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
    }

    async logout() {
        return this.sendRequest('/api/logout/', { method: 'POST' });
    }

    // Профиль пользователя
    async getCurrentUser() {
        return this.sendRequest('/api/me');
    }

    async updateProfile(data: {username?: string, avatarId?: number | null}) {
        return this.sendRequest('/api/me/update', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // Вспомогательный метод для отправки запросов
    private async sendRequest(endpoint: string, options = {}) {
        try {
            const response = await fetchWithRetry(
                `${API_URL}${endpoint}`,
                { ...defaultOptions, ...options },
                3 // Количество попыток
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Произошла ошибка при запросе');
            }

            return response.json();
        } catch (error) {
            console.error(`Ошибка API [${endpoint}]:`, error);
            throw error;
        }
    }
}

export const api = new ApiClient();