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
        setMessage("");

        try {
            const data: any = await registerUser(form.username, form.email, form.password);
            console.log("Ответ от API:", data);
            setMessage("Успешно зарегистрирован!");
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
        <div className="pt-16 min-h-screen flex items-center justify-center transition-colors">
            <div className="bg-gray-800 dark:bg-gray-100 p-8 rounded-md w-full max-w-md shadow-md transition-colors">
                <h2 className="text-2xl font-bold mb-6 text-center text-white dark:text-gray-900 transition-colors">
                    Регистрация
                </h2>
                {message && (
                    <p className="text-center text-white dark:text-gray-900 mb-4 transition-colors">
                        {message}
                    </p>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label
                            htmlFor="username"
                            className="block mb-1 text-gray-400 dark:text-gray-700 transition-colors"
                        >
                            Имя пользователя
                        </label>
                        <input
                            id="username"
                            type="text"
                            name="username"
                            placeholder="Имя пользователя"
                            value={form.username}
                            onChange={handleChange}
                            required
                            className="w-full p-2 rounded-md bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-900
                         focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="email"
                            className="block mb-1 text-gray-400 dark:text-gray-700 transition-colors"
                        >
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            name="email"
                            placeholder="Email"
                            value={form.email}
                            onChange={handleChange}
                            required
                            className="w-full p-2 rounded-md bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-900
                         focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="password"
                            className="block mb-1 text-gray-400 dark:text-gray-700 transition-colors"
                        >
                            Пароль
                        </label>
                        <input
                            id="password"
                            type="password"
                            name="password"
                            placeholder="Пароль"
                            value={form.password}
                            onChange={handleChange}
                            required
                            className="w-full p-2 rounded-md bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-900
                         focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                        />
                    </div>
                    <button
                        type="submit"
                        className="block w-full py-2 px-4 text-center rounded-md bg-indigo-600
                       hover:bg-indigo-500 text-white transition-colors hover:animate-button-pulse"
                    >
                        Зарегистрироваться
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Register;
