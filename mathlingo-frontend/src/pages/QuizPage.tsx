// src/pages/QuizPage.tsx
//
// Фаза 6: диагностический квиз до (pre) и после (post) игр. Тон спокойный, без
// оценок и давления (project_vision_design): это замер понимания, а не
// экзамен. Правильные ответы на клиент не приходят — балл считает сервер.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    getQuiz, submitQuiz,
    type AssessmentQuiz, type AssessmentResult, type QuizType,
} from '../api/studentApi';

const CONCEPT_LABEL: Record<string, string> = {
    inverse: 'Обратная матрица',
    eigen: 'Собственные векторы',
};

const INTRO: Record<QuizType, string> = {
    pre: 'Короткий замер перед игрой — 6 вопросов. Это не оценка: он нужен, чтобы потом увидеть, что дали игры. Отвечай как знаешь; не уверен — выбирай ближайшее.',
    post: 'Итоговый замер — те же 6 вопросов. Сравним с ответами до игры и увидим, что изменилось.',
};

const isQuizType = (v: string | undefined): v is QuizType => v === 'pre' || v === 'post';

const QuizPage = () => {
    const navigate = useNavigate();
    const { quizType } = useParams<{ quizType: string }>();

    const [quiz, setQuiz] = useState<AssessmentQuiz | null>(null);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [result, setResult] = useState<AssessmentResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!isQuizType(quizType)) {
            setError('Неизвестный тип теста');
            setLoading(false);
            return;
        }
        try {
            setQuiz(await getQuiz(quizType));
        } catch {
            setError('Не удалось загрузить тест');
        } finally {
            setLoading(false);
        }
    }, [quizType]);

    useEffect(() => {
        load();
    }, [load]);

    const choose = (questionId: string, optionIdx: number) => {
        setAnswers((prev) => ({ ...prev, [questionId]: optionIdx }));
    };

    const allAnswered = quiz != null && quiz.questions.every((q) => q.id in answers);

    const handleSubmit = async () => {
        if (!quiz || !isQuizType(quizType) || !allAnswered) return;
        setSubmitting(true);
        try {
            setResult(await submitQuiz(quizType, answers));
        } catch {
            setError('Не удалось отправить ответы');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <div className="max-w-2xl mx-auto px-4 py-10 mt-16">
                <button
                    type="button"
                    onClick={() => navigate('/games')}
                    className="text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-brand dark:hover:text-brand-light transition-colors"
                >
                    ← Ко всем играм
                </button>

                {loading ? (
                    <div className="mt-6 text-sm text-gray-400 dark:text-gray-500">Загрузка...</div>
                ) : error ? (
                    <div className="mt-6 px-4 py-3 bg-cardinal/10 border-2 border-cardinal/30 rounded-2xl text-sm font-semibold text-cardinal dark:text-red-400">
                        {error}
                    </div>
                ) : result ? (
                    // --- Экран результата ---
                    <div className="mt-6 card-soft p-8 text-center border-feather/30 bg-feather/5 dark:bg-feather/10 animate-pop-in">
                        <div className="text-5xl mb-3">🧠</div>
                        <div className="text-2xl font-extrabold text-gray-900 dark:text-white">
                            {result.score} из {result.max_score} верно
                        </div>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-300 max-w-sm mx-auto">
                            {result.quiz_type === 'pre'
                                ? 'Спасибо! Это стартовая точка. Теперь загляни в игры — а потом вернёшься за итоговым замером.'
                                : 'Отлично, замер сохранён. Прогресс сравним с тем, что было до игр.'}
                        </p>
                        <div className="mt-6 flex flex-wrap gap-2 justify-center">
                            <button
                                type="button"
                                onClick={() => navigate('/games')}
                                className="btn-3d bg-brand hover:bg-brand-dark border-brand-deep text-white text-sm px-5 py-2.5 focus-visible:ring-brand-light"
                            >
                                К играм →
                            </button>
                        </div>
                    </div>
                ) : quiz ? (
                    // --- Вопросы ---
                    <>
                        <h1 className="mt-4 text-3xl font-extrabold text-gray-900 dark:text-white">
                            {quiz.quiz_type === 'pre' ? 'Замер до игры' : 'Итоговый замер'}
                        </h1>
                        <p className="mt-2 text-gray-500 dark:text-gray-400">{INTRO[quiz.quiz_type]}</p>
                        {quiz.already_taken && (
                            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                                Ты уже проходил этот тест — можно пройти снова, зачтётся последняя попытка.
                            </p>
                        )}

                        <div className="mt-6 space-y-5">
                            {quiz.questions.map((q, qi) => (
                                <div key={q.id} className="card-soft p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                                            {qi + 1}. {q.prompt}
                                        </div>
                                        <span className="shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-brand/10 text-brand dark:text-brand-light">
                                            {CONCEPT_LABEL[q.concept] ?? q.concept}
                                        </span>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                        {q.options.map((opt, oi) => {
                                            const picked = answers[q.id] === oi;
                                            return (
                                                <button
                                                    key={oi}
                                                    type="button"
                                                    data-testid={`opt-${q.id}`}
                                                    onClick={() => choose(q.id, oi)}
                                                    className={`w-full text-left px-3 py-2.5 rounded-2xl border-2 text-sm font-semibold transition-all ${
                                                        picked
                                                            ? 'border-brand bg-brand/5 dark:bg-brand/10 text-brand dark:text-brand-light'
                                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-brand/40 dark:hover:border-brand/40'
                                                    }`}
                                                >
                                                    <span className={`inline-flex items-center justify-center w-5 h-5 mr-2 rounded-full border-2 text-xs transition-colors ${
                                                        picked ? 'border-brand bg-brand text-white' : 'border-gray-300 dark:border-gray-600 text-transparent'
                                                    }`}>
                                                        ✓
                                                    </span>
                                                    {opt}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!allAnswered || submitting}
                                className="btn-3d bg-feather hover:bg-feather-shade border-feather-shade text-white text-sm px-6 py-2.5 disabled:opacity-40 focus-visible:ring-feather-light"
                            >
                                {submitting ? 'Отправляем...' : 'Готово'}
                            </button>
                            {!allAnswered && (
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                    Ответь на все вопросы — {Object.keys(answers).length} из {quiz.questions.length}
                                </span>
                            )}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
};

export default QuizPage;
