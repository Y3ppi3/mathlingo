import { useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, BookOpen, ArrowRight, ArrowLeft } from "lucide-react";
import { registerUser } from "../api/studentApi";
import mascot from "../assets/logo.png";

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
                    className="bg-white dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 rounded-3xl p-8 shadow-card-hover transition-colors">

                    {/* Заголовок */}
                    <div className="text-center mb-8">
                        <img src={mascot} alt="Маскот MathLingo" className="w-20 h-20 mx-auto object-contain animate-bob mb-3" />
                        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white transition-colors">
                            Присоединяйся!
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
                                className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                                    s <= step
                                        ? "brand-gradient"
                                        : "bg-gray-200 dark:bg-slate-700"
                                }`}
                            />
                        ))}
                    </div>

                    {/* Шаг 1 — Выбор роли */}
                    {step === 1 && (
                        <div>
                            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-4 text-center transition-colors">
                                Выберите вашу роль
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                {roles.map((r) => (
                                    <button
                                        key={r.id}
                                        onClick={() => setRole(r.id)}
                                        className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all hover:-translate-y-0.5 ${
                                            role === r.id
                                                ? "border-brand bg-brand/10 text-gray-900 dark:text-white shadow-card-hover"
                                                : "border-gray-200 dark:border-slate-700 hover:border-brand/40 dark:hover:border-brand/40 text-gray-500 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white"
                                        }`}
                                    >
                                        <div className={`transition-colors ${
                                            role === r.id
                                                ? "text-brand dark:text-brand-light"
                                                : "text-gray-400 dark:text-slate-400"
                                        }`}>
                                            {r.icon}
                                        </div>
                                        <span className="font-extrabold">{r.label}</span>
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
                                className="btn-3d w-full mt-6 bg-brand hover:bg-brand-dark border-brand-deep text-white text-base py-3 disabled:opacity-50 focus-visible:ring-brand-light"
                            >
                                Далее <ArrowRight className="w-4 h-4"/>
                            </button>
                        </div>
                    )}

                    {/* Шаг 2 — Заполнение формы */}
                    {step === 2 && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {message && (
                                <p className={`text-center text-sm font-semibold px-3 py-2 rounded-2xl border-2 transition-colors ${
                                    isError
                                        ? "text-cardinal dark:text-red-400 bg-cardinal/10 border-cardinal/20"
                                        : "text-feather-shade dark:text-feather bg-feather/10 border-feather/20"
                                }`}>
                                    {message}
                                </p>
                            )}

                            <div>
                                <label
                                    htmlFor="username"
                                    className="block text-sm font-bold text-gray-600 dark:text-slate-300 mb-1.5 transition-colors"
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
                                    className="w-full bg-white dark:bg-gray-900/80 border-2 border-gray-200 dark:border-slate-600 focus:border-brand focus:ring-2 focus:ring-brand/20 rounded-2xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm font-bold text-gray-600 dark:text-slate-300 mb-1.5 transition-colors"
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
                                    className="w-full bg-white dark:bg-gray-900/80 border-2 border-gray-200 dark:border-slate-600 focus:border-brand focus:ring-2 focus:ring-brand/20 rounded-2xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-bold text-gray-600 dark:text-slate-300 mb-1.5 transition-colors"
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
                                    className="w-full bg-gray-50 dark:bg-slate-900/80 border-2 border-gray-200 dark:border-slate-600 focus:border-brand focus:ring-2 focus:ring-brand/20 rounded-2xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="btn-3d bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-white text-sm px-4 py-3 focus-visible:ring-gray-300"
                                >
                                    <ArrowLeft className="w-4 h-4"/> Назад
                                </button>
                                <button
                                    type="submit"
                                    className="btn-3d flex-1 bg-brand hover:bg-brand-dark border-brand-deep text-white text-base py-3 focus-visible:ring-brand-light"
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
                            className="font-bold text-brand dark:text-brand-light hover:underline transition-colors"
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