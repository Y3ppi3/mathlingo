// src/components/tutor/TutorContentLibrary.tsx
// Платформа репетиторов, Фаза 4 — библиотека своих материалов/задач в кабинете:
// список + создание/редактирование/удаление. Назначаются ученику отдельно
// (вкладка «Материал» в композере заданий на странице ученика).
import { useEffect, useState, FormEvent, JSX } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BookOpen, PenLine, Pencil, Trash2, Paperclip } from 'lucide-react';
import {
    TutorContentItem, ContentKind,
    getMyContent, createContent, updateContent, deleteContent,
} from '../../api/tutorsApi';

const emptyForm = { kind: 'material' as ContentKind, title: '', body: '', answer: '', attachment_url: '' };

const TutorContentLibrary = () => {
    const [items, setItems] = useState<TutorContentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState<number | null>(null);
    const [form, setForm] = useState(emptyForm);

    useEffect(() => {
        getMyContent().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
    }, []);

    const startCreate = () => { setForm(emptyForm); setEditId(null); setOpen(true); };
    const startEdit = (c: TutorContentItem) => {
        setForm({
            kind: c.kind, title: c.title, body: c.body ?? '',
            answer: c.answer ?? '', attachment_url: c.attachment_url ?? '',
        });
        setEditId(c.id);
        setOpen(true);
    };
    const close = () => { setOpen(false); setEditId(null); setForm(emptyForm); };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (form.title.trim().length === 0) return;
        setSaving(true);
        try {
            const payload = {
                kind: form.kind,
                title: form.title.trim(),
                body: form.body.trim() || null,
                answer: form.kind === 'task' ? (form.answer.trim() || null) : null,
                attachment_url: form.attachment_url.trim() || null,
            };
            if (editId != null) {
                const upd = await updateContent(editId, payload);
                setItems((prev) => prev.map((c) => c.id === editId ? upd : c));
            } else {
                const created = await createContent(payload);
                setItems((prev) => [created, ...prev]);
            }
            close();
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id: number) => {
        setBusy(id);
        try {
            await deleteContent(id);
            setItems((prev) => prev.filter((c) => c.id !== id));
        } finally {
            setBusy(null);
        }
    };

    const inputCls = 'w-full px-3.5 py-2 rounded-2xl bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors';

    return (
        <section className="mb-10">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                    Мои материалы {items.length > 0 && <span className="text-gray-400 dark:text-gray-500 font-bold">· {items.length}</span>}
                </h2>
                {!open && (
                    <button
                        type="button"
                        onClick={startCreate}
                        className="btn-3d bg-brand hover:bg-brand-dark border-brand-deep text-white text-sm px-3.5 py-1.5 focus-visible:ring-brand-light"
                    >
                        <Plus className="w-4 h-4" /> Добавить
                    </button>
                )}
            </div>

            {open && (
                <form onSubmit={submit} className="card-soft p-5 space-y-4 mb-4">
                    {/* Тип */}
                    <div className="flex gap-2">
                        {([['material', 'Материал', <BookOpen className="w-4 h-4" key="m" />], ['task', 'Задача', <PenLine className="w-4 h-4" key="t" />]] as [ContentKind, string, JSX.Element][]).map(([k, label, icon]) => (
                            <button
                                key={k}
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, kind: k }))}
                                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-bold border-2 transition-colors ${
                                    form.kind === k
                                        ? 'bg-brand/10 border-brand/40 text-brand dark:text-brand-light'
                                        : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                                }`}
                            >
                                {icon} {label}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Название *</label>
                        <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={form.kind === 'task' ? 'Задача про параболу' : 'Конспект: производная'} maxLength={200} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Текст</label>
                        <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={5} placeholder={form.kind === 'task' ? 'Условие задачи…' : 'Материал, объяснение, ссылки…'} className={`${inputCls} resize-y`} />
                    </div>
                    {form.kind === 'task' && (
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Ответ (для самопроверки)</label>
                            <input value={form.answer} onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))} placeholder="Ученик увидит его по кнопке «Показать ответ»" maxLength={2000} className={inputCls} />
                        </div>
                    )}
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Ссылка на файл (необяз.)</label>
                        <input value={form.attachment_url} onChange={(e) => setForm((f) => ({ ...f, attachment_url: e.target.value }))} placeholder="https://…" maxLength={500} className={inputCls} />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <button type="submit" disabled={form.title.trim().length === 0 || saving} className="btn-3d bg-brand hover:bg-brand-dark border-brand-deep text-white text-sm px-4 py-2 disabled:opacity-60 focus-visible:ring-brand-light">
                            {saving ? 'Сохраняю…' : editId != null ? 'Сохранить' : 'Добавить'}
                        </button>
                        <button type="button" onClick={close} className="px-4 py-2 rounded-2xl text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
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
                        Здесь ваши задачи и материалы. Добавьте первый — и его можно будет назначать ученикам.
                    </p>
                )
            ) : (
                <div className="space-y-2">
                    {items.map((c) => {
                        const isTask = c.kind === 'task';
                        return (
                            <div key={c.id} className="flex items-center gap-3 card-soft p-3.5">
                                <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                    isTask ? 'bg-brand-accent/15 text-brand-accent'
                                        : 'bg-brand/15 text-brand dark:text-brand-light'
                                }`}>
                                    {isTask ? <PenLine className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                                </span>
                                <Link to={`/tutors/material/${c.id}`} className="min-w-0 flex-1 group">
                                    <div className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-brand dark:group-hover:text-brand-light transition-colors">{c.title}</div>
                                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                                        <span>{isTask ? 'Задача' : 'Материал'}</span>
                                        {c.attachment_url && <span className="inline-flex items-center gap-0.5"><Paperclip className="w-3 h-3" />файл</span>}
                                    </div>
                                </Link>
                                <button type="button" onClick={() => startEdit(c)} aria-label="Редактировать" className="flex-shrink-0 p-1.5 rounded-xl text-gray-400 hover:text-brand hover:bg-brand/10 transition-colors">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button type="button" onClick={() => remove(c.id)} disabled={busy === c.id} aria-label="Удалить" className="flex-shrink-0 p-1.5 rounded-xl text-gray-400 hover:text-cardinal hover:bg-cardinal/10 disabled:opacity-50 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default TutorContentLibrary;
