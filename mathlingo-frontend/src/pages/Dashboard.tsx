import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    BookOpen, Map, Sparkles, CheckCircle, Percent,
    Flame, Clock, Sigma, TrendingUp, Star
} from "lucide-react";
import { fetchStudentDashboard, getCurrentUser, StudentDashboard } from "../api/studentApi";
import { API_BASE } from "../config/apiBase";
import ProgressBar from "../components/ui/ProgressBar";
import MyAssignments from "../components/tutor/MyAssignments";
import MySessions from "../components/tutor/MySessions";
import mascot from "../assets/logo.png";

interface UserData {
    id: number;
    username: string;
    email: string;
}

interface Subject {
    id: number;
    name: string;
    code: string;
    description: string;
    icon: string;
    is_active: boolean;
}

const LEVEL_LABEL: Record<string, string> = {
    basic: "Базовый", standard: "Стандартный", advanced: "Продвинутый",
};

const formatRelativeTime = (ms: number | null): string => {
    if (ms == null) return "—";
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds} сек`;
    return `${Math.round(seconds / 60)} мин`;
};

const formatDate = (isoDate: string): string =>
    new Date(isoDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

const API_URL = API_BASE;

const Dashboard = () => {
    const [userData, setUserData]   = useState<UserData | null>(null);
    const [subjects, setSubjects]   = useState<Subject[]>([]);
    const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
    const [error, setError]         = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            // Через общий axios-инстанс (не raw fetch) — его перехватчик в
            // api/studentApi.ts читает X-CSRF-Token из ответа GET /api/me.
            // Backend перевыпускает этот токен на КАЖДЫЙ такой запрос —
            // raw fetch отсюда молча "протухал" токен, уже закешированный
            // где-то ещё в приложении (например, перед отправкой результата
            // игры).
            try {
                setUserData(await getCurrentUser());
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Ошибка авторизации. Войдите заново.");
            } finally {
                setIsLoading(false);
            }
        };

        const fetchSubjects = async () => {
            try {
                const response = await fetch(`${API_URL}/api/subjects/`, {
                    method: "GET",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                });
                if (!response.ok) throw new Error("Не удалось загрузить предметы");
                setSubjects(await response.json());
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Неизвестная ошибка");
            }
        };

        const loadDashboard = async () => {
            try {
                setDashboard(await fetchStudentDashboard());
            } catch (err) {
                console.error("Не удалось загрузить сводку активности:", err);
            }
        };

        Promise.all([fetchUserData(), fetchSubjects(), loadDashboard()]);
    }, []);

    const stats = dashboard?.activity;
    const STATS = [
        { label: "Решено заданий", value: String(stats?.total_attempts ?? 0), icon: <CheckCircle className="w-5 h-5" />, color: "from-indigo-500 to-blue-500" },
        { label: "Правильных ответов", value: `${stats?.accuracy_pct ?? 0}%`, icon: <Percent className="w-5 h-5" />, color: "from-violet-500 to-purple-500" },
        { label: "Серия дней", value: `${stats?.streak_days ?? 0} дн.`, icon: <Flame className="w-5 h-5" />, color: "from-orange-500 to-red-500" },
        { label: "Время обучения", value: `${stats?.total_time_hours ?? 0} ч`, icon: <Clock className="w-5 h-5" />, color: "from-emerald-500 to-teal-500" },
        { label: "Очки", value: String(stats?.total_points ?? 0), icon: <Star className="w-5 h-5" />, color: "from-amber-500 to-orange-500" },
    ];

    if (error) {
        return (
            <div className="mt-16 container mx-auto px-4 py-6">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
                    Ошибка: {error}
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="mt-16 container mx-auto px-4 py-6">
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    Загрузка...
                </div>
            </div>
        );
    }

    return (
        <div className="mt-16 min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <div className="max-w-7xl mx-auto px-4 py-8">

                {/* Заголовок */}
                <div className="flex items-center gap-4 mb-8">
                    <img src={mascot} alt="" className="w-14 h-14 object-contain hidden sm:block" />
                    <div>
                        <p className="text-gray-400 dark:text-slate-400 text-sm mb-0.5">
                            С возвращением 👋
                        </p>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
                            {userData?.username}
                        </h1>
                    </div>
                </div>

                {/* Хук вовлечения: занятия и задания от репетитора наверху.
                    Обе секции сами прячутся, если репетитора/активности нет —
                    никакого давления на тех, кто занимается сам. */}
                <MySessions />
                <MyAssignments />

                {/* Статистика */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
                    {STATS.map((s) => (
                        <div key={s.label} className="card-soft p-4 sm:p-5 animate-pop-in">
                            <div className={`inline-flex p-2.5 rounded-2xl bg-gradient-to-br ${s.color} mb-3 text-white`}>
                                {s.icon}
                            </div>
                            <div className="text-2xl font-extrabold text-gray-900 dark:text-white mb-0.5">
                                {s.value}
                            </div>
                            <div className="text-sm text-gray-400 dark:text-slate-400">
                                {s.label}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Активность + Прогресс */}
                <div className="grid lg:grid-cols-3 gap-6 mb-6">

                    {/* Последняя активность */}
                    <div className="lg:col-span-2 card-soft p-6">
                        <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                            Последняя активность
                        </h2>
                        {dashboard && dashboard.recent_activity.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-slate-500 py-6 text-center transition-colors">
                                Пока нет решённых заданий — начните с любого предмета ниже.
                            </p>
                        ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                <tr className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider border-b border-gray-100 dark:border-slate-700 transition-colors">
                                    <th className="text-left pb-3 font-medium">Задание</th>
                                    <th className="text-left pb-3 font-medium">Тема</th>
                                    <th className="text-left pb-3 font-medium">Результат</th>
                                    <th className="text-left pb-3 font-medium">Время</th>
                                    <th className="text-left pb-3 font-medium">Дата</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-slate-800 transition-colors">
                                {dashboard?.recent_activity.map((r) => (
                                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="py-3 text-sm text-indigo-600 dark:text-indigo-300 transition-colors">
                                            {r.title}
                                        </td>
                                        <td className="py-3">
                                                <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-full px-2.5 py-1 transition-colors">
                                                    {r.topic}
                                                </span>
                                        </td>
                                        <td className="py-3">
                                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                                    r.is_correct
                                                        ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                                                        : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                                                } transition-colors`}>
                                                    {r.is_correct ? "Верно" : "Неверно"}
                                                </span>
                                        </td>
                                        <td className="py-3 text-sm text-gray-400 dark:text-slate-400 transition-colors">
                                            {formatRelativeTime(r.time_spent_ms)}
                                        </td>
                                        <td className="py-3 text-sm text-gray-300 dark:text-slate-500 transition-colors">
                                            {formatDate(r.created_at)}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                        )}
                    </div>

                    {/* Прогресс по разделам */}
                    <div className="card-soft p-6">
                        <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-5">
                            Прогресс по разделам
                        </h2>
                        {dashboard && dashboard.topics_progress.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-slate-500 transition-colors">
                                Пока нет данных — пройдите диагностику или пару заданий по теме.
                            </p>
                        ) : (
                        <div className="space-y-4">
                            {dashboard?.topics_progress.map((t) => (
                                <div key={t.skill_id}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-sm font-bold text-gray-700 dark:text-slate-200">
                                            {t.skill_name}
                                        </span>
                                        <span className="text-sm text-indigo-600 dark:text-indigo-400 font-bold">
                                            {LEVEL_LABEL[t.level] ?? t.level}
                                        </span>
                                    </div>
                                    <ProgressBar progress={t.progress_pct} tone="brand" />
                                    <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                                        {t.done} {t.done === 1 ? "задание выполнено" : "заданий выполнено"}
                                    </div>
                                </div>
                            ))}
                        </div>
                        )}
                    </div>
                </div>

                {/* Доступные предметы */}
                <div className="mb-6">
                    <h3 className="text-lg font-extrabold mb-4 text-gray-900 dark:text-white">
                        Доступные предметы
                    </h3>
                    {subjects.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {subjects.map((subject) => (
                                <div key={subject.id} className="card-interactive p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        {subject.icon && (
                                            <img
                                                src={subject.icon}
                                                alt={subject.name}
                                                className="w-11 h-11 rounded-2xl object-cover"
                                            />
                                        )}
                                        <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                                            {subject.name}
                                        </h3>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-2 mb-4">
                                        {subject.description}
                                    </p>
                                    <div className="flex gap-2">
                                        <Link
                                            to={`/subject/${subject.id}/tasks`}
                                            className="btn-3d flex-1 bg-macaw hover:brightness-105 border-macaw-shade text-white text-sm px-3 py-2 focus-visible:ring-macaw-light"
                                        >
                                            <BookOpen className="w-4 h-4" />
                                            Обычный
                                        </Link>
                                        <Link
                                            to={`/subject/${subject.id}/map`}
                                            className="btn-3d flex-1 bg-brand-accent hover:brightness-105 border-brand-deep text-white text-sm px-3 py-2 focus-visible:ring-brand-light"
                                        >
                                            <Map className="w-4 h-4" />
                                            Приключение
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="card-soft p-10 text-center">
                            <p className="text-gray-400 dark:text-slate-500">
                                Предметы не найдены
                            </p>
                        </div>
                    )}
                </div>

                {/* Быстрые ссылки + баннер */}
                <div className="grid sm:grid-cols-2 gap-4">
                    <Link
                        to={subjects.length > 0 ? `/subject/${subjects[0].id}/tasks` : "#"}
                        className="flex items-center gap-4 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-500/10 dark:to-blue-500/10 border border-indigo-200 dark:border-indigo-500/30 hover:border-indigo-300 dark:hover:border-indigo-500/50 rounded-2xl p-5 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                            <Sigma className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                                Перейти к заданиям
                            </div>
                            <div className="text-sm text-gray-400 dark:text-slate-400 transition-colors">
                                Продолжить обучение с того места
                            </div>
                        </div>
                    </Link>

                    <Link
                        to={subjects.length > 0 ? `/subject/${subjects[0].id}/map` : "#"}
                        className={`flex items-center gap-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 border border-purple-200 dark:border-purple-500/30 hover:border-purple-300 dark:hover:border-purple-500/50 rounded-2xl p-5 transition-all group ${
                            subjects.length === 0 ? "opacity-50 pointer-events-none" : ""
                        }`}
                    >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
                                Начать приключение
                            </div>
                            <div className="text-sm text-gray-400 dark:text-slate-400 transition-colors">
                                Изучайте математику в игровой форме
                            </div>
                        </div>
                    </Link>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;