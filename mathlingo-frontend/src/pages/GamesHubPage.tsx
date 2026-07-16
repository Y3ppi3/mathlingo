// src/pages/GamesHubPage.tsx
//
// Единый каталог игр (заменил разрозненные точки входа: матричные жили на
// /games, тематические — только через карту предмета, вход — во всплывающем
// меню). Теперь всё в одном месте: игры сгруппированы по категориям и
// отфильтрованы под учебный уровень ученика (Школьник/Студент/Продвинутый) с
// тумблером «показать все». Источник списка — бэкенд-каталог (game_catalog.py).
// Тон спокойный, без давления (project_vision_design).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import {
    api, getAssessmentStatus, getGameCatalog, getMyLevel, setMyLevel,
    type AssessmentStatus, type GameCatalogEntry, type LearnerLevel,
} from '../api/studentApi';

const LEVELS: Array<{ id: LearnerLevel; label: string; hint: string }> = [
    { id: 'school', label: 'Школьник', hint: 'Школьная программа' },
    { id: 'student', label: 'Студент', hint: 'Вуз: анализ, линейная алгебра' },
    { id: 'advanced', label: 'Продвинутый', hint: 'Углублённо и олимпиадно' },
];
const LEVEL_LABEL: Record<string, string> = Object.fromEntries(LEVELS.map((l) => [l.id, l.label]));

interface SubjectLite { id: number; name: string }

// Тематические игры (анализ) не привязаны жёстко к предмету — движок грузит
// игру по gameId. Ищем подходящий предмет по названию, иначе берём первый:
// standalone-игры (пределы/ряды/наклон) subjectId всё равно игнорируют.
const HINT_KEYWORDS: Record<string, string[]> = {
    derivatives: ['производ', 'дифференц'],
    integrals: ['интеграл'],
    limits: ['предел'],
    series: ['ряд'],
    slopefield: ['наклон', 'уравнен', 'поле'],
};

const resolveSubjectId = (hint: string | undefined, subjects: SubjectLite[]): number => {
    if (hint && subjects.length) {
        const kws = HINT_KEYWORDS[hint] ?? [];
        const match = subjects.find((s) => kws.some((kw) => s.name.toLowerCase().includes(kw)));
        if (match) return match.id;
    }
    return subjects[0]?.id ?? 1;
};

const QuizNudge = ({ status, onGo }: { status: AssessmentStatus; onGo: (t: 'pre' | 'post') => void }) => {
    const quizType: 'pre' | 'post' | null =
        !status.pre_taken ? 'pre' : !status.post_taken ? 'post' : null;
    if (quizType === null) return null;
    const isPre = quizType === 'pre';
    return (
        <div className="mb-6 flex items-center justify-between gap-4 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/5">
            <div className="text-sm text-gray-700 dark:text-gray-200">
                <span className="font-medium">{isPre ? '🧠 Замер перед игрой' : '🧠 Итоговый замер'}</span>{' '}
                <span className="text-gray-500 dark:text-gray-400">
                    {isPre ? '— 6 коротких вопросов, по желанию.' : '— поиграл? Сравни с началом.'}
                </span>
            </div>
            <button
                type="button"
                onClick={() => onGo(quizType)}
                className="shrink-0 h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
            >
                {isPre ? 'Пройти' : 'Пройти итог'}
            </button>
        </div>
    );
};

const GamesHubPage = () => {
    const navigate = useNavigate();
    const [catalog, setCatalog] = useState<GameCatalogEntry[]>([]);
    const [subjects, setSubjects] = useState<SubjectLite[]>([]);
    const [level, setLevel] = useState<LearnerLevel | null>(null);
    const [quizStatus, setQuizStatus] = useState<AssessmentStatus | null>(null);
    const [showAll, setShowAll] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            getGameCatalog().catch(() => [] as GameCatalogEntry[]),
            getMyLevel().catch(() => null),
            api.get('/api/subjects').then((r) => r.data).catch(() => []),
        ]).then(([cat, lvl, subs]) => {
            setCatalog(cat);
            setLevel(lvl);
            setSubjects(Array.isArray(subs) ? subs : []);
            setLoading(false);
        });
        getAssessmentStatus().then(setQuizStatus).catch(() => undefined);
    }, []);

    const chooseLevel = useCallback(async (lvl: LearnerLevel) => {
        setLevel(lvl);           // оптимистично
        setShowAll(false);
        try {
            await setMyLevel(lvl);
        } catch {
            /* уровень не сохранился — не критично для просмотра каталога */
        }
    }, []);

    const launch = useCallback((entry: GameCatalogEntry) => {
        if (entry.launch.kind === 'matrix') {
            navigate(`/games/${entry.id}`);
        } else {
            const sid = resolveSubjectId(entry.launch.subject_hint, subjects);
            navigate(`/subject/${sid}/game/${entry.id}`);
        }
    }, [navigate, subjects]);

    const visible = useMemo(() => {
        if (!level || showAll) return catalog;
        return catalog.filter((e) => e.levels.includes(level));
    }, [catalog, level, showAll]);

    const grouped = useMemo(() => {
        const map = new Map<string, GameCatalogEntry[]>();
        for (const e of visible) {
            if (!map.has(e.category)) map.set(e.category, []);
            map.get(e.category)!.push(e);
        }
        return [...map.entries()];
    }, [visible]);

    const hiddenByLevel = level !== null && !showAll && visible.length < catalog.length;

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <Navbar />
            <div className="max-w-4xl mx-auto px-4 py-10 mt-16">
                <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Игры</h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            Все игры в одном месте. Выбирай любую — прогресс и звёзды копятся.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/games/leaderboard')}
                        className="shrink-0 h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-indigo-400 transition-colors"
                    >
                        🏆 Лидерборд
                    </button>
                </header>

                {quizStatus && <QuizNudge status={quizStatus} onGo={(t) => navigate(`/games/quiz/${t}`)} />}

                {/* Выбор уровня */}
                {level === null ? (
                    <div className="mb-6 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/5">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">Какой у тебя уровень?</div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Подберём игры под тебя. Всегда можно сменить или посмотреть все.
                        </p>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {LEVELS.map((l) => (
                                <button
                                    key={l.id}
                                    type="button"
                                    onClick={() => chooseLevel(l.id)}
                                    className="text-left p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-400 transition-colors"
                                >
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{l.label}</div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500">{l.hint}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mb-6 flex items-center gap-2 flex-wrap text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Уровень:</span>
                        {LEVELS.map((l) => (
                            <button
                                key={l.id}
                                type="button"
                                onClick={() => chooseLevel(l.id)}
                                className={`px-3 h-8 rounded-full border transition-colors ${
                                    level === l.id
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                                }`}
                            >
                                {l.label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setShowAll((v) => !v)}
                            className="ml-auto text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                            {showAll ? 'Показать под уровень' : 'Показать все игры'}
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="text-sm text-gray-400 dark:text-gray-500">Загрузка...</div>
                ) : grouped.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-gray-200 dark:border-gray-700 text-center">
                        <p className="text-gray-500 dark:text-gray-400">
                            Для уровня «{level ? LEVEL_LABEL[level] : ''}» игр пока нет — скоро добавим.
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowAll(true)}
                            className="mt-3 h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                        >
                            Показать все игры
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {grouped.map(([category, games]) => (
                            <section key={category}>
                                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                    {category}
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {games.map((game) => (
                                        <button
                                            key={game.id}
                                            type="button"
                                            onClick={() => launch(game)}
                                            className="text-left p-5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all hover:scale-[1.02] hover:border-indigo-400 dark:hover:border-indigo-500"
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className="text-3xl" aria-hidden="true">{game.icon}</span>
                                                <div>
                                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{game.title}</h3>
                                                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{game.description}</p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        ))}

                        {hiddenByLevel && (
                            <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                                Часть игр скрыта под твой уровень.{' '}
                                <button type="button" onClick={() => setShowAll(true)} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                    Показать все
                                </button>
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GamesHubPage;
