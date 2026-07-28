// src/pages/TutorDashboardPage.tsx
// Платформа репетиторов, Фаза 1 — кабинет репетитора: профиль + свои ученики.
import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, CalendarDays } from 'lucide-react';
import UserAvatar from '../components/ui/UserAvatar';
import SessionAgenda from '../components/tutor/SessionAgenda';
import TutorContentLibrary from '../components/tutor/TutorContentLibrary';
import {
    getMyTutorProfile, upsertMyTutorProfile, getMyStudents, acceptStudent,
    getMyAgenda, cancelSession,
    StudentCard, TutorSessionCard,
} from '../api/tutorsApi';

const TutorDashboardPage = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [students, setStudents] = useState<StudentCard[]>([]);
    const [accepting, setAccepting] = useState<number | null>(null);
    const [agenda, setAgenda] = useState<TutorSessionCard[]>([]);
    const [cancelling, setCancelling] = useState<number | null>(null);

    // Поля профиля
    const [headline, setHeadline] = useState('');
    const [bio, setBio] = useState('');
    const [subjectsText, setSubjectsText] = useState('');
    const [rateText, setRateText] = useState('');
    const [isListed, setIsListed] = useState(true);
    const [isTutor, setIsTutor] = useState(false);

    useEffect(() => {
        (async () => {
            const [prof, st, ag] = await Promise.all([
                getMyTutorProfile().catch(() => null),
                getMyStudents().catch(() => []),
                getMyAgenda().catch(() => []),
            ]);
            if (prof) {
                setIsTutor(true);
                setHeadline(prof.headline);
                setBio(prof.bio ?? '');
                setSubjectsText((prof.subjects ?? []).join(', '));
                setRateText(prof.hourly_rate != null ? String(prof.hourly_rate) : '');
                setIsListed(prof.is_listed);
            }
            setStudents(st);
            setAgenda(ag);
            setLoading(false);
        })();
    }, []);

    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (headline.trim().length < 3) return;
        setSaving(true);
        setSaved(false);
        try {
            const subjects = subjectsText.split(',').map((s) => s.trim()).filter(Boolean);
            const rate = rateText.trim() ? parseInt(rateText, 10) : null;
            await upsertMyTutorProfile({
                headline: headline.trim(),
                bio: bio.trim() || null,
                subjects: subjects.length ? subjects : null,
                hourly_rate: Number.isFinite(rate as number) ? rate : null,
                is_listed: isListed,
            });
            setIsTutor(true);
            setSaved(true);
        } finally {
            setSaving(false);
        }
    };

    const accept = async (studentId: number) => {
        setAccepting(studentId);
        try {
            await acceptStudent(studentId);
            setStudents((prev) => prev.map((s) => s.student_id === studentId ? { ...s, status: 'active' } : s));
        } finally {
            setAccepting(null);
        }
    };

    const cancelMeeting = async (id: number) => {
        setCancelling(id);
        try {
            await cancelSession(id);
            setAgenda((prev) => prev.filter((s) => s.id !== id));
        } finally {
            setCancelling(null);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <div className="max-w-3xl mx-auto px-4 py-10 mt-16 flex justify-center">
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
        </div>
    );

    const pending = students.filter((s) => s.status === 'pending');
    const active = students.filter((s) => s.status === 'active');

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <div className="max-w-3xl mx-auto px-4 py-10 mt-16">
                <Link to="/tutors" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> К репетиторам
                </Link>

                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1">Кабинет репетитора</h1>
                <p className="text-gray-500 dark:text-gray-400 mb-8">
                    {isTutor ? 'Ваш профиль виден ученикам в каталоге.' : 'Заполните профиль — и вы появитесь в каталоге репетиторов.'}
                </p>

                {/* Профиль */}
                <form onSubmit={save} className="card-soft p-6 space-y-4 mb-10">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Заголовок *</label>
                        <input
                            value={headline}
                            onChange={(e) => setHeadline(e.target.value)}
                            placeholder="Репетитор по математике, ЕГЭ и ОГЭ"
                            maxLength={140}
                            className="w-full px-3.5 py-2.5 rounded-2xl bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">О себе</label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            rows={4}
                            placeholder="Опыт, подход, форматы занятий…"
                            className="w-full px-3.5 py-2.5 rounded-2xl bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors resize-y"
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Направления</label>
                            <input
                                value={subjectsText}
                                onChange={(e) => setSubjectsText(e.target.value)}
                                placeholder="Алгебра, Производные, ЕГЭ"
                                className="w-full px-3.5 py-2.5 rounded-2xl bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors"
                            />
                            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">через запятую</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Ставка, ₽/час</label>
                            <input
                                value={rateText}
                                onChange={(e) => setRateText(e.target.value.replace(/[^0-9]/g, ''))}
                                inputMode="numeric"
                                placeholder="1500"
                                className="w-full px-3.5 py-2.5 rounded-2xl bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors"
                            />
                        </div>
                    </div>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input type="checkbox" checked={isListed} onChange={(e) => setIsListed(e.target.checked)} className="w-4 h-4 rounded accent-brand" />
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Показывать меня в каталоге</span>
                    </label>

                    <div className="flex items-center gap-3 pt-1">
                        <button
                            type="submit"
                            disabled={saving || headline.trim().length < 3}
                            className="btn-3d bg-brand hover:bg-brand-dark border-brand-deep text-white text-sm px-5 py-2.5 disabled:opacity-60 focus-visible:ring-brand-light"
                        >
                            {saving ? 'Сохраняю…' : isTutor ? 'Сохранить' : 'Опубликовать профиль'}
                        </button>
                        {saved && <span className="text-sm font-bold text-feather-shade dark:text-feather inline-flex items-center gap-1"><Check className="w-4 h-4" />Сохранено</span>}
                    </div>
                </form>

                {/* Ближайшие занятия (календарь репетитора, Фаза 5) */}
                {agenda.length > 0 && (
                    <section className="mb-10">
                        <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-3 inline-flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-brand" /> Ближайшие занятия
                            <span className="text-gray-400 dark:text-gray-500 font-bold">· {agenda.length}</span>
                        </h2>
                        <SessionAgenda items={agenda} side="tutor" onCancel={cancelMeeting} busyId={cancelling} />
                        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                            Запланировать новое занятие можно на странице ученика.
                        </p>
                    </section>
                )}

                {/* Свой контент (Фаза 4) */}
                <TutorContentLibrary />

                {/* Ученики */}
                <section>
                    <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-3">
                        Мои ученики {students.length > 0 && <span className="text-gray-400 dark:text-gray-500 font-bold">· {active.length} активных</span>}
                    </h2>

                    {students.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 card-soft p-6 text-center">
                            Пока никто не записался. Ученики находят вас в каталоге.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {pending.length > 0 && (
                                <div>
                                    <div className="text-xs font-extrabold text-bee-shade dark:text-bee uppercase tracking-wide mb-2">Заявки ({pending.length})</div>
                                    <div className="space-y-2">
                                        {pending.map((s) => (
                                            <div key={s.student_id} className="flex items-center gap-3 bg-white dark:bg-gray-800 border-2 border-bee/40 rounded-2xl p-4 transition-colors">
                                                <UserAvatar username={s.username} avatarId={s.avatar_id ?? undefined} size="md" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-extrabold text-gray-900 dark:text-white truncate">{s.username}</div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{s.email}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={accepting === s.student_id}
                                                    onClick={() => accept(s.student_id)}
                                                    className="btn-3d flex-shrink-0 bg-feather hover:bg-feather-shade border-feather-shade text-white text-sm px-4 py-2 disabled:opacity-60 focus-visible:ring-feather-light"
                                                >
                                                    {accepting === s.student_id ? '…' : 'Принять'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {active.length > 0 && (
                                <div>
                                    <div className="text-xs font-extrabold text-feather-shade dark:text-feather uppercase tracking-wide mb-2">Занимаются ({active.length})</div>
                                    <div className="space-y-2">
                                        {active.map((s) => (
                                            <Link
                                                key={s.student_id}
                                                to={`/tutors/students/${s.student_id}`}
                                                className="flex items-center gap-3 card-interactive p-4"
                                            >
                                                <UserAvatar username={s.username} avatarId={s.avatar_id ?? undefined} size="md" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-extrabold text-gray-900 dark:text-white truncate">{s.username}</div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{s.email}</div>
                                                </div>
                                                <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold text-brand dark:text-brand-light">
                                                    Прогресс <ChevronRight className="w-4 h-4" />
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default TutorDashboardPage;
