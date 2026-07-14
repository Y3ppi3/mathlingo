import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sigma, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { confirmPasswordReset } from "../api/studentApi";

const MIN_PASSWORD_LENGTH = 8;

const ResetPasswordPage = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const navigate = useNavigate();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password.length < MIN_PASSWORD_LENGTH) {
            setError(`Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`);
            return;
        }
        if (password !== confirmPassword) {
            setError("Пароли не совпадают");
            return;
        }
        if (!token) {
            setError("Ссылка недействительна — запросите сброс пароля заново");
            return;
        }

        setIsLoading(true);
        try {
            await confirmPasswordReset(token, password);
            setSuccess(true);
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                "Ссылка недействительна или истекла — запросите сброс пароля заново";
            setError(message);
        } finally {
            setIsLoading(false);
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
                            Новый пароль
                        </h1>
                    </div>

                    {success ? (
                        <div className="text-center">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                            <p className="text-sm text-gray-600 dark:text-slate-300 mb-6">
                                Пароль изменён. Теперь можно войти с новым паролем.
                            </p>
                            <button
                                type="button"
                                onClick={() => navigate("/login")}
                                style={{ padding: '0.75rem' }}
                                className="w-full brand-gradient brand-gradient-hover text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25"
                            >
                                Войти
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-xl transition-colors">
                                    {error}
                                </p>
                            )}

                            <div>
                                <label
                                    htmlFor="new-password"
                                    className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1.5 transition-colors"
                                >
                                    Новый пароль
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPass ? "text" : "password"}
                                        id="new-password"
                                        autoComplete="new-password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full bg-white dark:bg-gray-900/80 border border-gray-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 pr-12 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPass(!showPass)}
                                        style={{ padding: 0 }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                                        aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
                                    >
                                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="confirm-password"
                                    className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1.5 transition-colors"
                                >
                                    Повторите пароль
                                </label>
                                <input
                                    type={showPass ? "text" : "password"}
                                    id="confirm-password"
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                                {isLoading ? "Сохранение..." : "Сохранить пароль"}
                            </button>
                        </form>
                    )}

                    {!success && (
                        <p className="text-center text-gray-500 dark:text-slate-400 text-sm mt-6 transition-colors">
                            <Link
                                to="/login"
                                className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-medium transition-colors"
                            >
                                Вернуться ко входу
                            </Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
