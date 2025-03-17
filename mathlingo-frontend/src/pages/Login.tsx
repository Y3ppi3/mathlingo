// Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL;

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            console.log("Отправка запроса на API:", `${API_URL}/api/login/`);
            const response = await fetch(`${API_URL}/api/login/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
                credentials: "include",
            });

            console.log("Ответ от API, статус:", response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || "Неверный email или пароль");
            }

            await login(); // Убедимся, что login полностью выполнится перед навигацией
            navigate("/dashboard");
        } catch (err: unknown) {
            console.error("❌ Ошибка при входе:", err);
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Неизвестная ошибка");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        // Вместо bg-gray-900 делаем общий контейнер:
        <div className="pt-16 min-h-screen flex items-center justify-center transition-colors ">
            {/* Форма: тёмный фон по умолчанию, светлый при отключении .dark */}
            <div className="bg-gray-800 dark:bg-gray-100 p-8 rounded-md w-full max-w-md shadow-md transition-colors">
                <h2 className="text-2xl font-bold mb-6 text-center text-white dark:text-gray-900 transition-colors">
                    Вход
                </h2>
                {error && (
                    <p className="text-red-500 mb-4 dark:text-red-600 transition-colors">
                        {error}
                    </p>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label
                            htmlFor="login-email"
                            className="block mb-1 text-gray-400 dark:text-gray-700 transition-colors"
                        >
                            Email
                        </label>
                        <input
                            type="email"
                            id="login-email"
                            name="email"
                            autoComplete="email"
                            placeholder="Введите email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full p-2 rounded-md bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-900
                         focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="login-password"
                            className="block mb-1 text-gray-400 dark:text-gray-700 transition-colors"
                        >
                            Пароль
                        </label>
                        <input
                            type="password"
                            id="login-password"
                            name="password"
                            autoComplete="current-password"
                            placeholder="Введите пароль"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full p-2 rounded-md bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-900
                         focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                        />
                    </div>
                    <button
                        type="submit"
                        id="login-submit"
                        name="login-submit"
                        disabled={isLoading}
                        className={`block w-full py-2 px-4 text-center rounded-md
                       ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'} 
                       text-white transition-colors hover:animate-button-pulse`}
                    >
                        {isLoading ? "Вход..." : "Войти"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;