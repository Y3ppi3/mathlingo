// src/components/layout/UserMenu.tsx
import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Home, Gamepad2, Settings, LogOut } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import ThemeToggle from '../ui/ThemeToggle';

interface UserMenuProps {
    username: string;
    email: string;
    avatarId?: number;
    onLogout: () => void;
    onClose: () => void;
    isOpen: boolean;
}

const ITEMS = [
    { to: '/profile', label: 'Мой профиль', icon: User },
    { to: '/dashboard', label: 'Главная', icon: Home },
    { to: '/games', label: 'Игры', icon: Gamepad2 },
    { to: '/profile/settings', label: 'Настройки', icon: Settings },
];

const UserMenu = ({ username, email, avatarId, onLogout, onClose, isOpen }: UserMenuProps) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={menuRef}
            className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden z-50 border-2 border-gray-100 dark:border-gray-700 origin-top-right animate-pop-in"
        >
            {/* Заголовок с информацией о пользователе */}
            <div className="p-4 bg-gradient-to-r from-indigo-500 to-violet-500 text-white">
                <div className="flex items-center gap-3">
                    <div className="ring-2 ring-white/40 rounded-full">
                        <UserAvatar username={username} avatarId={avatarId} size="md" />
                    </div>
                    <div className="overflow-hidden">
                        <div className="font-extrabold truncate">{username}</div>
                        <div className="text-xs text-indigo-100 truncate">{email}</div>
                    </div>
                </div>
            </div>

            {/* Основные пункты меню */}
            <div className="py-1.5">
                {ITEMS.map(({ to, label, icon: Icon }) => (
                    <Link
                        key={to}
                        to={to}
                        onClick={onClose}
                        className="flex items-center gap-3 px-4 py-2.5 mx-1.5 rounded-2xl text-gray-700 dark:text-gray-200 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                    >
                        <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        <span>{label}</span>
                    </Link>
                ))}
            </div>

            <div className="border-t-2 border-gray-100 dark:border-gray-700" />

            {/* Тема/язык */}
            <div className="px-4 py-3 space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-300 text-sm font-semibold">Тема</span>
                    <ThemeToggle isCompact={true} />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-300 text-sm font-semibold">Язык</span>
                    <select className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-xl px-2.5 py-1 border-2 border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
                        <option>Русский</option>
                        <option>English</option>
                    </select>
                </div>
            </div>

            <div className="border-t-2 border-gray-100 dark:border-gray-700" />

            {/* Выход */}
            <button
                onClick={() => { onLogout(); onClose(); }}
                className="w-full text-left px-4 py-3 flex items-center gap-3 text-cardinal dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
                <LogOut className="w-5 h-5" />
                <span>Выйти</span>
            </button>
        </div>
    );
};

export default UserMenu;
