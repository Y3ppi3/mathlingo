import React, { useEffect, useState } from 'react';
import Button from '../Button';

interface RewardPopupProps {
    score: number;
    maxScore: number;
    rewardPoints: number;
    onClose: () => void;
}

const RewardPopup: React.FC<RewardPopupProps> = ({
                                                     score,
                                                     maxScore,
                                                     rewardPoints,
                                                     onClose
                                                 }) => {
    const [animateStars, setAnimateStars] = useState(false);

    // Calculate the percentage correctly, avoiding division by zero
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    // Determine how many stars to display based on the percentage
    const starCount = Math.ceil((percentage / 100) * 3);  // 3 stars max

    useEffect(() => {
        // Start star animation after a small delay
        const timer = setTimeout(() => {
            setAnimateStars(true);
        }, 300);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60">
            <div className="bg-gray-800 dark:bg-white rounded-lg p-6 max-w-sm w-full text-center shadow-xl transition-all">
                <h2 className="text-xl font-bold text-white dark:text-gray-900 mb-4">
                    Задание завершено!
                </h2>

                <div className="flex justify-center space-x-4 my-6">
                    {[...Array(3)].map((_, i) => (
                        <div
                            key={i}
                            className={`text-4xl transition-all duration-500 ${
                                i < starCount
                                    ? 'text-yellow-500 ' + (animateStars ? 'scale-125' : 'scale-0')
                                    : 'text-gray-300 ' + (animateStars ? 'scale-100' : 'scale-0')
                            }`}
                            style={{
                                transitionDelay: `${i * 300}ms`,
                            }}
                        >
                            ★
                        </div>
                    ))}
                </div>

                <p className="mb-4 text-gray-300 dark:text-gray-700">
                    {percentage >= 80
                        ? 'Отлично! Вы прекрасно справились с заданием!'
                        : percentage >= 50
                            ? 'Хорошая работа! Продолжайте практиковаться.'
                            : 'Неплохое начало! Продолжайте изучать этот материал!'}
                </p>

                <div className="mb-2 font-medium text-blue-400 dark:text-blue-600">
                    {score} / {maxScore} очков
                </div>

                <div className="text-sm text-gray-400 dark:text-gray-500 mb-6">
                    {percentage}% выполнено
                </div>

                <div className="mb-4 p-3 bg-green-900 dark:bg-green-100 rounded-lg">
                    <div className="text-sm text-green-200 dark:text-green-800">
                        Вы получили <span className="font-bold">{rewardPoints}</span> очков опыта!
                    </div>
                </div>

                <Button
                    onClick={onClose}
                    className="w-full"
                >
                    Вернуться к карте
                </Button>
            </div>
        </div>
    );
};

export default RewardPopup;