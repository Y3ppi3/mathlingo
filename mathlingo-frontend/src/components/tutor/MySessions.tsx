// src/components/tutor/MySessions.tsx
// Платформа репетиторов, Фаза 5 — ближайшие занятия ученика со всеми
// репетиторами. Секция сама прячется, если встреч нет.
import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import SessionAgenda from './SessionAgenda';
import { TutorSessionCard, getMySessions } from '../../api/tutorsApi';

const MySessions = () => {
    const [items, setItems] = useState<TutorSessionCard[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getMySessions()
            .then(setItems)
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, []);

    if (loading || items.length === 0) return null;

    return (
        <section className="mb-10">
            <h2 className="text-sm font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 inline-flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-brand" /> Ближайшие занятия
            </h2>
            <SessionAgenda items={items} side="student" />
        </section>
    );
};

export default MySessions;
