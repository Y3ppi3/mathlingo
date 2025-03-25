// src/utils/LocalUserStorage.ts
// Временное хранилище пользовательских данных до готовности API

interface UserData {
    id: number;
    username: string;
    email: string;
    avatarId?: number;
}

const USER_STORAGE_KEY = 'mathlingo_user_data';

/**
 * Получение данных пользователя из localStorage
 */
export const getLocalUserData = (): UserData | null => {
    const userDataString = localStorage.getItem(USER_STORAGE_KEY);
    if (!userDataString) return null;

    try {
        return JSON.parse(userDataString);
    } catch (e) {
        console.error('Ошибка при парсинге данных пользователя из localStorage:', e);
        return null;
    }
};

/**
 * Сохранение данных пользователя в localStorage
 */
export const saveLocalUserData = (userData: UserData): void => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
};

/**
 * Обновление данных пользователя в localStorage
 */
export const updateLocalUserData = (data: Partial<UserData>): UserData | null => {
    const currentData = getLocalUserData();
    if (!currentData) return null;

    const updatedData = { ...currentData, ...data };
    saveLocalUserData(updatedData);

    return updatedData;
};

/**
 * Удаление данных пользователя из localStorage
 */
export const clearLocalUserData = (): void => {
    localStorage.removeItem(USER_STORAGE_KEY);
};