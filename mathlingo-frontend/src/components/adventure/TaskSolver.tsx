// src/components/adventure/TaskSolver.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchTaskGroup, submitTaskAnswer } from '../../utils/api';
import ProgressBar from '../ui/ProgressBar';
import RewardPopup from './RewardPopup';

interface Task {
    id: number;
    title: string;
    content: string;
    options?: string[];
    answer_type: 'multiple_choice' | 'text' | 'math';
    difficulty_level: number;
    reward_points: number;
    estimated_time_seconds?: number;
}

interface TaskGroupData {
    id: number;
    name: string;
    description: string;
    locationName: string;
    subjectId: number;
    tasks: Task[];
    totalPoints: number;
}

const TaskSolver: React.FC = () => {
    const { taskGroupId } = useParams<{ taskGroupId: string }>();
    const navigate = useNavigate();

    const [taskGroup, setTaskGroup] = useState<TaskGroupData | null>(null);
    const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState<string>('');
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [showReward, setShowReward] = useState(false);
    const [earnedPoints, setEarnedPoints] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
    const [timer, setTimer] = useState<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const loadTaskGroup = async () => {
            if (!taskGroupId) return;

            try {
                setLoading(true);
                const data = await fetchTaskGroup(parseInt(taskGroupId));
                setTaskGroup(data);

                // Установить таймер для первой задачи
                if (data.tasks.length > 0) {
                    setTimeRemaining(data.tasks[0].estimated_time_seconds || 60);
                }
            } catch (err) {
                setError('Не удалось загрузить задания. Попробуйте позже.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadTaskGroup();

        // Очистка таймера при размонтировании
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [taskGroupId]);

    useEffect(() => {
        // Сброс состояния при смене задачи
        if (taskGroup && taskGroup.tasks.length > currentTaskIndex) {
            setUserAnswer('');
            setSelectedOption(null);
            setShowFeedback(false);

            // Установить новый таймер
            if (timer) clearInterval(timer);
            const task = taskGroup.tasks[currentTaskIndex];
            setTimeRemaining(task.estimated_time_seconds || 60);

            const newTimer = setInterval(() => {
                setTimeRemaining(prev => {
                    if (prev === null || prev <= 1) {
                        clearInterval(newTimer);
                        // Автоматически отправить ответ при истечении времени
                        handleSubmit();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            setTimer(newTimer);
        }

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [currentTaskIndex, taskGroup]);

    const formatTime = (seconds: number | null): string => {
        if (seconds === null) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleOptionSelect = (index: number) => {
        setSelectedOption(index);
    };

    const handleSubmit = async () => {
        if (!taskGroup) return;

        const currentTask = taskGroup.tasks[currentTaskIndex];
        let answer: string;

        // Получаем ответ в зависимости от типа задания
        if (currentTask.answer_type === 'multiple_choice') {
            if (selectedOption === null) return; // Предотвращаем отправку пустого ответа
            answer = selectedOption.toString();
        } else {
            if (!userAnswer.trim()) return; // Предотвращаем отправку пустого ответа
            answer = userAnswer;
        }

        try {
            const result = await submitTaskAnswer(currentTask.id, answer);
            setIsCorrect(result.isCorrect);

            if (result.isCorrect) {
                setEarnedPoints(prev => prev + currentTask.reward_points);
            }

            setShowFeedback(true);

            // Очищаем таймер
            if (timer) clearInterval(timer);

            // Через 2 секунды убираем обратную связь и переходим к следующей задаче или завершаем
            setTimeout(() => {
                setShowFeedback(false);

                if (currentTaskIndex < taskGroup.tasks.length - 1) {
                    setCurrentTaskIndex(prev => prev + 1);
                } else {
                    // Все задачи выполнены
                    setShowReward(true);
                }
            }, 2000);

        } catch (err) {
            setError('Ошибка при отправке ответа. Попробуйте еще раз.');
            console.error(err);
        }
    };

    const handleFinish = () => {
        if (taskGroup) {
            navigate(`/subject/${taskGroup.subjectId}/map`);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-96">Загрузка заданий...</div>;
    if (error) return <div className="text-red-500 p-4">{error}</div>;
    if (!taskGroup) return <div className="text-center p-4">Задания не найдены.</div>;

    const currentTask = taskGroup.tasks[currentTaskIndex];
    const progress = ((currentTaskIndex) / taskGroup.tasks.length) * 100;

    return (
        <div className="max-w-3xl mx-auto p-4">
            {/* Верхняя панель с информацией */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <div className="text-sm text-gray-500">{taskGroup.locationName}</div>
                    <h2 className="text-xl font-bold">{taskGroup.name}</h2>
                </div>
                <div className="text-right">
                    <div className="flex items-center space-x-2">
                        <span className="text-yellow-500">★</span>
                        <span>{earnedPoints} / {taskGroup.totalPoints} очков</span>
                    </div>
                    <div className={`font-mono text-lg ${
                        timeRemaining !== null && timeRemaining < 10 ? 'text-red-500 animate-pulse' : ''
                    }`}>
                        {formatTime(timeRemaining)}
                    </div>
                </div>
            </div>

            {/* Индикатор прогресса */}
            <div className="mb-6">
                <ProgressBar
                    progress={progress}
                    label={`Задание ${currentTaskIndex + 1} из ${taskGroup.tasks.length}`}
                />
            </div>

            {/* Текущее задание */}
            <div className={`bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg mb-6 transition-all duration-300 ${
                showFeedback ? (isCorrect ? 'ring-4 ring-green-500' : 'ring-4 ring-red-500') : ''
            }`}>
                <h3 className="text-lg font-semibold mb-4">{currentTask.title}</h3>
                <div className="mb-6" dangerouslySetInnerHTML={{ __html: currentTask.content }}></div>

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
                                onClick={() => handleOptionSelect(index)}
                            >
                                <div className="flex items-center">
                                    <div className={`w-6 h-6 flex items-center justify-center rounded-full border ${
                                        selectedOption === index
                                            ? 'border-blue-500 bg-blue-500 text-white'
                                            : 'border-gray-400'
                                    }`}>
                                        {selectedOption === index && '✓'}
                                    </div>
                                    <span className="ml-3" dangerouslySetInnerHTML={{ __html: option }}></span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div>
                        <input
                            type="text"
                            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            placeholder="Введите ваш ответ..."
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                        />
                    </div>
                )}

                {showFeedback && (
                    <div className={`mt-4 p-3 rounded-lg ${
                        isCorrect
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                        {isCorrect ? (
                            <div className="flex items-center">
                                <span className="text-green-600 dark:text-green-400 text-xl mr-2">✓</span>
                                <span>Отлично! +{currentTask.reward_points} очков</span>
                            </div>
                        ) : (
                            <div className="flex items-center">
                                <span className="text-red-600 dark:text-red-400 text-xl mr-2">✗</span>
                                <span>Попробуйте еще раз!</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Кнопка отправки */}
            <div className="text-center">
                <button
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors"
                    onClick={handleSubmit}
                    disabled={showFeedback || (currentTask.answer_type === 'multiple_choice' && selectedOption === null) ||
                        (currentTask.answer_type !== 'multiple_choice' && !userAnswer.trim())}
                >
                    Отправить ответ
                </button>
            </div>

            {/* Награда после выполнения всех заданий */}
            {showReward && (
                <RewardPopup
                    points={earnedPoints}
                    totalPoints={taskGroup.totalPoints}
                    taskGroupName={taskGroup.name}
                    onClose={handleFinish}
                />
            )}
        </div>
    );
};

export default TaskSolver;