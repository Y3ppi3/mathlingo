// src/utils/LocalUserStorage.ts - исправленная версия

interface UserData {
    id: number;
    username: string;
    email: string;
    avatarId?: number;
}

const USER_STORAGE_KEY = 'mathlingo_user_data';
const USER_DATA_SYNC_EVENT = 'mathlingo_user_data_sync';

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
    try {
        // Базовые проверки
        if (!userData.id || !userData.username || !userData.email) {
            console.error('Попытка сохранить неполные данные пользователя:', userData);
            return;
        }

        // Сохраняем данные в localStorage
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));

        // Отправляем событие синхронизации для текущей вкладки
        window.dispatchEvent(new CustomEvent('userDataUpdated', {
            detail: userData
        }));

        // Всегда сохраняем отдельные поля, даже если avatarId равен null
        localStorage.setItem('user_username', userData.username);
        localStorage.setItem('user_id', userData.id.toString());
        localStorage.setItem('user_email', userData.email);
        localStorage.setItem('user_avatar_id', userData.avatarId?.toString() || '');

        console.log('✅ Данные пользователя сохранены:', userData);
    } catch (e) {
        console.error('Ошибка при сохранении данных пользователя:', e);
    }
};

/**
 * Обновление данных пользователя в localStorage
 */
export const updateLocalUserData = (data: Partial<UserData>): UserData | null => {
    try {
        // Получаем текущие данные
        const currentData = getLocalUserData();
        if (!currentData) {
            console.error('Не удалось получить текущие данные пользователя для обновления');
            return null;
        }

        // Создаем обновленный объект, явно сохраняя все поля
        const updatedData: UserData = {
            id: currentData.id,
            username: data.username !== undefined ? data.username : currentData.username,
            email: data.email !== undefined ? data.email : currentData.email,
            avatarId: data.avatarId !== undefined ? data.avatarId : currentData.avatarId
        };

        // Логируем изменения для отладки
        console.log('Обновление данных пользователя:');
        if (data.username !== undefined && data.username !== currentData.username) {
            console.log(`- Имя: ${currentData.username} -> ${data.username}`);
        }
        if (data.avatarId !== undefined && data.avatarId !== currentData.avatarId) {
            console.log(`- Аватар: ${currentData.avatarId} -> ${data.avatarId}`);
        }

        // Сохраняем обновленные данные
        saveLocalUserData(updatedData);

        // Дополнительно отправляем событие для компонентов, которые могут слушать изменения
        window.dispatchEvent(new CustomEvent('userDataUpdated', {
            detail: updatedData
        }));

        return updatedData;
    } catch (e) {
        console.error('Ошибка при обновлении данных пользователя:', e);
        return null;
    }
};

export const initUserDataSync = (): void => {
    // Прослушиваем события хранилища (изменения localStorage в других вкладках)
    window.addEventListener('storage', (event) => {
        if (event.key === USER_STORAGE_KEY && event.newValue) {
            try {
                // Получаем новые данные и отправляем событие об изменении
                const userData = JSON.parse(event.newValue);
                console.log('📢 Обнаружено изменение данных пользователя в другой вкладке:', userData);

                // Уведомляем компоненты о синхронизации
                window.dispatchEvent(new CustomEvent('userDataUpdated', {
                    detail: userData
                }));
            } catch (e) {
                console.error('Ошибка при синхронизации данных между вкладками:', e);
            }
        }

        // Отдельно отслеживаем изменения имени пользователя
        if (event.key === 'user_username' && event.newValue) {
            console.log(`📢 Имя пользователя изменено в другой вкладке: ${event.newValue}`);

            // При изменении отдельных полей, обновляем полный объект для синхронизации
            const currentData = getLocalUserData();
            if (currentData) {
                currentData.username = event.newValue;

                // Отправляем событие с обновленными данными
                window.dispatchEvent(new CustomEvent('userDataUpdated', {
                    detail: currentData
                }));
            }
        }
    });

    console.log('✅ Инициализирована синхронизация данных пользователя между вкладками');
};

/**
 * Удаление данных пользователя из localStorage
 */
export const clearLocalUserData = (): void => {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem('user_username');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_avatar_id');
    console.log('Данные пользователя удалены из localStorage');
};