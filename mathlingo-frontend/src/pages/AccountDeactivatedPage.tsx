import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

const AccountDeactivatedPage = () => {
    return (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center px-4 transition-colors">
            <div className="w-full max-w-md text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-500/10 mb-6">
                    <ShieldAlert className="w-8 h-8 text-amber-500 dark:text-amber-400" />
                </div>

                <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 transition-colors">
                    Аккаунт деактивирован
                </h1>
                <p className="text-gray-500 dark:text-slate-400 mb-8 transition-colors">
                    Доступ к этому аккаунту временно ограничен администратором.
                    Если вы считаете, что это ошибка — свяжитесь с поддержкой.
                </p>

                <Link
                    to="/login"
                    style={{ padding: '0.75rem 1.5rem' }}
                    className="inline-flex items-center justify-center brand-gradient brand-gradient-hover text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/25"
                >
                    Вернуться ко входу
                </Link>
            </div>
        </div>
    );
};

export default AccountDeactivatedPage;
