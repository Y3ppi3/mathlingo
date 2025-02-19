import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const { login } = useAuth(); // Используем контекст авторизации
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            // 🔄 Отправляем логин-запрос
            const response = await fetch("http://127.0.0.1:8000/api/login/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
                credentials: "include",  // 📌 Разрешаем передавать куки
            });

            if (!response.ok) {
                throw new Error("Неверный email или пароль");
            }

            console.log("✅ Успешный вход. Запрашиваем пользователя...");

            // 🔄 Запрашиваем данные пользователя
            const userResponse = await fetch("http://127.0.0.1:8000/api/me", {
                method: "GET",
                credentials: "include",  // 📌 Куки будут переданы автоматически
                headers: { "Content-Type": "application/json" },
            });

            if (!userResponse.ok) {
                throw new Error("Ошибка авторизации. Не удалось получить данные пользователя.");
            }

            const userData = await userResponse.json();
            console.log("👤 Данные пользователя:", userData);

            // Передаем токен, если он был получен
            const token = response.headers.get("token");
            if (token) {
                login(token); // Обновляем контекст авторизации, передаем токен
                navigate("/dashboard"); // ✅ Перенаправляем на защищённую страницу
            } else {
                throw new Error("Токен не получен.");
            }
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
