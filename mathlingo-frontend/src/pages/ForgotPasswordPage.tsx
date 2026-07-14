import { useState } from "react";
import { Link } from "react-router-dom";
import { Sigma, ArrowLeft } from "lucide-react";
import { requestPasswordReset } from "../api/studentApi";

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await requestPasswordReset(email);
        } finally {
            // Один и тот же результат независимо от ошибки/успеха — бэкенд
            // тоже намеренно не различает "email не найден" от "письмо
            // отправлено" (см. app/routes/password_reset.py), чтобы форма
            // не могла использоваться для перебора зарегистрированных адресов.
            setIsLoading(false);
            setSubmitted(true);
        }
    };

    return (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center px-4 overflow-hidden transition-colors">
            <div className="absolute inset-0 pointer-events-none select-none">
                <span className="absolute top-20 left-10 text-8xl text-gray-200/80 dark:text-slate-800/60 font-serif">∫</span>
                <span className="absolute bottom-20 right-10 text-9xl text-gray-200/80 dark:text-slate-800/60 font-serif">∑</span>
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="bg-white dark:bg-slate-800/50 backdrop-blur border border-gray-200 dark:border-slate-700 rounded-2xl p-8 shadow-2xl transition-colors">
                    <div className="text-center mb-8">
                        <div className="brand-icon-badge w-14 h-14 mb-4 mx-auto">
                            <Sigma className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
                            Восстановление пароля
                        </h1>
                        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1 transition-colors">
                            Укажите email — пришлём ссылку для сброса пароля
                        </p>
                    </div>

                    {submitted ? (
                        <p className="text-center text-sm text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-900/50 px-4 py-4 rounded-xl transition-colors">
                            Если такой email зарегистрирован, на него отправлена ссылка для сброса пароля.
                            Ссылка действует 30 минут.
                        </p>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label
                                    htmlFor="forgot-email"
                                    className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1.5 transition-colors"
                                >
                                    Email
                                </label>
                                <input
                                    type="email"
                                    id="forgot-email"
                                    autoComplete="email"
                                    placeholder="student@university.ru"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full bg-white dark:bg-gray-900/80 border border-gray-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                style={{ padding: '0.75rem' }}
                                className={`w-full flex items-center justify-center font-semibold rounded-xl transition-all shadow-lg text-white ${
                                    isLoading
                                        ? "bg-indigo-400 cursor-not-allowed shadow-none"
                                        : "brand-gradient brand-gradient-hover shadow-indigo-500/25"
                                }`}
                            >
                                {isLoading ? "Отправка..." : "Отправить ссылку"}
                            </button>
                        </form>
                    )}

                    <p className="text-center text-gray-500 dark:text-slate-400 text-sm mt-6 transition-colors">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-1.5 text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-medium transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Вернуться ко входу
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
