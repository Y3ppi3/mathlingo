// src/components/adventure/RewardPopup.tsx
import React, { useState, useEffect } from 'react';

interface RewardPopupProps {
    points: number;
    totalPoints: number;
    taskGroupName: string;
    onClose: () => void;
}

const RewardPopup: React.FC<RewardPopupProps> = ({ points, totalPoints, taskGroupName, onClose }) => {
    const [animateStars, setAnimateStars] = useState(false);

    // Вычисляем процент набранных очков
    const percentage = Math.round((points / totalPoints) * 100);

    // Определяем сообщение в зависимости от результата
    const getMessage = () => {
        if (percentage >= 90) return 'Потрясающе! Вы настоящий гений!';
        if (percentage >= 70) return 'Отличный результат! Вы многому научились!';
        if (percentage >= 50) return 'Хороший результат! Есть куда расти!';
        return 'Неплохое начало! Продолжайте изучать этот материал!';
    };

    // Количество звезд в зависимости от процента
    const getStars = () => {
        if (percentage >= 90) return 3;
        if (percentage >= 70) return 2;
        if (percentage >= 40) return 1;
        return 0;
    };

    useEffect(() => {
        // Запускаем анимацию через небольшую задержку
        const timer = setTimeout(() => {
            setAnimateStars(true);
        }, 300);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 dark:bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 text-center">
                <h2 className="text-2xl font-bold mb-4">Задание завершено!</h2>
                <p className="text-gray-300 dark:text-gray-600 mb-6">{taskGroupName}</p>

                <div className="flex justify-center space-x-4 mb-6">
                    {[...Array(3)].map((_, i) => (
                        <div
                            key={i}
                            className={`transition-all duration-500 ${
                                i < getStars()
                                    ? 'text-yellow-500 transform scale-100' + (animateStars ? ' animate-pulse' : '')
                                    : 'text-gray-300 transform scale-90'
                            }`}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="w-16 h-16"
                            >
                                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                            </svg>
                        </div>
                    ))}
                </div>

                <div className="mb-6">
                    <div className="text-lg font-semibold">{getMessage()}</div>
                    <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {points} / {totalPoints} очков
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {percentage}% выполнено
                    </div>
                </div>

                <div className="mt-6">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors"
                    >
                        Вернуться к карте
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RewardPopup;