// src/utils/LocalUserStorage.ts

interface UserData {
    id: number;
    username: string;
    email: string;
    avatarId?: number;
}

// Унифицируем имена констант (было две разных)
const USER_STORAGE_KEY = 'mathlingo_user_data';
const UPDATE_LOCK_KEY = 'mathlingo_update_lock';

export const USER_EVENTS = {
    DATA_UPDATED: 'userDataUpdated',
    AUTH_CHANGED: 'authStatusChanged'
};

/**
 * Получение данных пользователя из localStorage
 */
export const getLocalUserData = (): UserData | null => {
    try {
        // Атомарное получение данных
        const rawData = localStorage.getItem(USER_STORAGE_KEY);
        if (!rawData) return null;

        return JSON.parse(rawData);
    } catch (e) {
        console.error('Ошибка при парсинге данных пользователя из localStorage:', e);
        return null;
    }
};

// Функция-псевдоним для совместимости с другими компонентами
export const getUserData = getLocalUserData;

/**
 * Получение блокировки для предотвращения гонки состояний
 */
function acquireLock(): boolean {
    if (localStorage.getItem(UPDATE_LOCK_KEY)) {
        return false;
    }

    localStorage.setItem(UPDATE_LOCK_KEY, Date.now().toString());
    return true;
}

/**
 * Освобождение блокировки
 */
function releaseLock() {
    localStorage.removeItem(UPDATE_LOCK_KEY);
}

export const saveLocalUserData = (userData: UserData): boolean => {
    try {
        // Сохраняем только неконфиденциальные данные
        const safeData = {
            username: userData.username,
            avatarId: userData.avatarId
            // НЕ сохраняем ID и email
        };

        // Использовать sessionStorage вместо localStorage
        sessionStorage.setItem('user_display_data', JSON.stringify(safeData));

        // Уведомить компоненты о изменении данных
        window.dispatchEvent(new CustomEvent('userDataUpdated', {
            detail: userData // Для компонентов можно передавать полные данные
        }));

        return true;
    } catch (e) {
        console.error('Ошибка при сохранении данных пользователя:', e);
        return false;
    }
};

// Получение только отображаемых данных
export const getDisplayUserData = () => {
    try {
        const data = sessionStorage.getItem('user_display_data');
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
};

// Псевдоним для saveLocalUserData
export const saveUserData = saveLocalUserData;

/**
 * Обновление данных пользователя в localStorage
 */
export const updateLocalUserData = (data: Partial<UserData>): UserData | null => {
    try {
        // Блокировка для предотвращения параллельных обновлений
        if (!acquireLock()) {
            console.warn('🔒 Обновление данных уже выполняется, пропускаем');
            return null;
        }

        try {
            // Получаем текущие данные
            let currentData = getLocalUserData();

            // Восстановление из отдельных полей, если нет объекта
            if (!currentData) {
                const savedId = localStorage.getItem('user_id');
                const savedUsername = localStorage.getItem('user_username');
                const savedEmail = localStorage.getItem('user_email');
                const savedAvatarId = localStorage.getItem('user_avatar_id');

                if (savedId && savedUsername && savedEmail) {
                    currentData = {
                        id: parseInt(savedId),
                        username: savedUsername,
                        email: savedEmail,
                        avatarId: savedAvatarId ? parseInt(savedAvatarId) : undefined
                    };
                } else if (data.id && data.username && data.email) {
                    currentData = {
                        id: data.id,
                        username: data.username,
                        email: data.email,
                        avatarId: data.avatarId
                    };
                } else {
                    console.error('❌ Не удалось получить текущие данные пользователя');
                    return null;
                }
            }

            // Правильная обработка avatarId (null vs undefined)
            const updatedData: UserData = {
                id: data.id ?? currentData.id,
                username: data.username ?? currentData.username,
                email: data.email ?? currentData.email,
                avatarId: data.avatarId !== undefined ? data.avatarId : currentData.avatarId
            };

            // Атомарное сохранение данных без использования Promise.all
            // Это избавит от возможных гонок состояний
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedData));
            localStorage.setItem('user_id', updatedData.id.toString());
            localStorage.setItem('user_username', updatedData.username);
            localStorage.setItem('user_email', updatedData.email);
            localStorage.setItem('user_avatar_id', updatedData.avatarId?.toString() || '');

            // Отправляем событие только один раз после всех обновлений
            window.dispatchEvent(new CustomEvent('userDataUpdated', {
                detail: updatedData
            }));

            return updatedData;
        } finally {
            // Всегда освобождаем блокировку
            releaseLock();
        }
    } catch (e) {
        console.error('❌ Ошибка при обновлении данных пользователя:', e);
        releaseLock(); // Освобождаем блокировку даже при ошибке
        return null;
    }
};

/**
 * Синхронизация данных между вкладками
 */
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
export const clearLocalUserData = (): boolean => {
    // Получаем блокировку для атомарной операции
    if (!acquireLock()) {
        console.warn('Не удалось получить блокировку для очистки данных');
        return false;
    }

    try {
        localStorage.removeItem(USER_STORAGE_KEY);
        localStorage.removeItem('user_username');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_avatar_id');
        console.log('Данные пользователя удалены из localStorage');

        // Уведомляем о выходе
        window.dispatchEvent(new CustomEvent(USER_EVENTS.AUTH_CHANGED, {
            detail: { isAuthenticated: false }
        }));

        return true;
    } finally {
        releaseLock();
    }
};