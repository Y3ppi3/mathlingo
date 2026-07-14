import { Link } from "react-router-dom";
import { Sigma, Home as HomeIcon, ArrowLeft } from "lucide-react";

const NotFound = () => {
    return (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center px-4 overflow-hidden transition-colors">
            {/* Декоративные математические символы — тот же приём, что на Login/Register */}
            <div className="absolute inset-0 pointer-events-none select-none">
                <span className="absolute top-24 left-12 text-8xl text-gray-200/80 dark:text-slate-800/60 font-serif">∄</span>
                <span className="absolute bottom-24 right-12 text-9xl text-gray-200/80 dark:text-slate-800/60 font-serif">∅</span>
                <span className="absolute top-1/2 right-1/4 text-7xl text-gray-200/60 dark:text-slate-800/40 font-serif">?</span>
            </div>

            <div className="w-full max-w-md relative z-10 text-center">
                <div className="brand-icon-badge w-16 h-16 mb-6 mx-auto">
                    <Sigma className="w-8 h-8 text-white" />
                </div>

                <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">404</h1>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 transition-colors">
                    Такой страницы не существует
                </h2>
                <p className="text-gray-500 dark:text-slate-400 mb-8 transition-colors">
                    Возможно, ссылка устарела или адрес введён неверно. Ничего страшного — вернёмся на знакомую территорию.
                </p>

                <div className="flex items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        style={{ padding: '0.75rem 1.25rem' }}
                        className="flex items-center gap-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl text-gray-700 dark:text-white text-sm font-medium transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" /> Назад
                    </button>
                    <Link
                        to="/"
                        style={{ padding: '0.75rem 1.25rem' }}
                        className="brand-gradient brand-gradient-hover flex items-center gap-2 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25"
                    >
                        <HomeIcon className="w-4 h-4" /> На главную
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
