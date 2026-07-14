// src/components/adventure/DiagnosticSolver.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchSkillDiagnostic, submitDiagnostic, DiagnosticData, DiagnosticAnswer, DiagnosticSubmitResult } from '../../api/studentApi';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import LevelPicker from './LevelPicker';

// В отличие от TaskSolver — без немедленной обратной связи "верно/неверно"
// по каждому вопросу (это диагностика, не тренировка) и без начисления
// очков за отдельные ответы. Итог показывается один раз в конце — уровень
// освоения темы, посчитанный mastery-сервисом (R2 task 2) по всей серии
// сразу (см. app/routes/gamification.py submit_diagnostic).
const DiagnosticSolver = () => {
    const { skillId } = useParams<{ skillId: string }>();
    const navigate = useNavigate();

    const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<DiagnosticAnswer[]>([]);
    const [textAnswer, setTextAnswer] = useState('');
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [questionStartedAt, setQuestionStartedAt] = useState(Date.now());
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<DiagnosticSubmitResult | null>(null);

    useEffect(() => {
        if (!skillId) return;
        fetchSkillDiagnostic(parseInt(skillId))
            .then(data => { setDiagnostic(data); setQuestionStartedAt(Date.now()); })
            .catch(() => setError('Диагностика по этой теме недоступна'))
            .finally(() => setLoading(false));
    }, [skillId]);

    const currentTask = diagnostic?.tasks[currentIndex];

    const goNext = async (answer: string) => {
        if (!diagnostic || !currentTask) return;

        const nextAnswers = [
            ...answers,
            {
                task_id: currentTask.id,
                answer,
                time_spent_ms: Date.now() - questionStartedAt,
            },
        ];

        if (currentIndex < diagnostic.tasks.length - 1) {
            setAnswers(nextAnswers);
            setCurrentIndex(prev => prev + 1);
            setTextAnswer('');
            setSelectedOption(null);
            setQuestionStartedAt(Date.now());
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const submitResult = await submitDiagnostic(diagnostic.id, nextAnswers);
            setResult(submitResult);
        } catch {
            setError('Не удалось отправить диагностику. Попробуйте ещё раз.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-96">Загрузка диагностики...</div>;
    if (error) return <div className="text-red-500 p-4">{error}</div>;
    if (!diagnostic) return <div className="text-center p-4">Диагностика не найдена.</div>;

    if (result) {
        return (
            <div className="max-w-2xl mx-auto p-6 text-center">
                <h2 className="text-2xl font-bold mb-2">Диагностика завершена</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Правильных ответов: {result.correct_count} из {result.total_count}
                </p>
                <div className="mb-6 text-left">
                    <LevelPicker skillId={diagnostic.skill_id} />
                </div>
                <button
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors"
                    onClick={() => navigate(-1)}
                >
                    Продолжить
                </button>
            </div>
        );
    }

    if (!currentTask) return null;

    return (
        <div className="max-w-3xl mx-auto p-4">
            <div className="mb-6">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    Вопрос {currentIndex + 1} из {diagnostic.tasks.length}
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                    <div
                        className="bg-indigo-600 h-2 rounded-full transition-all"
                        style={{ width: `${(currentIndex / diagnostic.tasks.length) * 100}%` }}
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg mb-6">
                <h3 className="text-lg font-semibold mb-4">{currentTask.title}</h3>
                <div className="mb-6" dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentTask.content) }} />

                {currentTask.answer_type === 'multiple_choice' && currentTask.options ? (
                    <div className="space-y-3">
                        {currentTask.options.map((option, index) => (
                            <div
                                key={index}
                                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                    selectedOption === index
                                        ? 'bg-blue-100 border-blue-500 dark:bg-blue-900 dark:border-blue-600'
                                        : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                                }`}
                                onClick={() => setSelectedOption(index)}
                            >
                                <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(option) }} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <input
                        type="text"
                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        placeholder="Введите ваш ответ..."
                        value={textAnswer}
                        onChange={e => setTextAnswer(e.target.value)}
                    />
                )}
            </div>

            <div className="text-center">
                <button
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors disabled:opacity-50"
                    disabled={
                        submitting ||
                        (currentTask.answer_type === 'multiple_choice' ? selectedOption === null : !textAnswer.trim())
                    }
                    onClick={() => goNext(currentTask.answer_type === 'multiple_choice' ? String(selectedOption) : textAnswer)}
                >
                    {submitting ? 'Отправка...' : currentIndex < diagnostic.tasks.length - 1 ? 'Далее' : 'Завершить'}
                </button>
            </div>
        </div>
    );
};

export default DiagnosticSolver;
