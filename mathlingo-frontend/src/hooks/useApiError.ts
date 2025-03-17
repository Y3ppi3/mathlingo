// src/hooks/useApiError.ts
import { useState } from 'react';

export function useApiError() {
    const [error, setError] = useState<string>('');

    const handleError = (err: unknown, defaultMessage: string = 'Произошла ошибка') => {
        console.error(defaultMessage, err);

        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError(defaultMessage);
        }

        return err; // Возвращаем ошибку для возможной дальнейшей обработки
    };

    return { error, setError, handleError };
}