// src/components/admin/SubjectForm.tsx
import { useState, useEffect } from 'react';
import { createSubject, updateSubject, Subject } from '../../api/adminApi';

interface SubjectFormProps {
    subject: Subject | null;
    onSubmit: () => void;
    onCancel: () => void;
}

const inputCls = "w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors";

const SubjectForm = ({ subject, onSubmit, onCancel }: SubjectFormProps) => {
    const [name, setName]               = useState('');
    const [code, setCode]               = useState('');
    const [description, setDescription] = useState('');
    const [order, setOrder]             = useState('');
    const [icon, setIcon]               = useState('');
    const [isActive, setIsActive]       = useState(true);
    const [error, setError]             = useState('');
    const [loading, setLoading]         = useState(false);

    useEffect(() => {
        if (subject) {
            setName(subject.name);
            setCode(subject.code);
            setDescription(subject.description || '');
            setOrder(subject.order?.toString() || '');
            setIcon(subject.icon || '');
            setIsActive(subject.is_active !== false);
        } else {
            setName(''); setCode(''); setDescription('');
            setOrder(''); setIcon(''); setIsActive(true);
        }
    }, [subject]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data: Subject = {
                name, code,
                description: description || undefined,
                order:       order ? parseInt(order) : undefined,
                icon:        icon || undefined,
                is_active:   isActive,
            };
            if (subject?.id) await updateSubject(subject.id, data);
            else              await createSubject(data);
            onSubmit();
        } catch {
            setError('Не удалось сохранить раздел');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-5 transition-colors">
                {subject ? 'Редактирование раздела' : 'Создание нового раздела'}
            </h3>

            {/* Ошибка */}
            {error && (
                <div className="mb-5 flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl transition-colors">
                    <svg className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

                {/* Название */}
                <div>
                    <label className={labelCls}>Название раздела</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        placeholder="Введите название раздела"
                        className={inputCls}
                    />
                </div>

                {/* Код */}
                <div>
                    <label className={labelCls}>Код раздела</label>
                    <input
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        required
                        placeholder="Например: algebra, geometry"
                        disabled={!!subject}
                        className={`${inputCls} ${subject ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    {!!subject && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 transition-colors">
                            Код существующего раздела нельзя изменить
                        </p>
                    )}
                </div>

                {/* Описание */}
                <div>
                    <label className={labelCls}>Описание</label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={3}
                        placeholder="Введите описание раздела"
                        className={inputCls}
                        style={{ resize: 'vertical' }}
                    />
                </div>

                {/* Порядок + Иконка */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Порядок отображения</label>
                        <input
                            type="number"
                            value={order}
                            onChange={e => setOrder(e.target.value)}
                            placeholder="Авто"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Иконка</label>
                        <input
                            type="text"
                            value={icon}
                            onChange={e => setIcon(e.target.value)}
                            placeholder="CSS-класс или SVG"
                            className={inputCls}
                        />
                    </div>
                </div>

                {/* Активен */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div className="relative">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={e => setIsActive(e.target.checked)}
                            className="sr-only"
                        />
                        <div className={`w-10 h-5 rounded-full transition-colors ${isActive ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors">
                        Раздел активен
                    </span>
                </label>

                {/* Кнопки */}
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        disabled={loading}
                        style={{ padding: '0.625rem 1.25rem' }}
                        onClick={onCancel}
                        className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{ padding: '0.625rem 1.25rem' }}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                    >
                        {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {loading ? 'Сохранение...' : subject ? 'Сохранить изменения' : 'Создать раздел'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SubjectForm;