import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Получаем базовый URL API из переменной окружения
const API_URL = import.meta.env.VITE_API_URL;

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            // Отправляем логин-запрос на API_URL
            const response = await fetch(`${API_URL}/api/login/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error("Неверный email или пароль");
            }

            console.log("✅ Успешный вход. Перенаправляем пользователя...");
            // Обновляем состояние авторизации через контекст
            login();
        } catch (err: unknown) {
            if (err instanceof Error) {
                console.error("❌ Ошибка:", err.message);
                setError(err.message);
            } else {
                setError("Неизвестная ошибка");
            }
        }
    };

    return (
        <div>
            <h2>Вход</h2>
            {error && <p style={{ color: "red" }}>{error}</p>}
            <form onSubmit={handleLogin}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit">Войти</button>
            </form>
        </div>
    );
};

export default Login;
