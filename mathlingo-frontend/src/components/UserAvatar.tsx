// src/components/UserAvatar.tsx
import React from 'react';

interface UserAvatarProps {
    username: string;
    avatarId?: number;
    size?: 'sm' | 'md' | 'lg';
    onClick?: () => void;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
                                                   username,
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
    const initial = username ? username.charAt(0).toUpperCase() : '?';

    // Генерируем цвет на основе имени пользователя
    const getRandomColor = (name: string) => {
        const colors = [
            'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
            'bg-red-500', 'bg-purple-500', 'bg-pink-500',
            'bg-indigo-500', 'bg-teal-500'
        ];
        const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
        return colors[index];
    };

    // Функция для формирования URL аватарки
    const getAvatarUrl = (id: number) => `/avatars/${id}.png`;

    return (
        <div
            className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-medium cursor-pointer ${
                avatarId ? '' : getRandomColor(username)
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