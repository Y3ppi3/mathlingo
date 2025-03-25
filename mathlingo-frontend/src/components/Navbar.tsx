// Обновленный Navbar.tsx
import React, { useState } from 'react';
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";
import UserAvatar from "./UserAvatar";
import UserMenu from "./UserMenu";
import { useUser } from "../hooks/useUser";

function Navbar() {
    const { isAuthenticated, logout } = useAuth();
    const { user, loading } = useUser();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    return (
        <nav className="bg-gray-900 text-white dark:bg-white dark:text-gray-900 p-4 fixed top-0 left-0 w-full z-50 shadow-md transition-colors">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-between items-center h-16">
                    {/* Левая часть: лого + название */}
                    <Link to="/" className="flex items-center space-x-4">
                        <img
                            src={logo}
                            alt="MathLingo Logo"
                            className="h-8 w-8 object-contain"
                        />
                        <span className="text-xl font-bold hover:text-indigo-400 transition-colors">
                            MathLingo
                        </span>
                    </Link>

                    {/* Правая часть: аватар или кнопки входа */}
                    <div className="relative">
                        {isAuthenticated ? (
                            <>
                                <div className="cursor-pointer" onClick={toggleMenu}>
                                    {loading ? (
                                        <div className="h-8 w-8 rounded-full bg-gray-600 animate-pulse"></div>
                                    ) : (
                                        <UserAvatar
                                            username={user?.username || 'Пользователь'}
                                            avatarId={user?.avatarId}
                                            size="sm"
                                        />
                                    )}
                                </div>

                                {!loading && user && (
                                    <UserMenu
                                        key={`user-menu-${user.username}-${user.avatarId}`}
                                        isOpen={isMenuOpen}
                                        onClose={() => setIsMenuOpen(false)}
                                        username={user.username}
                                        email={user.email}
                                        avatarId={user.avatarId}
                                        onLogout={logout}
                                    />
                                )}
                            </>
                        ) : (
                            <div className="flex items-center space-x-4">
                                <Link
                                    to="/login"
                                    className="px-3 hover:text-indigo-300 transition-colors"
                                >
                                    Вход
                                </Link>
                                <Link
                                    to="/register"
                                    className="px-3 hover:text-indigo-300 transition-colors"
                                >
                                    Регистрация
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;