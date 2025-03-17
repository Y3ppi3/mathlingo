import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";
import ThemeToggle from "./ThemeToggle";

function Navbar() {
    const { isAuthenticated, logout } = useAuth();

    return (
        // Базовые (тёмные) → bg-gray-900 text-white
        // При отсутствии .dark → dark:bg-white dark:text-gray-900
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

                    {/* Правая часть: кнопки + переключатель темы */}
                    <div className="flex items-center space-x-4">
                        {isAuthenticated ? (
                            <button
                                onClick={logout}
                                className="px-3 hover:text-indigo-300 transition-colors"
                            >
                                Выйти
                            </button>
                        ) : (
                            <>
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
                            </>
                        )}
                        <ThemeToggle />
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
