// src/components/layout/Navbar.tsx
import { useState, useEffect, JSX } from 'react';
import { Link, useLocation } from "react-router-dom";
import { Gamepad2, GraduationCap, Users, Trophy, Menu, X } from 'lucide-react';
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/logo.png";
import UserAvatar from "../ui/UserAvatar";
import UserMenu from "./UserMenu";
import { useUser } from "../../hooks/useUser";

// Основная навигация — единый источник и для десктопа, и для мобильного меню,
// чтобы ссылки не разъезжались (раньше на мобилке «Экзамен» и «Лидерборд»
// были недоступны: в шапке скрыты, в меню под аватаром их не было).
const NAV_LINKS: { to: string; label: string; icon: JSX.Element }[] = [
    { to: "/games", label: "Игры", icon: <Gamepad2 className="w-4 h-4" /> },
    { to: "/exam", label: "Экзамен", icon: <GraduationCap className="w-4 h-4" /> },
    { to: "/tutors", label: "Репетиторы", icon: <Users className="w-4 h-4" /> },
    { to: "/games/leaderboard", label: "Лидерборд", icon: <Trophy className="w-4 h-4" /> },
];

function Navbar() {
    const { isAuthenticated, logout } = useAuth();
    const { user, loading } = useUser();
    const { pathname } = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // Отдельное состояние для мобильного меню-«бургера» (не путать с меню под аватаром).
    const [isNavOpen, setIsNavOpen] = useState(false);

    // Ключ для принудительного обновления компонента UserMenu при изменении пользовательских данных
    const [menuKey, setMenuKey] = useState(Date.now());

    useEffect(() => {
        if (user) {
            setMenuKey(Date.now());
        }
    }, [user]);

    // Мобильное меню закрываем при переходе на другой маршрут.
    useEffect(() => { setIsNavOpen(false); }, [pathname]);

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    // Активна ссылка с самым длинным совпадающим префиксом пути — иначе
    // «Лидерборд» (/games/leaderboard) подсвечивал бы и «Игры» (/games).
    const activeTo = (() => {
        const matches = NAV_LINKS.filter((l) => pathname === l.to || pathname.startsWith(l.to + '/'));
        if (!matches.length) return null;
        return matches.reduce((a, b) => (b.to.length > a.to.length ? b : a)).to;
    })();

    return (
        <nav className="bg-white/95 dark:bg-gray-900/95 backdrop-blur text-gray-900 dark:text-white fixed top-0 left-0 w-full z-50 border-b-2 border-gray-100 dark:border-gray-800 transition-colors">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-between items-center h-16">
                    {/* Левая часть: бургер (моб.) + лого + название + основная навигация */}
                    <div className="flex items-center gap-2 sm:gap-5">
                        {isAuthenticated && (
                            <button
                                type="button"
                                onClick={() => setIsNavOpen((v) => !v)}
                                aria-label="Меню"
                                aria-expanded={isNavOpen}
                                className="sm:hidden -ml-1 p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                {isNavOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        )}
                        <Link to="/" className="flex items-center gap-2.5 group">
                            <img
                                src={logo}
                                alt="MathLingo"
                                className="h-9 w-9 object-contain group-hover:animate-bob"
                            />
                            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
                                MathLingo
                            </span>
                        </Link>
                        {isAuthenticated && (
                            <div className="hidden sm:flex items-center gap-1">
                                {NAV_LINKS.map((link) => {
                                    const active = activeTo === link.to;
                                    return (
                                        <Link
                                            key={link.to}
                                            to={link.to}
                                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
                                                active
                                                    ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                                                    : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <span className={active ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}>
                                                {link.icon}
                                            </span>
                                            {link.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Правая часть: аватар или кнопки входа */}
                    <div className="relative">
                        {isAuthenticated ? (
                            <>
                                <button
                                    type="button"
                                    onClick={toggleMenu}
                                    aria-label="Меню профиля"
                                    className="rounded-full ring-2 ring-transparent hover:ring-indigo-200 dark:hover:ring-indigo-500/40 transition-all"
                                >
                                    {loading ? (
                                        <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                    ) : (
                                        <UserAvatar
                                            username={user?.username || 'Пользователь'}
                                            avatarId={user?.avatarId}
                                            size="sm"
                                        />
                                    )}
                                </button>

                                {!loading && user && (
                                    <UserMenu
                                        key={`menu-${menuKey}`}
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
                            <div className="flex items-center gap-2 sm:gap-3">
                                <Link
                                    to="/login"
                                    className="px-3 py-2 rounded-xl text-sm font-bold text-gray-500 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    Вход
                                </Link>
                                <Link
                                    to="/register"
                                    className="btn-3d bg-brand hover:bg-brand-dark border-brand-deep text-white text-sm px-4 py-2 focus-visible:ring-brand-light"
                                >
                                    Регистрация
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Мобильное меню-«бургер»: раскрывает основную навигацию на узких экранах */}
                {isAuthenticated && isNavOpen && (
                    <div className="sm:hidden border-t-2 border-gray-100 dark:border-gray-800 py-2 flex flex-col gap-1 animate-float-up">
                        {NAV_LINKS.map((link) => {
                            const active = activeTo === link.to;
                            return (
                                <Link
                                    key={link.to}
                                    to={link.to}
                                    className={`inline-flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-base font-bold transition-colors ${
                                        active
                                            ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                                            : 'text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    {link.icon}
                                    {link.label}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </nav>
    );
}

export default Navbar;
