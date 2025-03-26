// src/pages/GamePage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Button from '../components/Button';
import DerivFall from '../components/games/DerivFall';
import IntegralBuilder from '../components/games/IntegralBuilder';
import MathLab from '../components/games/MathLab';
import RewardPopup from '../components/adventure/RewardPopup';
import { mockGameData } from '../utils/gameMockData';

const GamePage: React.FC = () => {
    const { subjectId, gameId } = useParams<{ subjectId: string, gameId: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [gameCompleted, setGameCompleted] = useState(false);
    const [score, setScore] = useState(0);
    const [maxScore, setMaxScore] = useState(0);
    const [gameInfo, setGameInfo] = useState<{
        title: string;
        description: string;
        difficulty: number;
        rewardPoints: number;
    } | null>(null);

    useEffect(() => {
        // В реальном приложении здесь был бы запрос к серверу
        // для получения информации об игре
        const loadGameInfo = () => {
            setLoading(true);

            try {
                // Используем заглушки из mockGameData
                if (gameId && gameId in mockGameData) {
                    setGameInfo(mockGameData[gameId as keyof typeof mockGameData]);
                } else {
                    setError('Игра не найдена');
                }
            } catch (err) {
                console.error('Ошибка при загрузке данных об игре:', err);
                setError('Не удалось загрузить данные об игре');
            } finally {
                setLoading(false);
            }
        };

        loadGameInfo();
    }, [gameId]);

    const handleGameComplete = (finalScore: number, finalMaxScore: number) => {
        setScore(finalScore);
        setMaxScore(finalMaxScore);
        setGameCompleted(true);

        // В реальном приложении здесь был бы запрос к серверу для сохранения результатов
        console.log(`Игра завершена. Счет: ${finalScore}/${finalMaxScore}`);
    };

    const handleReturnToMap = () => {
        navigate(`/subject/${subjectId}/map`);
    };

    const renderGame = () => {
        if (!gameId) return null;

        switch (gameId) {
            case 'deriv-fall':
                return (
                    <DerivFall
                        difficulty={gameInfo?.difficulty || 3}
                        timeLimit={120}
                        onComplete={handleGameComplete}
                    />
                );

            case 'integral-builder':
                return (
                    <IntegralBuilder
                        initialDifficulty={gameInfo?.difficulty || 4}
                        timeLimit={300}
                        onComplete={handleGameComplete}
                    />
                );

            case 'math-lab-derivatives':
                return (
                    <MathLab
                        mode="derivatives"
                        difficulty={gameInfo?.difficulty || 3}
                        onComplete={handleGameComplete}
                    />
                );

            case 'math-lab-integrals':
                return (
                    <MathLab
                        mode="integrals"
                        difficulty={gameInfo?.difficulty || 4}
                        onComplete={handleGameComplete}
                    />
                );

            default:
                return (
                    <div className="bg-gray-800 dark:bg-gray-100 p-8 rounded-lg text-center">
                        <p className="text-gray-300 dark:text-gray-700 mb-4">Игра не найдена.</p>
                        <Button onClick={handleReturnToMap}>
                            Вернуться к карте
                        </Button>
                    </div>
                );
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-700 dark:bg-gray-200">
                <Navbar />
                <div className="container mx-auto px-4 py-8 mt-16">
                    <div className="flex justify-center items-center h-96">
                        <div className="text-lg text-gray-300 dark:text-gray-600">Загрузка игры...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-700 dark:bg-gray-200">
                <Navbar />
                <div className="container mx-auto px-4 py-8 mt-16">
                    <div className="bg-gray-800 dark:bg-gray-100 rounded-lg shadow-lg p-6 text-center">
                        <h2 className="text-xl text-red-500 dark:text-red-600 mb-4">{error}</h2>
                        <Button onClick={handleReturnToMap}>
                            Вернуться к карте
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-700 dark:bg-gray-200">
            <Navbar />
            <div className="container mx-auto px-4 py-8 mt-16">
                {!gameCompleted ? (
                    <div className="bg-gray-800 dark:bg-gray-100 rounded-lg shadow-lg overflow-hidden">
                        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-700 dark:border-gray-300">
                            <h1 className="text-2xl font-bold text-gray-100 dark:text-gray-900">
                                {gameInfo?.title}
                            </h1>
                            <Button
                                variant="outline"
                                onClick={handleReturnToMap}
                                className="px-3 py-1 text-sm"
                            >
                                Выйти из игры
                            </Button>
                        </div>

                        <div className="h-[calc(100vh-200px)] max-h-[800px] p-4">
                            {renderGame()}
                        </div>
                    </div>
                ) : (
                    <RewardPopup
                        points={score}
                        totalPoints={maxScore}
                        taskGroupName={gameInfo?.title || 'Игра'}
                        onClose={handleReturnToMap}
                    />
                )}
            </div>
        </div>
    );
};

export default GamePage;