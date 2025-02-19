import { useEffect, useState } from "react";

// Получаем базовый URL API из переменной окружения
const API_URL = import.meta.env.VITE_API_URL;

const Dashboard = () => {
    const [userData, setUserData] = useState<any>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                console.log("📡 Отправляем запрос на /api/me...");
                const response = await fetch(`${API_URL}/api/me`, {
                    method: "GET",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                });

                if (!response.ok) {
                    throw new Error("Ошибка авторизации. Войдите заново.");
                }

                const data = await response.json();
                console.log("📩 Ответ от сервера:", data);
                setUserData(data);
            } catch (err: unknown) {
                if (err instanceof Error) {
                    console.error("❌ Ошибка при запросе:", err.message);
                    setError(err.message);
                } else {
                    setError("Неизвестная ошибка");
                }
            }
        };

        fetchUserData();
    }, []);

    if (error) {
        return <div>Ошибка: {error}</div>;
    }

    if (!userData) {
        return <div>Загрузка...</div>;
    }

    return (
        <div>
            <h2>Панель управления</h2>
            <p>ID: {userData.id}</p>
            <p>Имя: {userData.username}</p>
            <p>Email: {userData.email}</p>
        </div>
    );
};

export default Dashboard;
