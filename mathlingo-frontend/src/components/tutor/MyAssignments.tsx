// src/components/tutor/MyAssignments.tsx
// Платформа репетиторов, Фаза 3 — задания ученика от его репетиторов:
// открыть по ссылке и отметить выполненным. Секция сама прячется, если пусто.
import { useEffect, useState, JSX } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Gamepad2, ClipboardList, BookOpen, Check, Clock, ArrowRight } from 'lucide-react';
import { Assignment, AssignmentKind, getMyAssignments, completeAssignment } from '../../api/tutorsApi';

const KIND_ICON: Record<AssignmentKind, JSX.Element> = {
    exam: <GraduationCap className="w-4 h-4" />,
    game: <Gamepad2 className="w-4 h-4" />,
    material: <BookOpen className="w-4 h-4" />,
    custom: <ClipboardList className="w-4 h-4" />,
};

const fmtDue = (iso: string) =>
    new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

const MyAssignments = () => {
    const [items, setItems] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<number | null>(null);

    useEffect(() => {
        getMyAssignments()
            .then(setItems)
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, []);

    const toggle = async (a: Assignment) => {
        setBusy(a.id);
        try {
            const updated = await completeAssignment(a.id, a.status !== 'done');
            setItems((prev) => prev.map((x) => x.id === a.id ? updated : x));
        } finally {
            setBusy(null);
        }
    };

    if (loading || items.length === 0) return null;

    const activeCount = items.filter((a) => a.status !== 'done').length;

    return (
        <section className="mb-10">
            <h2 className="text-sm font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Задания от репетитора {activeCount > 0 && <span className="text-brand dark:text-brand-light">· {activeCount}</span>}
            </h2>
            <div className="space-y-2.5">
                {items.map((a) => {
                    const done = a.status === 'done';
                    return (
                        <div key={a.id} className="flex items-center gap-3 card-soft p-3.5">
                            {/* Отметка выполнения */}
                            <button
                                type="button"
                                onClick={() => toggle(a)}
                                disabled={busy === a.id}
                                aria-label={done ? 'Снять отметку' : 'Отметить выполненным'}
                                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors disabled:opacity-50 ${
                                    done
                                        ? 'bg-feather border-feather text-white'
                                        : 'border-gray-300 dark:border-gray-600 text-transparent hover:border-feather'
                                }`}
                            >
                                <Check className="w-4 h-4" />
                            </button>

                            <div className="min-w-0 flex-1">
                                <div className={`text-sm font-bold truncate ${done ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                                    {a.title}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 truncate">
                                    <span className="inline-flex items-center gap-1">{KIND_ICON[a.kind]}{a.tutor_username}</span>
                                    {a.note && <span className="truncate">· {a.note}</span>}
                                </div>
                            </div>

                            {a.due_at && (
                                <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold ${done ? 'text-gray-400 dark:text-gray-600' : 'text-fox dark:text-fox'}`}>
                                    <Clock className="w-3.5 h-3.5" />{fmtDue(a.due_at)}
                                </span>
                            )}

                            {a.link && !done && (
                                <Link
                                    to={a.link}
                                    className="btn-3d flex-shrink-0 bg-brand hover:bg-brand-dark border-brand-deep text-white text-sm px-3 py-1.5 focus-visible:ring-brand-light"
                                >
                                    Открыть <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default MyAssignments;
