// src/components/UserMenu.tsx (обновленный)
import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import UserAvatar from './UserAvatar';
import ThemeToggle from './ThemeToggle';

const UserMenu = ({ username, email, avatarId, onLogout, onClose, isOpen }) => {
    const menuRef = useRef(null);

    // Эффект для обработки клика вне компонента
    useEffect(() => {
        // Функция-обработчик клика
        const handleClickOutside = (event) => {
            // Если меню открыто и клик был вне элемента menuRef
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose(); // Закрываем меню
            }
        };

        // Добавляем слушатель события только если меню открыто
        if (isOpen) {
            // Используем mousedown вместо click для лучшей отзывчивости
            document.addEventListener('mousedown', handleClickOutside);
            // Также слушаем touchstart для мобильных устройств
            document.addEventListener('touchstart', handleClickOutside);
        }

        // Функция очистки, которая выполняется при размонтировании компонента
        // или при изменении зависимостей useEffect
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen, onClose]); // Зависимости эффекта - перезапускается при изменении isOpen или onClose

    // Если меню закрыто, ничего не рендерим
    if (!isOpen) return null;

    return (
        <div ref={menuRef} className="absolute top-full right-0 mt-2 w-64 bg-gray-800 dark:bg-white rounded-lg shadow-xl overflow-hidden z-50 transition-all duration-150 transform origin-top-right">
            {/* Заголовок с информацией о пользователе */}
            <div className="p-4 border-b border-gray-700 dark:border-gray-200 bg-gradient-to-r from-indigo-500 to-blue-600 text-white">
                <div className="flex items-center space-x-3">
                    <UserAvatar username={username} avatarId={avatarId} size="md" />
                    <div>
                        <div className="font-bold truncate">{username}</div>
                        <div className="text-xs text-indigo-100 truncate">{email}</div>
                    </div>
                </div>
            </div>

            {/* Основные пункты меню */}
            <div className="py-1">
                <Link to="/profile" className="flex items-center px-4 py-3 hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors" onClick={onClose}>
                    <svg className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-gray-200 dark:text-gray-700">Мой профиль</span>
                </Link>

                <Link to="/dashboard" className="flex items-center px-4 py-3 hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors" onClick={onClose}>
                    <svg className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span className="text-gray-200 dark:text-gray-700">Домашняя страница</span>
                </Link>

                <Link to="/profile/settings" className="flex items-center px-4 py-3 hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors" onClick={onClose}>
                    <svg className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-gray-200 dark:text-gray-700">Настройки</span>
                </Link>
            </div>

            {/* Разделитель */}
            <div className="border-t border-gray-700 dark:border-gray-200"></div>

            {/* Настройки темы/языка */}
            <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300 dark:text-gray-700 text-sm">Тема</span>
                    <ThemeToggle isCompact={true} />
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-gray-300 dark:text-gray-700 text-sm">Язык</span>
                    <select className="bg-gray-700 dark:bg-gray-100 text-gray-300 dark:text-gray-700 text-sm rounded px-2 py-1 border-none focus:ring-1 focus:ring-indigo-500">
                        <option>Русский</option>
                        <option>English</option>
                    </select>
                </div>
            </div>

            {/* Кнопка выхода */}
            <button
                onClick={() => { onLogout(); onClose(); }}
                className="w-full text-left px-4 py-3 flex items-center text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            >
                <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Выйти</span>
            </button>
        </div>
    );
};

export default UserMenu;