// src/components/tutor/StudentSessions.tsx
// Платформа репетиторов, Фаза 5 — блок «Занятия» на странице прогресса ученика:
// список ближайших занятий + композер (дата/время/длительность/ссылка).
import { useEffect, useState, FormEvent } from 'react';
import { CalendarPlus } from 'lucide-react';
import SessionAgenda from './SessionAgenda';
import {
    TutorSessionCard, getStudentSessions, createSession, updateSession, cancelSession,
} from '../../api/tutorsApi';

const DURATIONS = [30, 45, 60, 90, 120];

// ISO (с зоной) → локальные YYYY-MM-DD и HH:MM для input[type=date|time].
const pad = (n: number) => String(n).padStart(2, '0');
const splitLocal = (iso: string) => {
    const d = new Date(iso);
    return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
};

const StudentSessions = ({ studentId }: { studentId: number }) => {
    const [items, setItems] = useState<TutorSessionCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState<number | null>(null);

    const [date, setDate] = useState('');
    const [time, setTime] = useState('16:00');
    const [duration, setDuration] = useState(60);
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        getStudentSessions(studentId)
            .then(setItems)
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [studentId]);

    const reset = () => { setEditId(null); setDate(''); setTime('16:00'); setDuration(60); setTitle(''); setUrl(''); setNote(''); };

    const startEdit = (s: TutorSessionCard) => {
        const { date: d, time: t } = splitLocal(s.starts_at);
        setEditId(s.id);
        setDate(d);
        setTime(t);
        setDuration(s.duration_min);
        setTitle(s.title ?? '');
        setUrl(s.meeting_url ?? '');
        setNote(s.note ?? '');
        setOpen(true);
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!date) return;
        setSaving(true);
        try {
            const body = {
                starts_at: new Date(`${date}T${time || '00:00'}:00`).toISOString(),
                duration_min: duration,
                title: title.trim() || null,
                meeting_url: url.trim() || null,
                note: note.trim() || null,
            };
            if (editId != null) {
                const updated = await updateSession(editId, body);
                setItems((prev) => prev.map((s) => (s.id === editId ? updated : s))
                    .sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
            } else {
                const created = await createSession(studentId, body);
                // вставляем с сохранением сортировки по времени
                setItems((prev) => [...prev, created].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
            }
            reset();
            setOpen(false);
        } finally {
            setSaving(false);
        }
    };

    const cancel = async (id: number) => {
        setBusy(id);
        try {
            await cancelSession(id);
            setItems((prev) => prev.filter((s) => s.id !== id));
        } finally {
            setBusy(null);
        }
    };

    const inputCls = 'w-full px-3.5 py-2 rounded-2xl bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors';

    return (
        <section className="mb-10">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">Занятия</h2>
                {!open && (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="btn-3d bg-brand hover:bg-brand-dark border-brand-deep text-white text-sm px-3.5 py-1.5 focus-visible:ring-brand-light"
                    >
                        <CalendarPlus className="w-4 h-4" /> Запланировать
                    </button>
                )}
            </div>

            {open && (
                <form onSubmit={submit} className="card-soft p-5 space-y-4 mb-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Дата *</label>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Время</label>
                            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Длительность</label>
                            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputCls}>
                                {DURATIONS.map((d) => <option key={d} value={d}>{d} мин</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Тема (необяз.)</label>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Разбор ЕГЭ №7" maxLength={200} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Ссылка на встречу (необяз.)</label>
                        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://meet.google.com/…" maxLength={500} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Комментарий (необяз.)</label>
                        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Что подготовить" maxLength={2000} className={inputCls} />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                        <button type="submit" disabled={!date || saving} className="btn-3d bg-brand hover:bg-brand-dark border-brand-deep text-white text-sm px-4 py-2 disabled:opacity-60 focus-visible:ring-brand-light">
                            {saving ? 'Сохраняю…' : editId != null ? 'Сохранить перенос' : 'Запланировать'}
                        </button>
                        <button type="button" onClick={() => { setOpen(false); reset(); }} className="px-4 py-2 rounded-2xl text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                            Отмена
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex justify-center py-6">
                    <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
            ) : items.length === 0 ? (
                !open && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 card-soft p-6 text-center">
                        Занятий пока нет. Запланируйте встречу — она появится в вашем календаре и у ученика.
                    </p>
                )
            ) : (
                <SessionAgenda items={items} side="tutor" onCancel={cancel} onEdit={startEdit} busyId={busy} />
            )}
        </section>
    );
};

export default StudentSessions;
