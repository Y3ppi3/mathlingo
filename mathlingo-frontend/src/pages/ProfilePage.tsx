import { Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import UserAvatar from '../components/ui/UserAvatar';
import { useUser } from '../hooks/useUser';
import { Settings, CheckCircle, Percent, Flame, Clock } from 'lucide-react';

const ProfilePage = () => {
    const { user, loading, error } = useUser();

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
                <Navbar />
                <div className="container mx-auto px-4 mt-16 flex justify-center items-center h-96">
                    <div className="flex items-center gap-3 text-gray-400 dark:text-slate-400">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        Загрузка профиля...
                    </div>
                </div>
            </div>
        );
    }

    if (error || !user) {
        return (
            <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
                <Navbar />
                <div className="container mx-auto px-4 mt-16 py-8">
                    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 text-center transition-colors">
                        <p className="text-red-500 dark:text-red-400 text-lg mb-4">
                            {error || 'Не удалось загрузить профиль'}
                        </p>
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white text-sm font-medium rounded-xl transition-all"
                        >
                            Вернуться на главную
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const stats = [
        { label: 'Уровень',    value: '1',   icon: <Flame       className="w-4 h-4" />, color: 'from-orange-500 to-red-500'    },
        { label: 'Очки',       value: '0',   icon: <Clock       className="w-4 h-4" />, color: 'from-emerald-500 to-teal-500'  },
        { label: 'Завершено',  value: '0',   icon: <CheckCircle className="w-4 h-4" />, color: 'from-indigo-500 to-blue-500'   },
        { label: 'Точность',   value: '0%',  icon: <Percent     className="w-4 h-4" />, color: 'from-violet-500 to-purple-500' },
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <Navbar />
            <div className="max-w-3xl mx-auto px-4 py-8 mt-16">

                {/* Заголовок */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white transition-colors">
                            Профиль
                        </h1>
                        <p className="text-gray-400 dark:text-slate-400 mt-1 text-sm transition-colors">
                            Ваша личная страница
                        </p>
                    </div>
                    <Link
                        to="/profile/settings"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 text-gray-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-sm font-medium transition-all"
                    >
                        <Settings className="w-4 h-4" />
                        Настройки
                    </Link>
                </div>

                <div className="space-y-6">

                    {/* — Карточка пользователя — */}
                    <div className="bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 backdrop-blur transition-colors">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                            <UserAvatar
                                username={user.username}
                                avatarId={user.avatarId}
                                size="lg"
                            />
                            <div className="text-center sm:text-left">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
                                    {user.username}
                                </h2>
                                <p className="text-gray-400 dark:text-slate-400 mt-1 transition-colors">
                                    {user.email}
                                </p>
                                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-full transition-colors">
                                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                        Уровень 1
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* — Статистика — */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {stats.map((s) => (
                            <div
                                key={s.label}
                                className="bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 backdrop-blur transition-colors"
                            >
                                <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${s.color} text-white mb-3`}>
                                    {s.icon}
                                </div>
                                <div className="text-xl font-bold text-gray-900 dark:text-white transition-colors">
                                    {s.value}
                                </div>
                                <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 transition-colors">
                                    {s.label}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* — Достижения — */}
                    <div className="bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 backdrop-blur transition-colors">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 transition-colors">
                            Достижения
                        </h3>
                        <div className="py-6 text-center">
                            <p className="text-sm text-gray-400 dark:text-slate-500 transition-colors">
                                У вас пока нет достижений.{' '}
                                <Link
                                    to="/dashboard"
                                    className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                                >
                                    Продолжите обучение
                                </Link>
                                , чтобы получить их!
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ProfilePage;