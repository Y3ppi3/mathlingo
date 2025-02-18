import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            const response = await fetch("http://127.0.0.1:8000/api/login/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
                credentials: "include", // Важно для работы с куками
            });

            if (!response.ok) {
                throw new Error("Неверный email или пароль");
            }

            const token = Cookies.get("token"); // Получаем токен из куки
            if (!token) {
                throw new Error("Ошибка авторизации. Токен не найден.");
            }

            navigate("/dashboard"); // ✅ Перенаправляем на защищённую страницу
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div>
            <h2>Вход</h2>
            {error && <p style={{ color: "red" }}>{error}</p>}
            <form onSubmit={handleLogin}>
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="submit">Войти</button>
            </form>
        </div>
    );
};

export default Login;
