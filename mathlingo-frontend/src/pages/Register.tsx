import { useState } from "react";

function Register() {
    const [form, setForm] = useState({ username: "", email: "", password: "" });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Отправка данных:", form);
        // Тут будет отправка данных на сервер
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
        </div>
    );
}

export default Register;
