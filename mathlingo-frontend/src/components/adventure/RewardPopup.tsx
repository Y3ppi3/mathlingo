import { useEffect, useState } from 'react';
import Button from '../ui/Button';

interface RewardPopupProps {
    score: number;
    maxScore: number;
    rewardPoints: number;
    onClose: () => void;
}

const RewardPopup = ({ score, maxScore, rewardPoints, onClose }: RewardPopupProps) => {
    const [animateStars, setAnimateStars] = useState(false);

    // FIX: гарантируем корректные значения — score не может быть > maxScore для отображения
    const safeMax    = Math.max(maxScore, score, 1);  // maxScore никогда не меньше score
    const percentage = Math.min(Math.round((score / safeMax) * 100), 100); // cap 100%
    const starCount  = Math.min(Math.ceil((percentage / 100) * 3), 3);     // cap 3 звезды

    const message =
        percentage >= 80 ? 'Отлично! Вы прекрасно справились!'
            : percentage >= 50 ? 'Хорошая работа! Продолжайте практиковаться.'
                :                    'Неплохое начало! Продолжайте изучать материал.';

    useEffect(() => {
        const t = setTimeout(() => setAnimateStars(true), 300);
        return () => clearTimeout(t);
    }, []);

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl transition-colors">

                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">
                    Задание завершено!
                </h2>

                {/* Звёзды */}
                <div className="flex justify-center gap-4 my-6">
                    {[0, 1, 2].map(i => (
                        <div
                            key={i}
                            className="text-4xl transition-all duration-500"
                            style={{
                                transitionDelay: `${i * 200}ms`,
                                transform: animateStars ? 'scale(1)' : 'scale(0)',
                                color: i < starCount ? '#eab308' : '#d1d5db',
                                filter: i < starCount && animateStars ? 'drop-shadow(0 0 6px #eab308)' : 'none',
                            }}
                        >
                            ★
                        </div>
                    ))}
                </div>

                <p className="text-gray-600 dark:text-gray-400 mb-5 text-sm transition-colors">
                    {message}
                </p>

                {/* Счёт */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-4 transition-colors">
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-1 transition-colors">
                        {score} <span className="text-base font-medium text-gray-400 dark:text-gray-500">/ {safeMax} очков</span>
                    </div>

                    {/* Прогресс-бар */}
                    <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mt-2 transition-colors">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000"
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 transition-colors">
                        {percentage}% выполнено
                    </div>
                </div>

                {/* Очки опыта */}
                <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-3 mb-6 transition-colors">
                    <div className="text-sm text-green-700 dark:text-green-400 font-medium transition-colors">
                        🏆 Вы получили <span className="font-bold">{rewardPoints}</span> очков опыта!
                    </div>
                </div>

                <Button onClick={onClose} className="w-full">
                    Вернуться к карте
                </Button>
            </div>
        </div>
    );
};

export default RewardPopup;