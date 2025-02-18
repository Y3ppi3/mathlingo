import { useState } from "react";
import { registerUser } from "../api/api";

function Register() {
    const [form, setForm] = useState({ username: "", email: "", password: "" });
    const [message, setMessage] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data: any = await registerUser(form.username, form.email, form.password);

            console.log("Ответ от API:", data); // ✅ Логируем полный ответ от сервера

            if (data?.token) {
                setMessage(`Успешно зарегистрирован! Ваш токен: ${data.token}`);
            } else {
                console.error("Ошибка: сервер не вернул токен");
                setMessage("Ошибка: сервер не вернул токен");
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error("Ошибка регистрации:", error.message);
                setMessage(error.message);
            } else {
                console.error("Неизвестная ошибка");
                setMessage("Неизвестная ошибка");
            }
        }
    };


    return (
        <div className="flex flex-col items-center mt-10">
            <h1 className="text-3xl font-bold">Регистрация</h1>
            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
                <input
                    type="text"
                    name="username"
                    placeholder="Имя пользователя"
                    className="border p-2 rounded"
                    value={form.username}
                    onChange={handleChange}
                    required
                />
                <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    className="border p-2 rounded"
                    value={form.email}
                    onChange={handleChange}
                    required
                />
                <input
                    type="password"
                    name="password"
                    placeholder="Пароль"
                    className="border p-2 rounded"
                    value={form.password}
                    onChange={handleChange}
                    required
                />
                <button type="submit" className="bg-blue-500 text-white p-2 rounded">
                    Зарегистрироваться
                </button>
            </form>
            {message && <p className="mt-4">{message}</p>}
        </div>
    );
}

export default Register;