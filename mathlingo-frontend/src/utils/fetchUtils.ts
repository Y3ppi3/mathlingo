// src/utils/fetchUtils.ts
export const fetchWithRetry = async (url: string, options: any, maxRetries = 3) => {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 секунд таймаут

            const fetchOptions = {
                ...options,
                signal: controller.signal
            };

            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            return response;
        } catch (err) {
            console.warn(`Попытка ${attempt}/${maxRetries} не удалась:`, err);
            lastError = err;

            if (attempt < maxRetries) {
                // Экспоненциальная задержка между попытками
                const delayMs = 1000 * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    throw lastError || new Error('Все попытки запроса не удались');
};