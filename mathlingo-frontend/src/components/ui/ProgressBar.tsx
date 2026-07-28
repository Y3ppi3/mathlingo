// src/components/ui/ProgressBar.tsx
// Прогресс-бар в духе Duolingo: скруглённый, с внутренним «бликом» сверху,
// плавным заполнением и выбором цвета под смысл (прогресс/успех/награда).
import React from 'react';

type Tone = 'brand' | 'success' | 'sky' | 'bee';

interface ProgressBarProps {
    progress: number;
    label?: string;
    tone?: Tone;
    className?: string;
}

const FILL: Record<Tone, string> = {
    brand: 'bg-gradient-to-r from-indigo-500 to-violet-500',
    success: 'bg-feather',
    sky: 'bg-macaw',
    bee: 'bg-bee',
};

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, label, tone = 'brand', className = '' }) => {
    const safeProgress = Math.min(Math.max(progress, 0), 100);

    return (
        <div className={`w-full ${className}`}>
            {label && (
                <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{label}</span>
                    <span className="text-sm font-bold text-gray-400 dark:text-gray-500">{Math.round(safeProgress)}%</span>
                </div>
            )}
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={`relative h-full rounded-full ${FILL[tone]} transition-[width] duration-500 ease-out`}
                    style={{ width: `${safeProgress}%` }}
                >
                    {/* Внутренний блик — узкая светлая полоса у верхней кромки. */}
                    {safeProgress > 6 && (
                        <span className="absolute left-2 right-2 top-1 h-1 rounded-full bg-white/40" />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProgressBar;
