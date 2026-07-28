// src/pages/TutorMaterialPage.tsx
// Платформа репетиторов, Фаза 4 — просмотр материала/задачи репетитора.
// Открывается по ссылке из назначенного задания (kind=material) и как превью
// у самого репетитора. Доступ проверяет бэкенд (автор или активный ученик).
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Paperclip, BookOpen, PenLine, Eye } from 'lucide-react';
import { getContent, TutorContentItem } from '../api/tutorsApi';

const TutorMaterialPage = () => {
    const { id } = useParams<{ id: string }>();
    const [item, setItem] = useState<TutorContentItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAnswer, setShowAnswer] = useState(false);

    useEffect(() => {
        if (!id) return;
        getContent(Number(id))
            .then(setItem)
            .catch(() => setError('Материал недоступен. Возможно, у вас нет к нему доступа.'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <div className="max-w-2xl mx-auto px-4 py-10 mt-16 flex justify-center">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        </div>
    );

    if (error || !item) return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <div className="max-w-2xl mx-auto px-4 py-10 mt-16">
                <Link to="/tutors" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> К репетиторам
                </Link>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center text-gray-500 dark:text-gray-400 transition-colors">
                    {error || 'Нет данных'}
                </div>
            </div>
        </div>
    );

    const isTask = item.kind === 'task';

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <div className="max-w-2xl mx-auto px-4 py-10 mt-16">
                <Link to="/tutors" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> К репетиторам
                </Link>

                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 sm:p-8 transition-colors">
                    <div className="flex items-center gap-2 mb-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${
                            isTask ? 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300'
                                : 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                        }`}>
                            {isTask ? <PenLine className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                            {isTask ? 'Задача' : 'Материал'}
                        </span>
                        {item.tutor_username && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">от {item.tutor_username}</span>
                        )}
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{item.title}</h1>

                    {item.body && (
                        <div className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed mb-6">
                            {item.body}
                        </div>
                    )}

                    {item.attachment_url && (
                        <a
                            href={item.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors mb-6"
                        >
                            <Paperclip className="w-4 h-4" /> Открыть файл
                        </a>
                    )}

                    {isTask && item.answer && (
                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                            {showAnswer ? (
                                <div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Ответ</div>
                                    <div className="text-gray-900 dark:text-white font-medium whitespace-pre-wrap">{item.answer}</div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowAnswer(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                                >
                                    <Eye className="w-4 h-4" /> Показать ответ
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TutorMaterialPage;
