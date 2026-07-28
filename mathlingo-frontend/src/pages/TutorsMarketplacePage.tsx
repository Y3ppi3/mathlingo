// src/pages/TutorsMarketplacePage.tsx
// Платформа репетиторов, Фаза 1 — маркетплейс: ученик выбирает репетитора.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Check, Clock, Users } from 'lucide-react';
import UserAvatar from '../components/ui/UserAvatar';
import MyAssignments from '../components/tutor/MyAssignments';
import MySessions from '../components/tutor/MySessions';
import {
    listTutors, getMyTutors, getMyTutorProfile, connectToTutor,
    TutorCard, TutorConnection,
} from '../api/tutorsApi';

const statusBadge = (s: 'pending' | 'active') =>
    s === 'active'
        ? { label: 'Вы занимаетесь', cls: 'bg-feather/15 text-feather-shade dark:text-feather', icon: <Check className="w-3.5 h-3.5" /> }
        : { label: 'Заявка отправлена', cls: 'bg-bee/15 text-bee-shade dark:text-bee', icon: <Clock className="w-3.5 h-3.5" /> };

const TutorsMarketplacePage = () => {
    const [tutors, setTutors] = useState<TutorCard[]>([]);
    const [myTutors, setMyTutors] = useState<TutorConnection[]>([]);
    const [isTutor, setIsTutor] = useState(false);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState<number | null>(null);

    const load = async () => {
        const [t, mt, prof] = await Promise.all([
            listTutors().catch(() => []),
            getMyTutors().catch(() => []),
            getMyTutorProfile().catch(() => null),
        ]);
        setTutors(t);
        setMyTutors(mt);
        setIsTutor(!!prof);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleConnect = async (tutorId: number) => {
        setConnecting(tutorId);
        try {
            await connectToTutor(tutorId);
            setTutors((prev) => prev.map((t) => t.user_id === tutorId ? { ...t, connection_status: 'pending' } : t));
            setMyTutors(await getMyTutors().catch(() => myTutors));
        } finally {
            setConnecting(null);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <div className="max-w-5xl mx-auto px-4 py-10 mt-16 flex justify-center">
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <div className="max-w-5xl mx-auto px-4 py-10 mt-16">

                {/* Заголовок */}
                <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Репетиторы</h1>
                        <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-xl">
                            Найдите репетитора по математике — он будет видеть ваш прогресс и заниматься с вами.
                        </p>
                    </div>
                    <Link
                        to="/tutors/me"
                        className="btn-3d bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm px-4 py-2.5 focus-visible:ring-gray-300"
                    >
                        <GraduationCap className="w-4 h-4" />
                        {isTutor ? 'Кабинет репетитора' : 'Стать репетитором'}
                    </Link>
                </header>

                {/* Ближайшие занятия (Фаза 5) */}
                <MySessions />

                {/* Задания от репетитора (Фаза 3) */}
                <MyAssignments />

                {/* Мои репетиторы */}
                {myTutors.length > 0 && (
                    <section className="mb-10">
                        <h2 className="text-sm font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                            Мои репетиторы
                        </h2>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {myTutors.map((c) => {
                                const b = statusBadge(c.status);
                                return (
                                    <div key={c.tutor_id} className="flex items-center gap-3 card-soft p-4">
                                        <UserAvatar username={c.username} avatarId={c.avatar_id ?? undefined} size="md" />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-extrabold text-gray-900 dark:text-white truncate">{c.username}</div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{c.headline}</div>
                                        </div>
                                        <span className={`inline-flex items-center gap-1 flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${b.cls}`}>
                                            {b.icon}{b.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Каталог */}
                <section>
                    <h2 className="text-sm font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                        Все репетиторы
                    </h2>
                    {tutors.length === 0 ? (
                        <div className="card-soft p-10 text-center text-gray-400 dark:text-gray-500">
                            Пока никого нет. Загляните позже — или станьте репетитором сами.
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {tutors.map((t) => (
                                <article key={t.user_id} className="flex flex-col card-interactive p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <UserAvatar username={t.username} avatarId={t.avatar_id ?? undefined} size="md" />
                                        <div className="min-w-0">
                                            <div className="font-extrabold text-gray-900 dark:text-white truncate">{t.username}</div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{t.headline}</div>
                                        </div>
                                    </div>

                                    {t.bio && <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-3">{t.bio}</p>}

                                    {t.subjects && t.subjects.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                            {t.subjects.map((s) => (
                                                <span key={s} className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand/10 text-brand dark:text-brand-light">{s}</span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-3">
                                            {typeof t.students_count === 'number' && (
                                                <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{t.students_count}</span>
                                            )}
                                            {typeof t.hourly_rate === 'number' && (
                                                <span className="font-extrabold text-gray-700 dark:text-gray-200">{t.hourly_rate} ₽/ч</span>
                                            )}
                                        </div>
                                        {t.connection_status === 'none' ? (
                                            <button
                                                type="button"
                                                disabled={connecting === t.user_id}
                                                onClick={() => handleConnect(t.user_id)}
                                                className="btn-3d bg-brand hover:bg-brand-dark border-brand-deep text-white text-sm px-4 py-2 disabled:opacity-60 focus-visible:ring-brand-light"
                                            >
                                                {connecting === t.user_id ? '…' : 'Связаться'}
                                            </button>
                                        ) : (
                                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-full ${statusBadge(t.connection_status as 'pending' | 'active').cls}`}>
                                                {statusBadge(t.connection_status as 'pending' | 'active').icon}
                                                {statusBadge(t.connection_status as 'pending' | 'active').label}
                                            </span>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default TutorsMarketplacePage;
