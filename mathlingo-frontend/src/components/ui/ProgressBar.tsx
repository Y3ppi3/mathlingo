// src/components/ui/ProgressBar.tsx
import React from 'react';

interface ProgressBarProps {
    progress: number;
    label?: string;
    className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, label, className = '' }) => {
    // Ограничиваем прогресс от 0 до 100
    const safeProgress = Math.min(Math.max(progress, 0), 100);

    return (
        <div className={`w-full ${className}`}>
            {label && (
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{Math.round(safeProgress)}%</span>
                </div>
            )}
            <div className="h-2.5 w-full bg-gray-200 rounded-full dark:bg-gray-700">
                <div
                    className="h-2.5 rounded-full bg-blue-600 transition-all duration-300 ease-in-out"
                    style={{ width: `${safeProgress}%` }}
                ></div>
            </div>
        </div>
    );
};

export default ProgressBar;