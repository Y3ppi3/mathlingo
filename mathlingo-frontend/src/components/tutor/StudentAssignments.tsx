// src/components/tutor/StudentAssignments.tsx
// Платформа репетиторов, Фаза 3 — блок «Задания» на странице прогресса ученика:
// список назначенного + композер новой задачи (игра / номер экзамена / своё).
import { useEffect, useMemo, useState, FormEvent, JSX } from 'react';
import { Plus, Trash2, Check, Clock, GraduationCap, Gamepad2, ClipboardList, BookOpen, X } from 'lucide-react';
import { getGameCatalog, GameCatalogEntry } from '../../api/studentApi';
import { api } from '../../api/studentApi';
import { buildGameLink, SubjectLite } from '../../utils/gameLink';
import {
    Assignment, AssignmentKind, TutorContentItem,
    getStudentAssignments, createAssignment, deleteAssignment, getMyContent,
} from '../../api/tutorsApi';

const KIND_ICON: Record<AssignmentKind, JSX.Element> = {
    exam: <GraduationCap className="w-4 h-4" />,
    game: <Gamepad2 className="w-4 h-4" />,
    material: <BookOpen className="w-4 h-4" />,
    custom: <ClipboardList className="w-4 h-4" />,
};

const examLabel = (exam: string, track: string) =>
    exam === 'oge' ? 'ОГЭ' : `ЕГЭ (${track === 'base' ? 'база' : 'профиль'})`;

const fmtDue = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

const StudentAssignments = ({ studentId }: { studentId: number }) => {
    const [items, setItems] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState<number | null>(null);

    // Справочники для пикеров (грузим лениво при первом открытии композера).
    const [catalog, setCatalog] = useState<GameCatalogEntry[]>([]);
    const [subjects, setSubjects] = useState<SubjectLite[]>([]);
    const [content, setContent] = useState<TutorContentItem[]>([]);
    const [refsLoaded, setRefsLoaded] = useState(false);

    // Поля формы
    const [kind, setKind] = useState<AssignmentKind>('exam');
    const [exam, setExam] = useState<'oge' | 'ege'>('ege');
    const [track, setTrack] = useState<'base' | 'profile'>('profile');
    const [taskNumber, setTaskNumber] = useState('');
    const [gameId, setGameId] = useState('');
    const [contentId, setContentId] = useState<number | ''>('');
    const [title, setTitle] = useState('');
    const [note, setNote] = useState('');
    const [dueDate, setDueDate] = useState('');

    useEffect(() => {
        getStudentAssignments(studentId)
            .then(setItems)
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [studentId]);

    const loadRefs = () => {
        if (refsLoaded) return;
        setRefsLoaded(true);
        Promise.all([
            getGameCatalog().catch(() => [] as GameCatalogEntry[]),
            api.get('/api/subjects').then((r) => r.data).catch(() => []),
            getMyContent().catch(() => [] as TutorContentItem[]),
        ]).then(([cat, subs, cont]) => {
            setCatalog(cat);
            setSubjects(Array.isArray(subs) ? subs : []);
            setContent(cont);
            if (cat.length && !gameId) setGameId(cat[0].id);
            if (cont.length && contentId === '') setContentId(cont[0].id);
        });
    };

    const openComposer = () => { loadRefs(); setOpen(true); };
    const resetForm = () => { setTaskNumber(''); setTitle(''); setNote(''); setDueDate(''); };

    const gamesByCategory = useMemo(() => {
        const map = new Map<string, GameCatalogEntry[]>();
        for (const g of catalog) {
            const arr = map.get(g.category) ?? [];
            arr.push(g);
            map.set(g.category, arr);
        }
        return [...map.entries()];
    }, [catalog]);

    const canSubmit =
        kind === 'custom' ? title.trim().length > 0
        : kind === 'game' ? gameId.length > 0
        : kind === 'material' ? contentId !== ''
        : true;

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setSaving(true);
        try {
            let finalTitle = title.trim();
            let link: string | null = null;
            if (kind === 'exam') {
                const params = new URLSearchParams({ exam });
                if (exam === 'ege') params.set('track', track);
                if (taskNumber.trim()) params.set('task_number', taskNumber.trim());
                link = `/exam/train?${params.toString()}`;
                finalTitle = finalTitle || `${examLabel(exam, track)}${taskNumber.trim() ? `, задание №${taskNumber.trim()}` : ''}`;
            } else if (kind === 'game') {
                const entry = catalog.find((g) => g.id === gameId);
                if (entry) {
                    link = buildGameLink(entry, subjects);
                    finalTitle = finalTitle || `Игра: ${entry.title}`;
                }
            } else if (kind === 'material') {
                const c = content.find((x) => x.id === contentId);
                if (c) {
                    link = `/tutors/material/${c.id}`;
                    finalTitle = finalTitle || `Материал: ${c.title}`;
                }
            }
            const created = await createAssignment(studentId, {
                kind,
                title: finalTitle,
                link,
                note: note.trim() || null,
                due_at: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
            });
            setItems((prev) => [created, ...prev]);
            resetForm();
            setOpen(false);
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id: number) => {
        setBusy(id);
        try {
            await deleteAssignment(id);
            setItems((prev) => prev.filter((a) => a.id !== id));
        } finally {
            setBusy(null);
        }
    };

    const inputCls = 'w-full px-3.5 py-2 rounded-2xl bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors';

    return (
        <section className="mb-10">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">Задания</h2>
                {!open && (
                    <button
                        type="button"
                        onClick={openComposer}
                        className="btn-3d bg-brand hover:bg-brand-dark border-brand-deep text-white text-sm px-3.5 py-1.5 focus-visible:ring-brand-light"
                    >
                        <Plus className="w-4 h-4" /> Назначить
                    </button>
                )}
            </div>

            {/* Композер */}
            {open && (
                <form onSubmit={submit} className="card-soft p-5 space-y-4 mb-4">
                    {/* Тип задания */}
                    <div className="flex flex-wrap gap-2">
                        {([['exam', 'Экзамен'], ['game', 'Игра'], ['material', 'Материал'], ['custom', 'Своё']] as [AssignmentKind, string][]).map(([k, label]) => (
                            <button
                                key={k}
                                type="button"
                                onClick={() => setKind(k)}
                                className={`flex-1 min-w-[5rem] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-bold border-2 transition-colors ${
                                    kind === k
                                        ? 'bg-brand/10 border-brand/40 text-brand dark:text-brand-light'
                                        : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                                }`}
                            >
                                {KIND_ICON[k]} {label}
                            </button>
                        ))}
                    </div>

                    {/* Поля под тип */}
                    {kind === 'exam' && (
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Экзамен</label>
                                <select value={exam} onChange={(e) => setExam(e.target.value as 'oge' | 'ege')} className={inputCls}>
                                    <option value="ege">ЕГЭ</option>
                                    <option value="oge">ОГЭ</option>
                                </select>
                            </div>
                            {exam === 'ege' && (
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Уровень</label>
                                    <select value={track} onChange={(e) => setTrack(e.target.value as 'base' | 'profile')} className={inputCls}>
                                        <option value="profile">Профиль</option>
                                        <option value="base">База</option>
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Номер (необяз.)</label>
                                <input
                                    value={taskNumber}
                                    onChange={(e) => setTaskNumber(e.target.value.replace(/[^0-9]/g, ''))}
                                    inputMode="numeric"
                                    placeholder="7"
                                    className={inputCls}
                                />
                            </div>
                        </div>
                    )}

                    {kind === 'game' && (
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Игра</label>
                            <select value={gameId} onChange={(e) => setGameId(e.target.value)} className={inputCls}>
                                {gamesByCategory.map(([cat, games]) => (
                                    <optgroup key={cat} label={cat}>
                                        {games.map((g) => (
                                            <option key={g.id} value={g.id}>{g.icon} {g.title}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                    )}

                    {kind === 'material' && (
                        content.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-3">
                                У вас пока нет своих материалов. Добавьте их в кабинете, в разделе «Мои материалы».
                            </p>
                        ) : (
                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Материал</label>
                                <select value={contentId} onChange={(e) => setContentId(Number(e.target.value))} className={inputCls}>
                                    {content.map((c) => (
                                        <option key={c.id} value={c.id}>{c.kind === 'task' ? '✏️' : '📖'} {c.title}</option>
                                    ))}
                                </select>
                            </div>
                        )
                    )}

                    {kind === 'custom' && (
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Задание *</label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Например: повтори формулы сокращённого умножения"
                                maxLength={200}
                                className={inputCls}
                            />
                        </div>
                    )}

                    {/* Общие поля */}
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Комментарий (необяз.)</label>
                            <input
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Что важно, на что обратить внимание"
                                maxLength={2000}
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Срок (необяз.)</label>
                            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <button
                            type="submit"
                            disabled={!canSubmit || saving}
                            className="btn-3d bg-brand hover:bg-brand-dark border-brand-deep text-white text-sm px-4 py-2 disabled:opacity-60 focus-visible:ring-brand-light"
                        >
                            {saving ? 'Назначаю…' : 'Назначить'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setOpen(false); resetForm(); }}
                            className="px-4 py-2 rounded-2xl text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        >
                            Отмена
                        </button>
                    </div>
                </form>
            )}

            {/* Список заданий */}
            {loading ? (
                <div className="flex justify-center py-6">
                    <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
            ) : items.length === 0 ? (
                !open && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 card-soft p-6 text-center">
                        Пока нет заданий. Назначьте первое — ученик увидит его в своём кабинете.
                    </p>
                )
            ) : (
                <div className="space-y-2">
                    {items.map((a) => {
                        const done = a.status === 'done';
                        return (
                            <div key={a.id} className="flex items-center gap-3 card-soft p-3.5">
                                <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                    done ? 'bg-feather/15 text-feather-shade dark:text-feather'
                                        : 'bg-brand/15 text-brand dark:text-brand-light'
                                }`}>
                                    {done ? <Check className="w-4 h-4" /> : KIND_ICON[a.kind]}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className={`text-sm font-bold truncate ${done ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                                        {a.title}
                                    </div>
                                    {a.note && <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{a.note}</div>}
                                </div>
                                {a.due_at && (
                                    <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold ${done ? 'text-gray-400 dark:text-gray-600' : 'text-fox dark:text-fox'}`}>
                                        <Clock className="w-3.5 h-3.5" /> {fmtDue(a.due_at)}
                                    </span>
                                )}
                                <span className={`flex-shrink-0 text-xs font-bold ${done ? 'text-feather-shade dark:text-feather' : 'text-gray-400 dark:text-gray-500'}`}>
                                    {done ? 'Выполнено' : 'Назначено'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => remove(a.id)}
                                    disabled={busy === a.id}
                                    aria-label="Удалить задание"
                                    className="flex-shrink-0 p-1.5 rounded-xl text-gray-400 hover:text-cardinal hover:bg-cardinal/10 disabled:opacity-50 transition-colors"
                                >
                                    {busy === a.id ? <X className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default StudentAssignments;
