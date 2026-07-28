// src/pages/TutorStudentProgressPage.tsx
// Платформа репетиторов, Фаза 2 — прогресс ученика глазами репетитора.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Percent, Flame, Star, Clock, Check, X } from 'lucide-react';
import UserAvatar from '../components/ui/UserAvatar';
import StudentAssignments from '../components/tutor/StudentAssignments';
import StudentSessions from '../components/tutor/StudentSessions';
import { getStudentDashboard, TutorStudentDashboard } from '../api/tutorsApi';

const LEVEL_LABEL: Record<string, string> = { basic: 'База', standard: 'Стандарт', advanced: 'Продвинутый' };

// Русское склонение: 1 попытка / 2 попытки / 5 попыток.
const plural = (n: number, one: string, few: string, many: string) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
};

const fmtTime = (ms: number | null) => {
    if (!ms) return '';
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s} с` : `${Math.round(s / 60)} мин`;
};

const TutorStudentProgressPage = () => {
    const { studentId } = useParams<{ studentId: string }>();
    const [data, setData] = useState<TutorStudentDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!studentId) return;
        getStudentDashboard(Number(studentId))
            .then(setData)
            .catch(() => setError('Не удалось загрузить прогресс. Возможно, ученик ещё не в активных занятиях.'))
            .finally(() => setLoading(false));
    }, [studentId]);

    if (loading) return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <div className="max-w-3xl mx-auto px-4 py-10 mt-16 flex justify-center">
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
        </div>
    );

    if (error || !data) return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <div className="max-w-3xl mx-auto px-4 py-10 mt-16">
                <Link to="/tutors/me" className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-brand dark:hover:text-brand-light transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> К кабинету
                </Link>
                <div className="card-soft p-8 text-center text-gray-500 dark:text-gray-400">
                    {error || 'Нет данных'}
                </div>
            </div>
        </div>
    );

    const { student, dashboard } = data;
    const a = dashboard.activity;
    const tiles = [
        { label: 'Решено', value: a.total_attempts, icon: <CheckCircle2 className="w-4 h-4" />, color: 'from-indigo-500 to-blue-500' },
        { label: 'Точность', value: `${a.accuracy_pct}%`, icon: <Percent className="w-4 h-4" />, color: 'from-violet-500 to-purple-500' },
        { label: 'Серия дней', value: a.streak_days, icon: <Flame className="w-4 h-4" />, color: 'from-orange-500 to-red-500' },
        { label: 'Очки', value: a.total_points, icon: <Star className="w-4 h-4" />, color: 'from-amber-500 to-yellow-500' },
        { label: 'Время, ч', value: a.total_time_hours, icon: <Clock className="w-4 h-4" />, color: 'from-emerald-500 to-teal-500' },
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <div className="max-w-3xl mx-auto px-4 py-10 mt-16">
                <Link to="/tutors/me" className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-brand dark:hover:text-brand-light transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> К кабинету
                </Link>

                {/* Шапка ученика */}
                <div className="flex items-center gap-4 mb-8">
                    <UserAvatar username={student.username} avatarId={student.avatar_id ?? undefined} size="lg" />
                    <div className="min-w-0">
                        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white truncate">{student.username}</h1>
                        <p className="text-gray-500 dark:text-gray-400 truncate">{student.email}</p>
                    </div>
                </div>

                {/* Плитки статистики */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-10">
                    {tiles.map((t) => (
                        <div key={t.label} className="card-soft p-4 animate-pop-in">
                            <div className={`inline-flex p-2 rounded-xl bg-gradient-to-br ${t.color} text-white mb-2`}>{t.icon}</div>
                            <div className="text-xl font-extrabold text-gray-900 dark:text-white">{t.value}</div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t.label}</div>
                        </div>
                    ))}
                </div>

                {/* Задания (Фаза 3) */}
                <StudentAssignments studentId={Number(studentId)} />

                {/* Занятия (Фаза 5) */}
                <StudentSessions studentId={Number(studentId)} />

                {/* Прогресс по темам */}
                <section className="mb-10">
                    <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-3">Прогресс по темам</h2>
                    {dashboard.topics_progress.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 card-soft p-6 text-center">
                            Ученик ещё не занимался по темам с оценкой освоения.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {dashboard.topics_progress.map((t) => (
                                <div key={t.skill_id} className="card-soft p-4">
                                    <div className="flex items-center justify-between mb-2 gap-3">
                                        <span className="font-bold text-gray-900 dark:text-white truncate">{t.skill_name}</span>
                                        <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                            {LEVEL_LABEL[t.level] ?? t.level} · {t.done} {plural(t.done, 'попытка', 'попытки', 'попыток')}
                                        </span>
                                    </div>
                                    <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                                        <div className="h-full rounded-full brand-gradient" style={{ width: `${t.progress_pct}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Недавняя активность */}
                <section>
                    <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-3">Недавняя активность</h2>
                    {dashboard.recent_activity.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 card-soft p-6 text-center">
                            Пока нет решённых заданий.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {dashboard.recent_activity.map((r) => (
                                <div key={r.id} className="flex items-center gap-3 card-soft p-3.5">
                                    <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${r.is_correct ? 'bg-feather/15 text-feather-shade dark:text-feather' : 'bg-cardinal/15 text-cardinal dark:text-red-400'}`}>
                                        {r.is_correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{r.title}</div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{r.topic}</div>
                                    </div>
                                    {fmtTime(r.time_spent_ms) && (
                                        <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">{fmtTime(r.time_spent_ms)}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default TutorStudentProgressPage;
