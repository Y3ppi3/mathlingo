// src/components/UserAvatar.tsx
import React from 'react';

interface UserAvatarProps {
    username: string;
    avatarId?: number;
    size?: 'sm' | 'md' | 'lg';
    onClick?: () => void;
}

// Перемещаем функцию getRandomColor за пределы компонента
// чтобы она не создавалась заново при каждом рендере
const getRandomColor = (name: string) => {
    // Проверка на undefined/null
    if (!name) {
        return 'bg-gray-500'; // Возвращаем цвет по умолчанию
    }

    const colors = [
        'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
        'bg-red-500', 'bg-purple-500', 'bg-pink-500',
        'bg-indigo-500', 'bg-teal-500'
    ];

    // Теперь безопасно вызываем split()
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
};

// Функция для формирования URL аватарки
const getAvatarUrl = (id: number) => `/avatars/${id}.png`;

const UserAvatar: React.FC<UserAvatarProps> = ({
                                                   username = '',
                                                   avatarId,
                                                   size = 'md',
                                                   onClick
                                               }) => {
    // Определяем размеры для разных значений size
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-16 h-16 text-lg',
    };

    // Получаем первую букву имени пользователя
    const initial = (username && username.length > 0)
        ? username.charAt(0).toUpperCase()
        : '?';

    // Получаем цвет на основе имени пользователя
    // Теперь эта функция используется после её объявления
    const colorClass = username ? getRandomColor(username) : 'bg-gray-500';

    return (
        <div
            className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-medium cursor-pointer ${
                avatarId ? '' : colorClass
            }`}
            onClick={onClick}
        >
            {avatarId ? (
                <img
                    src={getAvatarUrl(avatarId)}
                    alt={username}
                    className="w-full h-full rounded-full object-cover"
                />
            ) : (
                initial
            )}
        </div>
    );
};

export default UserAvatar;