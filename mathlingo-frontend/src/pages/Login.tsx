import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sigma, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL;

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
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
                body: JSON.stringify({ email, password }),
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
                    className="bg-white dark:bg-slate-800/50 backdrop-blur border border-gray-200 dark:border-slate-700 rounded-2xl p-8 shadow-2xl transition-colors">

                    {/* Заголовок */}
                    <div className="text-center mb-8">
                        <div
                            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 mb-4">
                            <Sigma className="w-7 h-7 text-white"/>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
                            Добро пожаловать
                        </h1>
                        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1 transition-colors">
                            Войдите в MathLingo
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-xl transition-colors">
                                {error}
                            </p>
                        )}

                        <div>
                            <label
                                htmlFor="login-email"
                                className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1.5 transition-colors"
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
                                className="w-full bg-white dark:bg-gray-900/80 border border-gray-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="login-password"
                                className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1.5 transition-colors"
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
                                    className="w-full bg-white dark:bg-gray-900/80 border border-gray-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 pr-12 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors"
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
                                className="flex items-center gap-2 text-gray-500 dark:text-slate-400 cursor-pointer transition-colors">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                                />
                                Запомнить меня
                            </label>
                            <Link
                                to="/forgot-password"
                                className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                            >
                                Забыли пароль?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            id="login-submit"
                            disabled={isLoading}
                            style={{padding: '0.75rem'}}
                            className={`w-full flex items-center justify-center font-semibold rounded-xl transition-all shadow-lg ${
                                isLoading
                                    ? "bg-indigo-400 cursor-not-allowed shadow-none"
                                    : "bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 shadow-indigo-500/25"
                            } text-white`}
                        >
                            {isLoading ? "Вход..." : "Войти"}
                        </button>
                    </form>

                    <p className="text-center text-gray-500 dark:text-slate-400 text-sm mt-6 transition-colors">
                        Нет аккаунта?{" "}
                        <Link
                            to="/register"
                            className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-medium transition-colors"
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