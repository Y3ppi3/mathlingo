// src/components/UserMenu.tsx
import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import UserAvatar from './UserAvatar';
import ThemeToggle from './ThemeToggle';

interface UserMenuProps {
    username: string;
    email: string;
    avatarId?: number;
    onLogout: () => void;
    onClose: () => void;
    isOpen: boolean;
}

const UserMenu: React.FC<UserMenuProps> = ({
                                               username,
                                               email,
                                               avatarId,
                                               onLogout,
                                               onClose,
                                               isOpen
                                           }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    // Закрываем меню при клике вне его
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={menuRef}
            className="absolute top-full right-0 mt-2 w-64 bg-gray-800 dark:bg-white rounded-lg shadow-lg overflow-hidden z-50 transition-all"
        >
            {/* Верхняя часть с информацией о пользователе */}
            <div className="p-4 border-b border-gray-700 dark:border-gray-200">
                <div className="flex items-center space-x-3">
                    <UserAvatar username={username} avatarId={avatarId} size="md"/>
                    <div>
                        <div className="font-medium text-white dark:text-gray-900">{username}</div>
                        <div className="text-sm text-gray-400 dark:text-gray-500 truncate">{email}</div>
                    </div>
                </div>
                <Link
                    to="/profile"
                    className="mt-3 block w-full px-4 py-2 text-center text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-500 transition-colors"
                    onClick={onClose}
                >
                    Открыть профиль
                </Link>
            </div>

            {/* Настройки */}
            <div className="py-1 border-b border-gray-700 dark:border-gray-200">
                <Link
                    to="/profile/settings"
                    className="block px-4 py-2 text-sm text-gray-300 dark:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={onClose}
                >
                    Настройки профиля
                </Link>
                <button
                    onClick={() => {
                        onLogout();
                        onClose();
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-400 dark:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                    Выйти
                </button>
            </div>

            {/* Инструменты */}
            <div className="py-2 px-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-300 dark:text-gray-700">Тема</div>
                    <ThemeToggle isCompact={true} />
                </div>
                <div className="flex items-center justify-between mt-2">
                    <div className="text-sm text-gray-300 dark:text-gray-700">Язык</div>
                    <select className="text-sm bg-gray-700 dark:bg-gray-100 border-none rounded p-1 cursor-pointer">
                        <option value="ru">Русский</option>
                        <option value="en">English</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

export default UserMenu;