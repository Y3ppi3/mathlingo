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
                const response = await fetch("http://127.0.0.1:8000/api/me", {
                    method: "GET",
                    credentials: "include", // Важно для работы с куками
                });

                if (!response.ok) {
                    throw new Error("Ошибка авторизации. Войдите заново.");
                }

                const data = await response.json();
                setUser(data);
            } catch (err: any) {
                setError(err.message);
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

            Cookies.remove("token");
            navigate("/login");
        } catch (err: any) {
            console.error("Ошибка при выходе:", err.message);
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
