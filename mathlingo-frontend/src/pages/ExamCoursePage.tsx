// src/pages/ExamCoursePage.tsx
//
// Ф3: курс подготовки к ЕГЭ/ОГЭ. Карта курса = номера заданий экзамена: по
// каждому видно, сколько решено и закрыт ли он. Отсюда запускается тренажёр —
// либо по конкретному номеру, либо «вперемешку».
// Тон спокойный: прогресс показываем как продвижение, а не как долг
// (project_vision_design) — никаких «ты отстаёшь» и красных счётчиков.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExamProgress, type ExamProgress, type ExamProgressItem } from '../api/studentApi';

type Exam = 'oge' | 'ege';
type Track = 'base' | 'profile';

const TRACKS: Array<{ id: Track; label: string }> = [
    { id: 'base', label: 'База' },
    { id: 'profile', label: 'Профиль' },
];

const Stat = ({ value, label }: { value: string | number; label: string }) => (
    <div className="flex-1 min-w-[7rem] card-soft p-4 animate-pop-in">
        <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{value}</div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
);

const NumberCard = ({ item, onTrain }: { item: ExamProgressItem; onTrain: () => void }) => {
    const pct = item.total ? Math.round((item.solved / item.total) * 100) : 0;
    return (
        <button
            type="button"
            onClick={onTrain}
            // Фон задаём явно: у <button> без него проступает дефолт браузера
            // (белая плашка в тёмной теме).
            className={`text-left p-4 rounded-2xl border-2 transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                item.mastered
                    ? 'border-feather/30 bg-feather/5 dark:bg-feather/10'
                    : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/40 hover:border-brand/40 dark:hover:border-brand/40'
            }`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                    {item.task_number !== null ? `Задание ${item.task_number}` : 'Без номера'}
                </span>
                {item.mastered && <span title="Номер закрыт">✅</span>}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.topic ?? '—'}</div>
            <div className="mt-3 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${item.mastered ? 'bg-feather' : 'bg-brand'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Решено {item.solved} из {item.total}
                {item.accuracy !== null && ` · точность ${Math.round(item.accuracy * 100)}%`}
            </div>
        </button>
    );
};

const ExamCoursePage = () => {
    const navigate = useNavigate();
    const [exam, setExam] = useState<Exam>('ege');
    const [track, setTrack] = useState<Track>('profile');
    const [progress, setProgress] = useState<ExamProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setProgress(await getExamProgress(exam, exam === 'ege' ? track : undefined));
        } catch {
            setError('Не получилось загрузить курс. Попробуй обновить страницу.');
        } finally {
            setLoading(false);
        }
    }, [exam, track]);

    useEffect(() => {
        void load();
    }, [load]);

    const train = (taskNumber?: number) => {
        const params = new URLSearchParams({ exam });
        if (exam === 'ege') params.set('track', track);
        if (taskNumber !== undefined) params.set('task_number', String(taskNumber));
        navigate(`/exam/train?${params.toString()}`);
    };

    const pill = (active: boolean) =>
        `h-9 px-4 rounded-full text-sm font-bold border-2 transition-colors ${
            active
                ? 'bg-brand/10 border-brand/40 text-brand dark:text-brand-light'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
        }`;

    // Navbar рендерит App.tsx глобально; он fixed — отсюда mt-16 (конвенция
    // остальных страниц), иначе заголовок уезжает под шапку.
    return (
        <div className="min-h-screen bg-white dark:bg-gray-900">
            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 mt-16">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
                    Подготовка к экзамену
                </h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Разбор есть у каждого задания — ошибиться здесь безопасно.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                    <button type="button" className={pill(exam === 'oge')} onClick={() => setExam('oge')}>
                        ОГЭ
                    </button>
                    <button type="button" className={pill(exam === 'ege')} onClick={() => setExam('ege')}>
                        ЕГЭ
                    </button>
                    {exam === 'ege' && (
                        <>
                            <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
                            {TRACKS.map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    className={pill(track === t.id)}
                                    onClick={() => setTrack(t.id)}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </>
                    )}
                </div>

                {loading && <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">Загружаем курс…</p>}
                {error && <p className="mt-8 text-sm font-semibold text-cardinal dark:text-red-400">{error}</p>}

                {progress && !loading && (
                    <>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <Stat value={progress.solved_tasks} label="Заданий решено" />
                            <Stat value={progress.mastered_numbers} label="Номеров закрыто" />
                            <Stat
                                value={progress.accuracy !== null ? `${Math.round(progress.accuracy * 100)}%` : '—'}
                                label="Точность"
                            />
                            <Stat value={progress.total_tasks} label="Всего в банке" />
                        </div>

                        {progress.total_tasks === 0 ? (
                            <div className="mt-8 card-soft p-6 text-center">
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Здесь пока пусто — заданий по этому экзамену ещё нет.
                                </p>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Загляни позже или выбери другой экзамен.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
                                    <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                                        Номера заданий
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={() => train()}
                                        className="btn-3d bg-brand hover:bg-brand-dark border-brand-deep text-white text-sm px-4 py-2.5 focus-visible:ring-brand-light"
                                    >
                                        Тренироваться вперемешку
                                    </button>
                                </div>
                                <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                    {progress.items.map((item) => (
                                        <NumberCard
                                            key={`${item.task_number}-${item.topic}`}
                                            item={item}
                                            onTrain={() => train(item.task_number ?? undefined)}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default ExamCoursePage;
