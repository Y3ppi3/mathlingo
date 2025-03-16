import { useEffect, useState } from "react";

// Определим тип для данных пользователя
interface UserData {
    id: number;
    username: string;
    email: string;
    // Добавьте другие необходимые поля
}

// Получаем базовый URL API из переменной окружения
const API_URL = import.meta.env.VITE_API_URL;

const Dashboard = () => {
    const [userData, setUserData] = useState<UserData | null>(null);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);

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
                    // Получаем подробности ошибки, если есть
                    const errorData = await response.json().catch(() => ({}));
                    const errorMessage = errorData.detail || "Ошибка авторизации. Войдите заново.";
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                console.log("📩 Ответ от сервера:", data);
                setUserData(data);
            } catch (err: unknown) {
                if (err instanceof Error) {
                    console.error("❌ Ошибка при запросе:", err.message);
                    setError(err.message);
                } else {
                    console.error("❌ Неизвестная ошибка:", err);
                    setError("Неизвестная ошибка");
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserData();
    }, []);

    if (error) {
        return (
            <div className="mt-16 container mx-auto px-4 py-6 text-red-500">
                Ошибка: {error}
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="mt-16 container mx-auto px-4 py-6">
                Загрузка...
            </div>
        );
    }

    return (
        <div className="mt-16 container mx-auto px-4 py-6">
            <h2 className="text-2xl font-bold mb-4">Панель управления</h2>
            <p className="mb-2">ID: {userData?.id}</p>
            <p className="mb-2">Имя: {userData?.username}</p>
            <p className="mb-2">Email: {userData?.email}</p>
        </div>
    );
};

export default Dashboard;