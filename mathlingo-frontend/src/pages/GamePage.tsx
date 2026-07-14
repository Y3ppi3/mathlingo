// src/pages/GamePage.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { LogOut, AlertTriangle } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import DerivFall from '../components/games/DerivFall';
import IntegralBuilder from '../components/games/IntegralBuilder';
import LimitsApproach from '../components/games/LimitsApproach';
import RewardPopup from '../components/adventure/RewardPopup';
import { mockGameData } from '../utils/gameMockData';
import {
    fetchActiveGameScenario,
    submitGameAttempt,
    DerivFallGameConfig,
    IntegralBuilderGameConfig,
    MathLabGameConfig,
    mapIntegralBuilderProblems,
    mapLimitsTasks,
} from '../api/studentApi';

// Navbar = p-4 (16px) + h-16 (64px) + p-4 (16px) = 96px
const NAVBAR_HEIGHT = 96;

const GamePage = () => {
    const { subjectId, gameId } = useParams<{ subjectId: string; gameId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const customDifficulty = searchParams.get('difficulty') ? parseInt(searchParams.get('difficulty')!, 10) : undefined;
    const customReward     = searchParams.get('reward')     ? parseInt(searchParams.get('reward')!,     10) : undefined;

    const [loading, setLoading]             = useState(true);
    const [error, setError]                 = useState<string | null>(null);
    const [gameCompleted, setGameCompleted] = useState(false);
    const [score, setScore]                 = useState(0);
    const [maxScore, setMaxScore]           = useState(0);
    const [gameInfo, setGameInfo]           = useState<{
        title: string; description: string; difficulty: number; rewardPoints: number;
    } | null>(null);
    const [derivFallConfig, setDerivFallConfig] = useState<DerivFallGameConfig | null>(null);
    const [integralBuilderConfig, setIntegralBuilderConfig] = useState<IntegralBuilderGameConfig | null>(null);
    const [limitsConfig, setLimitsConfig] = useState<MathLabGameConfig | null>(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    // R3 task 6: сценарий, за который отчитываемся попыткой по завершении
    // сессии — id из fetchActiveGameScenario, а не из URL (gameId — это
    // мнемоника механики, не id сценария).
    const activeScenarioIdRef = useRef<number | null>(null);
    const sessionStartRef = useRef<number | null>(null);

    useEffect(() => {
        const loadGameInfo = async () => {
            setLoading(true);
            activeScenarioIdRef.current = null;
            try {
                if (!gameId || !(gameId in mockGameData)) {
                    setError('Игра не найдена');
                    return;
                }

                const base = mockGameData[gameId as keyof typeof mockGameData];
                setGameInfo({
                    ...base,
                    difficulty:   customDifficulty !== undefined ? customDifficulty : base.difficulty,
                    rewardPoints: customReward     !== undefined ? customReward     : base.rewardPoints,
                });

                if (gameId === 'deriv-fall') {
                    const scenario = await fetchActiveGameScenario<DerivFallGameConfig>('derivfall');
                    setDerivFallConfig(scenario.config);
                    activeScenarioIdRef.current = scenario.id;
                } else if (gameId === 'integral-builder') {
                    const scenario = await fetchActiveGameScenario<IntegralBuilderGameConfig>('integralbuilder');
                    setIntegralBuilderConfig(scenario.config);
                    activeScenarioIdRef.current = scenario.id;
                } else if (gameId === 'limits-approach') {
                    const scenario = await fetchActiveGameScenario<MathLabGameConfig>('mathlab', 'limits');
                    setLimitsConfig(scenario.config);
                    activeScenarioIdRef.current = scenario.id;
                }
                sessionStartRef.current = Date.now();
            } catch (err) {
                if (axios.isAxiosError(err) && err.response?.status === 404) {
                    setError('Игра временно недоступна — сценарий не опубликован');
                } else {
                    setError('Не удалось загрузить данные об игре');
                }
            } finally {
                setLoading(false);
            }
        };
        loadGameInfo();
    }, [gameId, customDifficulty, customReward]);

    const handleGameComplete = (finalScore: number, finalMaxScore: number) => {
        setScore(finalScore);
        setMaxScore(finalMaxScore);
        setGameCompleted(true);

        // Best-effort: попытка — это телеметрия/mastery, не должна блокировать
        // экран награды, если бэкенд недоступен.
        if (activeScenarioIdRef.current !== null) {
            const timeSpentMs = sessionStartRef.current !== null ? Date.now() - sessionStartRef.current : undefined;
            submitGameAttempt(activeScenarioIdRef.current, finalScore, finalMaxScore, timeSpentMs)
                .catch(err => console.error('Не удалось записать попытку игры:', err));
        }
    };

    const handleReturnToMap = () => navigate(`/subject/${subjectId}/map`);
    const handleExitClick   = () => setShowExitConfirm(true);
    const handleCancelExit  = () => setShowExitConfirm(false);

    const renderGame = () => {
        if (!gameId) return null;
        switch (gameId) {
            case 'deriv-fall':
                if (!derivFallConfig) return null;
                return (
                    <DerivFall
                        difficulty={customDifficulty !== undefined ? customDifficulty : derivFallConfig.difficulty}
                        timeLimit={derivFallConfig.time_limit}
                        problemsSource={derivFallConfig.problems}
                        onComplete={handleGameComplete}
                        forcePause={showExitConfirm}
                    />
                );
            case 'integral-builder':
                if (!integralBuilderConfig) return null;
                return (
                    <IntegralBuilder
                        initialDifficulty={customDifficulty !== undefined ? customDifficulty : integralBuilderConfig.initial_difficulty}
                        timeLimit={integralBuilderConfig.time_limit}
                        problemsSource={mapIntegralBuilderProblems(integralBuilderConfig.problems)}
                        onComplete={handleGameComplete}
                    />
                );
            case 'limits-approach':
                if (!limitsConfig) return null;
                return (
                    <LimitsApproach
                        difficulty={customDifficulty !== undefined ? customDifficulty : limitsConfig.difficulty}
                        tasksSource={mapLimitsTasks(limitsConfig.tasks)}
                        onComplete={handleGameComplete}
                    />
                );
            default:
                return (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-8 rounded-xl text-center transition-colors">
                        <p className="text-gray-500 dark:text-gray-400 mb-4">Игра не найдена.</p>
                        <Button onClick={handleReturnToMap}>Вернуться к карте</Button>
                    </div>
                );
        }
    };

    const pageStyle = {
        paddingTop: NAVBAR_HEIGHT,
        height: '100dvh', // dvh учитывает мобильный браузер
    };

    // — Loading —
    if (loading) {
        return (
            <div className="fixed inset-0 bg-white dark:bg-gray-900 overflow-hidden select-none transition-colors flex flex-col" style={pageStyle}>
                <Navbar />
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        Загрузка игры...
                    </div>
                </div>
            </div>
        );
    }

    // — Error —
    if (error) {
        return (
            <div className="fixed inset-0 bg-white dark:bg-gray-900 overflow-hidden select-none transition-colors" style={pageStyle}>
                <Navbar />
                <div className="flex items-center justify-center h-full px-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center transition-colors max-w-sm w-full">
                        <p className="text-red-500 dark:text-red-400 text-lg mb-4">{error}</p>
                        <Button onClick={handleReturnToMap}>Вернуться к карте</Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 bg-white dark:bg-gray-900 overflow-hidden select-none transition-colors flex flex-col"
            style={{ paddingTop: NAVBAR_HEIGHT }}
        >
            <Navbar />

            {/* Контент строго под Navbar — занимает оставшееся место */}
            <div className="flex-1 min-h-0 flex flex-col px-3 py-2 gap-2">
                {!gameCompleted ? (
                    <>
                        {/* Компактная шапка */}
                        <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl transition-colors">
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors">
                                {gameInfo?.title}
                            </span>
                            <button
                                style={{ padding: '0.375rem' }}
                                onClick={handleExitClick}
                                className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-500/30 transition-all"
                                aria-label="Выйти из игры"
                                title="Выйти из игры"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Контейнер игры */}
                        <div className="flex-1 min-h-0 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
                            {renderGame()}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <RewardPopup
                            score={score}
                            maxScore={maxScore || 10}
                            rewardPoints={gameInfo?.rewardPoints || 0}
                            onClose={handleReturnToMap}
                        />
                    </div>
                )}
            </div>

            {/* Диалог подтверждения выхода */}
            {showExitConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] px-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl transition-colors">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-colors">
                                Выйти из игры?
                            </h2>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 transition-colors">
                            Прогресс текущей сессии будет потерян. Вы действительно хотите выйти?
                        </p>
                        <div className="flex gap-3">
                            <button
                                style={{ padding: '0.625rem 1rem' }}
                                onClick={handleCancelExit}
                                className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-white transition-all"
                            >
                                Продолжить игру
                            </button>
                            <button
                                style={{ padding: '0.625rem 1rem' }}
                                onClick={handleReturnToMap}
                                className="flex-1 bg-red-500 hover:bg-red-600 rounded-xl text-sm font-medium text-white transition-all"
                            >
                                Выйти
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GamePage;