// src/pages/QuizPage.tsx
//
// Фаза 6: диагностический квиз до (pre) и после (post) игр. Тон спокойный, без
// оценок и давления (project_vision_design): это замер понимания, а не
// экзамен. Правильные ответы на клиент не приходят — балл считает сервер.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
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
            <Navbar />
            <div className="max-w-2xl mx-auto px-4 py-10 mt-16">
                <button
                    type="button"
                    onClick={() => navigate('/games')}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    ← Ко всем играм
                </button>

                {loading ? (
                    <div className="mt-6 text-sm text-gray-400 dark:text-gray-500">Загрузка...</div>
                ) : error ? (
                    <div className="mt-6 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-sm text-red-600 dark:text-red-400">
                        {error}
                    </div>
                ) : result ? (
                    // --- Экран результата ---
                    <div className="mt-6 p-6 rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-center">
                        <div className="text-4xl mb-2">🧠</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            {result.score} из {result.max_score} верно
                        </div>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                            {result.quiz_type === 'pre'
                                ? 'Спасибо! Это стартовая точка. Теперь загляни в игры — а потом вернёшься за итоговым замером.'
                                : 'Отлично, замер сохранён. Прогресс сравним с тем, что было до игр.'}
                        </p>
                        <div className="mt-6 flex flex-wrap gap-2 justify-center">
                            <button
                                type="button"
                                onClick={() => navigate('/games')}
                                className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                            >
                                К играм →
                            </button>
                        </div>
                    </div>
                ) : quiz ? (
                    // --- Вопросы ---
                    <>
                        <h1 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">
                            {quiz.quiz_type === 'pre' ? 'Замер до игры' : 'Итоговый замер'}
                        </h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">{INTRO[quiz.quiz_type]}</p>
                        {quiz.already_taken && (
                            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                                Ты уже проходил этот тест — можно пройти снова, зачтётся последняя попытка.
                            </p>
                        )}

                        <div className="mt-6 space-y-5">
                            {quiz.questions.map((q, qi) => (
                                <div key={q.id} className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {qi + 1}. {q.prompt}
                                        </div>
                                        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
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
                                                    className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                                                        picked
                                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-200'
                                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                                                    }`}
                                                >
                                                    <span className={`inline-flex items-center justify-center w-5 h-5 mr-2 rounded-full border text-xs ${
                                                        picked ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300 dark:border-gray-600 text-transparent'
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
                                className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
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
