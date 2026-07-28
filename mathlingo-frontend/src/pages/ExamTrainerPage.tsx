// src/pages/ExamTrainerPage.tsx
//
// Ф3: тренажёр. Один экран — одно задание: условие, поле ответа, проверка,
// разбор. Следующее задание выбирает бэкенд (/api/exam/next): сначала то, что
// ученик не видел, потом то, что не решил.
// Ошибка здесь не наказание: разбор показываем всегда, «неверно» пишем
// нейтрально и сразу даём попробовать это же задание ещё раз
// (project_vision_design — спокойный тон, без вины).
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    getNextExamTask, submitExamAnswer,
    type ExamAttemptResult, type ExamFilters, type ExamTask,
} from '../api/studentApi';

const ExamTrainerPage = () => {
    const navigate = useNavigate();
    const [params] = useSearchParams();

    const filters: ExamFilters = {
        exam: params.get('exam') ?? undefined,
        track: params.get('track') ?? undefined,
        topic: params.get('topic') ?? undefined,
        task_number: params.get('task_number') ? Number(params.get('task_number')) : undefined,
    };
    const filtersKey = params.toString();

    const [task, setTask] = useState<ExamTask | null>(null);
    const [answer, setAnswer] = useState('');
    const [result, setResult] = useState<ExamAttemptResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [empty, setEmpty] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [startedAt, setStartedAt] = useState(Date.now());
    const [solvedNow, setSolvedNow] = useState(0);

    const loadNext = useCallback(async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        setAnswer('');
        try {
            setTask(await getNextExamTask(filters));
            setStartedAt(Date.now());
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 404) setEmpty(true);
            else setError('Не удалось загрузить задание. Попробуй ещё раз.');
        } finally {
            setLoading(false);
        }
        // filters — производные от строки запроса; пересобираем только при её смене.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtersKey]);

    useEffect(() => {
        void loadNext();
    }, [loadNext]);

    const check = async () => {
        if (!task || !answer.trim() || checking) return;
        setChecking(true);
        setError(null);
        try {
            const res = await submitExamAnswer(task.id, answer, Date.now() - startedAt);
            setResult(res);
            if (res.correct) setSolvedNow((n) => n + 1);
        } catch {
            setError('Не удалось проверить ответ. Попробуй ещё раз.');
        } finally {
            setChecking(false);
        }
    };

    const retry = () => {
        setResult(null);
        setAnswer('');
        setStartedAt(Date.now());
    };

    // Navbar рендерит App.tsx глобально; он fixed — отсюда mt-16.
    return (
        <div className="min-h-screen bg-white dark:bg-gray-900">
            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 mt-16">
                <div className="flex items-center justify-between gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/exam')}
                        className="text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-brand dark:hover:text-brand-light transition-colors"
                    >
                        ← К курсу
                    </button>
                    {solvedNow > 0 && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            Решено за подход: <span className="font-extrabold text-feather-shade dark:text-feather">{solvedNow}</span>
                        </span>
                    )}
                </div>

                {loading && <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">Подбираем задание…</p>}

                {empty && (
                    <div className="mt-8 card-soft p-6 text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            По этим фильтрам заданий пока нет.
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate('/exam')}
                            className="btn-3d mt-4 bg-brand hover:bg-brand-dark border-brand-deep text-white text-sm px-4 py-2.5 focus-visible:ring-brand-light"
                        >
                            Вернуться к курсу
                        </button>
                    </div>
                )}

                {task && !loading && (
                    <div className="mt-6 card-soft p-5 sm:p-6">
                        <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                            {task.exam.toUpperCase()}
                            {task.track && ` · ${task.track === 'base' ? 'база' : 'профиль'}`}
                            {task.task_number !== null && ` · задание ${task.task_number}`}
                            {task.topic && ` · ${task.topic}`}
                        </div>
                        <p className="mt-3 text-lg text-gray-900 dark:text-white">{task.statement}</p>

                        <div className="mt-5 flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !result && void check()}
                                disabled={result !== null}
                                placeholder="Ответ"
                                data-testid="exam-answer"
                                className="flex-1 h-11 px-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 disabled:opacity-60 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors"
                            />
                            {result === null ? (
                                <button
                                    type="button"
                                    onClick={() => void check()}
                                    disabled={!answer.trim() || checking}
                                    data-testid="exam-check"
                                    className="btn-3d bg-brand hover:bg-brand-dark border-brand-deep text-white text-sm px-5 py-2.5 disabled:opacity-50 focus-visible:ring-brand-light"
                                >
                                    {checking ? 'Проверяем…' : 'Проверить'}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => void loadNext()}
                                    data-testid="exam-next"
                                    className="btn-3d bg-brand hover:bg-brand-dark border-brand-deep text-white text-sm px-5 py-2.5 focus-visible:ring-brand-light"
                                >
                                    Следующее
                                </button>
                            )}
                        </div>

                        {error && <p className="mt-3 text-sm font-semibold text-cardinal dark:text-red-400">{error}</p>}

                        {result && (
                            <div
                                data-testid="exam-result"
                                className={`mt-5 p-4 rounded-2xl border-2 animate-pop-in ${
                                    result.correct
                                        ? 'border-feather/30 bg-feather/5 dark:bg-feather/10'
                                        : 'border-bee/40 bg-bee/5 dark:bg-bee/10'
                                }`}
                            >
                                <div className="text-sm font-extrabold text-gray-900 dark:text-white">
                                    {result.correct ? '✅ Верно' : `Пока нет — правильный ответ: ${result.correct_answer}`}
                                </div>
                                {result.solution && (
                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{result.solution}</p>
                                )}
                                {!result.correct && (
                                    <button
                                        type="button"
                                        onClick={retry}
                                        className="mt-3 text-sm font-bold text-brand dark:text-brand-light hover:underline"
                                    >
                                        Попробовать это же ещё раз
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default ExamTrainerPage;
