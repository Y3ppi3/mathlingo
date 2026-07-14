// src/components/AvatarSelector.tsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface AvatarSelectorProps {
    selectedAvatar: number | undefined;
    onSelect: (avatarId: number) => void;
}

const AvatarSelector = ({ selectedAvatar, onSelect }: AvatarSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);

    const TOTAL_AVATARS = 18;
    const getAvatarUrl = (avatarId: number) => `/avatars/${avatarId}.png`;

    const handleAvatarSelect = (avatarId: number) => {
        onSelect(avatarId);
        setIsOpen(false);
    };

    // Модалка рендерится через Portal прямо в document.body —
    // полностью выходит за пределы любых stacking context'ов (backdrop-blur, transform и т.д.)
    const modal = isOpen
        ? createPortal(
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] px-4">
                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-xl max-h-[80vh] overflow-auto shadow-2xl transition-colors">
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors">
                            Выберите аватарку
                        </h3>
                        <button
                            type="button"
                            style={{ padding: '0.25rem' }}
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
                        {Array.from({ length: TOTAL_AVATARS }, (_, i) => i + 1).map((avatarId) => (
                            <div
                                key={avatarId}
                                className={`w-16 h-16 rounded-full overflow-hidden cursor-pointer transition-all hover:scale-110 ${
                                    selectedAvatar === avatarId
                                        ? 'ring-4 ring-indigo-500'
                                        : 'hover:ring-2 hover:ring-indigo-300'
                                }`}
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
            </div>,
            document.body
        )
        : null;

    return (
        <div className="relative">
            {/* Превью + кнопка */}
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-indigo-500 flex items-center justify-center bg-gray-100 dark:bg-slate-700 flex-shrink-0 transition-colors">
                    {selectedAvatar ? (
                        <img
                            src={getAvatarUrl(selectedAvatar)}
                            alt="Выбранная аватарка"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <span className="text-xs text-gray-400 dark:text-slate-500 transition-colors">
                            Нет
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    style={{ padding: '0.5rem 1rem' }}
                    className="bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-medium transition-all"
                    onClick={() => setIsOpen(true)}
                >
                    {selectedAvatar ? 'Изменить аватарку' : 'Выбрать аватарку'}
                </button>
            </div>

            {/* Portal-модалка — монтируется в document.body */}
            {modal}
        </div>
    );
};

export default AvatarSelector;