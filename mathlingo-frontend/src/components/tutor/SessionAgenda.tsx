// src/components/tutor/SessionAgenda.tsx
// Платформа репетиторов, Фаза 5 — презентация списка занятий (агенда).
// Используется и в кабинете репетитора (side="tutor", с отменой), и у ученика
// (side="student"). Само время хранится в UTC — показываем в локальном.
import { Video, Clock, X, Pencil } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import { TutorSessionCard } from '../../api/tutorsApi';

const fmtWhen = (iso: string) => {
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }),
        time: d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };
};

const isToday = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate();
};

interface Props {
    items: TutorSessionCard[];
    side: 'tutor' | 'student';
    onCancel?: (id: number) => void;
    onEdit?: (s: TutorSessionCard) => void;
    busyId?: number | null;
}

const SessionAgenda = ({ items, side, onCancel, onEdit, busyId }: Props) => (
    <div className="space-y-2">
        {items.map((s) => {
            const { date, time } = fmtWhen(s.starts_at);
            const name = side === 'tutor' ? s.student_username : s.tutor_username;
            const avatarId = side === 'tutor' ? s.student_avatar_id : s.tutor_avatar_id;
            const today = isToday(s.starts_at);
            return (
                <div key={s.id} className={`flex items-center gap-3 card-soft p-3.5 ${today ? 'border-brand/40 dark:border-brand/40' : ''}`}>
                    {/* Дата/время */}
                    <div className="flex-shrink-0 w-16 text-center">
                        <div className="text-xs text-gray-400 dark:text-gray-500 capitalize">{today ? 'сегодня' : date}</div>
                        <div className="text-base font-extrabold text-brand dark:text-brand-light">{time}</div>
                    </div>
                    <div className="w-px self-stretch bg-gray-100 dark:bg-gray-700" />
                    {/* Кто + тема */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <UserAvatar username={name ?? '?'} avatarId={avatarId ?? undefined} size="sm" />
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                    {s.title || (side === 'tutor' ? name : `Занятие с ${name}`)}
                                </div>
                                {today && (
                                    <span className="flex-shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-brand/15 text-brand dark:text-brand-light uppercase tracking-wide">
                                        Сегодня
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                                {side === 'tutor' && s.title && <span className="truncate">{name}</span>}
                                <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{s.duration_min} мин</span>
                            </div>
                        </div>
                    </div>
                    {/* Ссылка на встречу */}
                    {s.meeting_url && (
                        <a
                            href={s.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-3d flex-shrink-0 bg-macaw hover:bg-macaw-shade border-macaw-shade text-white text-sm px-3 py-1.5 focus-visible:ring-macaw-light"
                        >
                            <Video className="w-3.5 h-3.5" /> Войти
                        </a>
                    )}
                    {/* Перенос/редактирование (только у репетитора) */}
                    {onEdit && (
                        <button
                            type="button"
                            onClick={() => onEdit(s)}
                            disabled={busyId === s.id}
                            aria-label="Перенести занятие"
                            className="flex-shrink-0 p-1.5 rounded-xl text-gray-400 hover:text-brand hover:bg-brand/10 disabled:opacity-50 transition-colors"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                    )}
                    {/* Отмена (только у репетитора) */}
                    {onCancel && (
                        <button
                            type="button"
                            onClick={() => onCancel(s.id)}
                            disabled={busyId === s.id}
                            aria-label="Отменить занятие"
                            className="flex-shrink-0 p-1.5 rounded-xl text-gray-400 hover:text-cardinal hover:bg-cardinal/10 disabled:opacity-50 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            );
        })}
    </div>
);

export default SessionAgenda;
