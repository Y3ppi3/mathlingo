import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";

const Dashboard = () => {
    const [user, setUser] = useState<{ id: number; username: string; email: string } | null>(null);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                console.log("📡 Отправляем запрос на /api/me...");

                const response = await fetch("http://127.0.0.1:8000/api/me", {
                    method: "GET",
                    credentials: "include", // Важно для передачи кук
                });

                console.log("📩 Ответ от сервера:", response);

                if (!response.ok) {
                    throw new Error("Ошибка авторизации. Войдите заново.");
                }

                const data = await response.json();
                console.log("✅ Данные пользователя:", data);
                setUser(data);
            } catch (err: any) {
                setError(err.message);
                console.error("❌ Ошибка при запросе:", err.message);
                navigate("/login");
            }
        };

        fetchUser();
    }, [navigate]);


    const handleLogout = async () => {
        try {
            await fetch("http://127.0.0.1:8000/api/logout/", {
                method: "POST",
                credentials: "include",
            });

            document.cookie = "token=; Max-Age=0"; // Удаляем куки вручную
            Cookies.remove("token");
            console.log("✅ Вышли из системы");
            navigate("/login");
        } catch (err: any) {
            console.error("❌ Ошибка при выходе:", err.message);
        }
    };


    if (error) return <p style={{ color: "red" }}>{error}</p>;
    if (!user) return <p>Загрузка...</p>;

    return (
        <div>
            <h2>Привет, {user.username}!</h2>
            <p>Email: {user.email}</p>
            <button onClick={handleLogout}>Выйти</button>
        </div>
    );
};

export default Dashboard;
