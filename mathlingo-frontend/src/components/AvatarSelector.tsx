// src/components/AvatarSelector.tsx
import React, { useState } from 'react';

interface AvatarSelectorProps {
    selectedAvatar: number | undefined; // Изменено с number | null
    onSelect: (avatarId: number) => void;
}

const AvatarSelector: React.FC<AvatarSelectorProps> = ({ selectedAvatar, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Общее количество доступных аватарок
    const TOTAL_AVATARS = 18;

    // Формирование URL аватарки по её номеру
    const getAvatarUrl = (avatarId: number) => `/avatars/${avatarId}.png`;

    // Обработчик выбора аватарки
    const handleAvatarSelect = (avatarId: number) => {
        onSelect(avatarId);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            {/* Выбранная аватарка с кнопкой изменения */}
            <div className="flex items-center space-x-4 mb-3">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-indigo-500 flex items-center justify-center bg-gray-700 dark:bg-gray-200">
                    {selectedAvatar ? (
                        <img
                            src={getAvatarUrl(selectedAvatar)}
                            alt="Выбранная аватарка"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <span className="text-gray-500 dark:text-gray-400">Нет</span>
                    )}
                </div>
                <button
                    type="button"
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {selectedAvatar ? 'Изменить аватарку' : 'Выбрать аватарку'}
                </button>
            </div>

            {/* Модальное окно с выбором аватарок */}
            {isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 dark:bg-white rounded-lg p-6 max-w-xl w-full max-h-[80vh] overflow-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-white dark:text-gray-900">
                                Выберите аватарку
                            </h3>
                            <button
                                type="button"
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                onClick={() => setIsOpen(false)}
                            >
                                &times;
                            </button>
                        </div>

                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
                            {Array.from({ length: TOTAL_AVATARS }, (_, i) => i + 1).map((avatarId) => (
                                <div
                                    key={avatarId}
                                    className={`
                                        w-16 h-16 rounded-full overflow-hidden cursor-pointer
                                        transition-all transform hover:scale-110
                                        ${selectedAvatar === avatarId ? 'ring-4 ring-indigo-500' : 'hover:ring-2 hover:ring-indigo-300'}
                                    `}
                                    onClick={() => handleAvatarSelect(avatarId)}
                                >
                                    <img
                                        src={getAvatarUrl(avatarId)}
                                        alt={`Аватарка ${avatarId}`}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AvatarSelector;