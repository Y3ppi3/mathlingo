// src/components/adventure/LevelPicker.tsx
import { useEffect, useState } from 'react';
import { fetchSkillLevel, setSkillLevelOverride, clearSkillLevelOverride, SkillLevel, SkillLevelValue } from '../../api/studentApi';

const LEVELS_ORDER: SkillLevelValue[] = ['basic', 'standard', 'advanced'];
const LEVEL_LABELS: Record<SkillLevelValue, string> = {
    basic: 'Базовый',
    standard: 'Стандартный',
    advanced: 'Продвинутый',
};

const isAdjacent = (a: SkillLevelValue, b: SkillLevelValue) =>
    Math.abs(LEVELS_ORDER.indexOf(a) - LEVELS_ORDER.indexOf(b)) === 1;

interface LevelPickerProps {
    skillId: number;
}

// R2 task 4: показывает рекомендованный уровень с "причиной" (факторы из
// mastery.factors) и даёт временно выбрать СОСЕДНИЙ уровень — сервер сам
// отклонит не-соседний (см. app/services/mastery.py is_adjacent_level).
const LevelPicker = ({ skillId }: LevelPickerProps) => {
    const [level, setLevel] = useState<SkillLevel | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const load = () => {
        fetchSkillLevel(skillId)
            .then(setLevel)
            .catch(() => setError('Не удалось загрузить уровень'))
            .finally(() => setLoading(false));
    };

    useEffect(load, [skillId]);

    const handleChoose = async (chosen: SkillLevelValue) => {
        setBusy(true);
        setError('');
        try {
            const updated = await setSkillLevelOverride(skillId, chosen);
            setLevel(updated);
        } catch {
            setError('Не удалось выбрать этот уровень');
        } finally {
            setBusy(false);
        }
    };

    const handleClear = async () => {
        setBusy(true);
        setError('');
        try {
            const updated = await clearSkillLevelOverride(skillId);
            setLevel(updated);
        } catch {
            setError('Не удалось сбросить выбор');
        } finally {
            setBusy(false);
        }
    };

    if (loading) return null;
    if (!level || !level.computed_level) {
        return <p className="text-sm text-gray-400 dark:text-gray-500">Пока нет данных по этой теме.</p>;
    }

    const adjacentLevels = LEVELS_ORDER.filter(l => isAdjacent(l, level.computed_level!));

    return (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
            <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Рекомендованный уровень</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {LEVEL_LABELS[level.computed_level]}
                    {level.confidence < 50 && (
                        <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">
                            низкая уверенность ({level.sample_size} {level.sample_size === 1 ? 'попытка' : 'попыток'})
                        </span>
                    )}
                </div>
                {level.factors && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        точность {(level.factors.accuracy * 100).toFixed(0)}%
                        {level.factors.avg_time_ratio != null && (
                            <> · время {(level.factors.avg_time_ratio * 100).toFixed(0)}% от расчётного</>
                        )}
                        {' '}· подсказки {(level.factors.hints_rate * 100).toFixed(0)}%
                    </p>
                )}
            </div>

            {level.override ? (
                <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                    <span className="text-sm text-indigo-700 dark:text-indigo-300">
                        Временно выбран: {LEVEL_LABELS[level.override.chosen_level]}
                        {' '}(до {new Date(level.override.expires_at).toLocaleDateString('ru-RU')})
                    </span>
                    <button
                        onClick={handleClear}
                        disabled={busy}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:underline disabled:opacity-50"
                    >
                        Сбросить
                    </button>
                </div>
            ) : (
                adjacentLevels.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Попробовать другой уровень:</span>
                        {adjacentLevels.map(l => (
                            <button
                                key={l}
                                onClick={() => handleChoose(l)}
                                disabled={busy}
                                className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
                            >
                                {LEVEL_LABELS[l]}
                            </button>
                        ))}
                    </div>
                )
            )}

            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        </div>
    );
};

export default LevelPicker;
