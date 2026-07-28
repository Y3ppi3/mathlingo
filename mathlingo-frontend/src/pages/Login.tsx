import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../config/apiBase";
import mascot from "../assets/logo.png";

const API_URL = API_BASE;

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/login/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, remember_me: rememberMe }),
                credentials: "include",
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || "Неверный email или пароль");
            }

            const userData = await response.json();
            await login(userData);
            navigate("/dashboard");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Неизвестная ошибка");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center px-4 overflow-hidden transition-colors">

            {/* Декоративные математические символы */}
            <div className="absolute inset-0 pointer-events-none select-none">
                <span
                    className="absolute top-20 left-10 text-8xl text-gray-200/80 dark:text-slate-800/60 font-serif">∫</span>
                <span
                    className="absolute bottom-20 right-10 text-9xl text-gray-200/80 dark:text-slate-800/60 font-serif">∑</span>
                <span
                    className="absolute top-1/2 right-1/4 text-7xl text-gray-200/60 dark:text-slate-800/40 font-serif">π</span>
            </div>

            <div className="w-full max-w-md relative z-10">
                <div
                    className="bg-white dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 rounded-3xl p-8 shadow-card-hover transition-colors">

                    {/* Заголовок */}
                    <div className="text-center mb-8">
                        <img src={mascot} alt="Маскот MathLingo" className="w-20 h-20 mx-auto object-contain animate-bob mb-3" />
                        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white transition-colors">
                            С возвращением!
                        </h1>
                        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1 transition-colors">
                            Войдите в MathLingo
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <p className="text-cardinal dark:text-red-400 text-sm font-semibold bg-cardinal/10 border-2 border-cardinal/20 px-3 py-2 rounded-2xl transition-colors">
                                {error}
                            </p>
                        )}

                        <div>
                            <label
                                htmlFor="login-email"
                                className="block text-sm font-bold text-gray-600 dark:text-slate-300 mb-1.5 transition-colors"
                            >
                                Email
                            </label>
                            <input
                                type="email"
                                id="login-email"
                                name="email"
                                autoComplete="email"
                                placeholder="student@university.ru"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full bg-white dark:bg-gray-900/80 border-2 border-gray-200 dark:border-slate-600 focus:border-brand focus:ring-2 focus:ring-brand/20 rounded-2xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="login-password"
                                className="block text-sm font-bold text-gray-600 dark:text-slate-300 mb-1.5 transition-colors"
                            >
                                Пароль
                            </label>
                            <div className="relative">
                                <input
                                    type={showPass ? "text" : "password"}
                                    id="login-password"
                                    name="password"
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full bg-white dark:bg-gray-900/80 border-2 border-gray-200 dark:border-slate-600 focus:border-brand focus:ring-2 focus:ring-brand/20 rounded-2xl px-4 py-3 pr-12 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    style={{padding: 0}}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                                    aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
                                >
                                    {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                                </button>
                            </div>
                        </div>

                        {/* Запомнить / Забыли пароль */}
                        <div className="flex items-center justify-between text-sm">
                            <label
                                className="flex items-center gap-2 text-gray-500 dark:text-slate-400 font-semibold cursor-pointer transition-colors">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded accent-brand"
                                />
                                Запомнить меня
                            </label>
                            <Link
                                to="/forgot-password"
                                className="font-bold text-brand dark:text-brand-light hover:underline transition-colors"
                            >
                                Забыли пароль?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            id="login-submit"
                            disabled={isLoading}
                            className="btn-3d w-full bg-brand hover:bg-brand-dark border-brand-deep text-white text-base py-3 disabled:opacity-60 focus-visible:ring-brand-light"
                        >
                            {isLoading ? "Вход..." : "Войти"}
                        </button>
                    </form>

                    <p className="text-center text-gray-500 dark:text-slate-400 text-sm mt-6 transition-colors">
                        Нет аккаунта?{" "}
                        <Link
                            to="/register"
                            className="font-bold text-brand dark:text-brand-light hover:underline transition-colors"
                        >
                            Зарегистрироваться
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;