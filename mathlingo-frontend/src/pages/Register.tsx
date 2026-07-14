import { useState } from "react";
import { Link } from "react-router-dom";
import { Sigma, GraduationCap, BookOpen, ArrowRight, ArrowLeft } from "lucide-react";
import { registerUser } from "../api/studentApi";

type Role = "student" | "teacher";

interface RegisterForm {
    username: string;
    email: string;
    password: string;
}

function Register() {
    const [step, setStep] = useState<1 | 2>(1);
    const [role, setRole] = useState<Role | null>(null);
    const [form, setForm] = useState<RegisterForm>({ username: "", email: "", password: "" });
    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage("");
        setIsError(false);

        try {
            // TODO: передать role в registerUser после добавления эндпоинта на бэкенде
            const data = await registerUser(form.username, form.email, form.password);
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
            setIsError(true);
        }
    };

    const roles: { id: Role; icon: React.ReactNode; label: string; desc: string }[] = [
        {
            id: "student",
            icon: <GraduationCap className="w-10 h-10" />,
            label: "Студент",
            desc: "Решайте задания и отслеживайте прогресс",
        },
        {
            id: "teacher",
            icon: <BookOpen className="w-10 h-10" />,
            label: "Преподаватель",
            desc: "Управляйте заданиями и студентами",
        },
    ];

    return (
        <div
            className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center px-4 overflow-hidden transition-colors">
            {/* Декоративные математические символы */}
            <div className="absolute inset-0 pointer-events-none select-none">
                <span
                    className="absolute top-20 right-10 text-8xl text-gray-200/80 dark:text-slate-800/60 font-serif">∂</span>
                <span
                    className="absolute bottom-20 left-10 text-9xl text-gray-200/80 dark:text-slate-800/60 font-serif">∇</span>
                <span
                    className="absolute top-1/2 left-1/4 text-7xl text-gray-200/60 dark:text-slate-800/40 font-serif">∞</span>
            </div>

            <div className="w-full max-w-lg relative z-10">
                <div
                    className="bg-white dark:bg-slate-800/50 backdrop-blur border border-gray-200 dark:border-slate-700 rounded-2xl p-8 shadow-2xl transition-colors">

                    {/* Заголовок */}
                    <div className="text-center mb-8">
                        <div
                            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 mb-4">
                            <Sigma className="w-7 h-7 text-white"/>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
                            Регистрация
                        </h1>
                        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1 transition-colors">
                            Шаг {step} из 2
                        </p>
                    </div>

                    {/* Прогресс-бар */}
                    <div className="flex gap-2 mb-8">
                        {([1, 2] as const).map((s) => (
                            <div
                                key={s}
                                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                    s <= step
                                        ? "bg-gradient-to-r from-indigo-500 to-violet-500"
                                        : "bg-gray-200 dark:bg-slate-700"
                                }`}
                            />
                        ))}
                    </div>

                    {/* Шаг 1 — Выбор роли */}
                    {step === 1 && (
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center transition-colors">
                                Выберите вашу роль
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                {roles.map((r) => (
                                    <button
                                        key={r.id}
                                        onClick={() => setRole(r.id)}
                                        className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${
                                            role === r.id
                                                ? "border-indigo-500 bg-indigo-500/10 text-gray-900 dark:text-white"
                                                : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 text-gray-500 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white"
                                        }`}
                                    >
                                        <div className={`transition-colors ${
                                            role === r.id
                                                ? "text-indigo-500 dark:text-indigo-400"
                                                : "text-gray-400 dark:text-slate-400"
                                        }`}>
                                            {r.icon}
                                        </div>
                                        <span className="font-semibold">{r.label}</span>
                                        <span
                                            className="text-xs text-gray-400 dark:text-slate-400 text-center leading-relaxed">
                                            {r.desc}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => role && setStep(2)}
                                disabled={!role}
                                style={{padding: '0.75rem'}}
                                className="w-full mt-6 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25"
                            >
                                Далее <ArrowRight className="w-4 h-4"/>
                            </button>
                        </div>
                    )}

                    {/* Шаг 2 — Заполнение формы */}
                    {step === 2 && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {message && (
                                <p className={`text-center text-sm px-3 py-2 rounded-xl transition-colors ${
                                    isError
                                        ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10"
                                        : "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                                }`}>
                                    {message}
                                </p>
                            )}

                            <div>
                                <label
                                    htmlFor="username"
                                    className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1.5 transition-colors"
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
                                    className="w-full bg-white dark:bg-gray-900/80 border border-gray-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1.5 transition-colors"
                                >
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    placeholder="student@university.ru"
                                    value={form.email}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-white dark:bg-gray-900/80 border border-gray-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1.5 transition-colors"
                                >
                                    Пароль
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    name="password"
                                    placeholder="Минимум 8 символов"
                                    value={form.password}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-gray-50 dark:bg-slate-900/80 border border-gray-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    style={{padding: '0.75rem 1rem'}}
                                    className="flex items-center gap-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl text-gray-700 dark:text-white text-sm font-medium transition-all"
                                >
                                    <ArrowLeft className="w-4 h-4"/> Назад
                                </button>
                                <button
                                    type="submit"
                                    style={{padding: '0.75rem'}}
                                    className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25"
                                >
                                    Зарегистрироваться
                                </button>
                            </div>
                        </form>
                    )}

                    <p className="text-center text-gray-500 dark:text-slate-400 text-sm mt-6 transition-colors">
                        Уже есть аккаунт?{" "}
                        <Link
                            to="/login"
                            className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-medium transition-colors"
                        >
                            Войти
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Register;