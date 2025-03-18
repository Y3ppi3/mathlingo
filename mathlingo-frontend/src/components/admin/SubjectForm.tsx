// src/components/admin/SubjectForm.tsx
import React, { useState, useEffect } from 'react';
import { createSubject, updateSubject, Subject } from '../../utils/adminApi';
import Input from '../Input';
import Button from '../Button';

interface SubjectFormProps {
    subject: Subject | null;
    onSubmit: () => void;
    onCancel: () => void;
}

const SubjectForm: React.FC<SubjectFormProps> = ({ subject, onSubmit, onCancel }) => {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [order, setOrder] = useState('');
    const [icon, setIcon] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (subject) {
            setName(subject.name);
            setCode(subject.code);
            setDescription(subject.description || '');
            setOrder(subject.order?.toString() || '');
            setIcon(subject.icon || '');
            setIsActive(subject.is_active !== false);
        } else {
            // Значения по умолчанию для нового раздела
            setName('');
            setCode('');
            setDescription('');
            setOrder('');
            setIcon('');
            setIsActive(true);
        }
    }, [subject]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const subjectData: Subject = {
                name,
                code,
                description: description || undefined,
                order: order ? parseInt(order) : undefined,
                icon: icon || undefined,
                is_active: isActive
            };

            if (subject && subject.id) {
                await updateSubject(subject.id, subjectData);
            } else {
                await createSubject(subjectData);
            }

            onSubmit();
        } catch (err) {
            console.error('Ошибка при сохранении раздела:', err);
            setError('Не удалось сохранить раздел');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">
                {subject ? 'Редактирование раздела' : 'Создание нового раздела'}
            </h3>

            {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

            <form onSubmit={handleSubmit}>
                <div className="mb-4">
                    <label className="block text-gray-700 dark:text-gray-300 mb-2">Название раздела</label>
                    <Input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="Введите название раздела"
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-gray-700 dark:text-gray-300 mb-2">Код раздела</label>
                    <Input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        required
                        placeholder="Например: algebra, geometry"
                        disabled={!!subject} // Запрещаем изменение кода для существующего раздела
                    />
                    {!!subject && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Код существующего раздела нельзя изменить</p>}
                </div>

                <div className="mb-4">
                    <label className="block text-gray-700 dark:text-gray-300 mb-2">Описание</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        rows={3}
                        placeholder="Введите описание раздела"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 mb-2">Порядок отображения</label>
                        <Input
                            type="number"
                            value={order}
                            onChange={(e) => setOrder(e.target.value)}
                            placeholder="Оставьте пустым для автоматического назначения"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 mb-2">Иконка (CSS-класс или SVG)</label>
                        <Input
                            type="text"
                            value={icon}
                            onChange={(e) => setIcon(e.target.value)}
                            placeholder="Например: fa-calculator или <svg>...</svg>"
                        />
                    </div>
                </div>

                <div className="mb-6">
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-gray-700 dark:text-gray-300">Раздел активен</span>
                    </label>
                </div>

                <div className="flex justify-end space-x-4">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        type="button"
                        disabled={loading}
                    >
                        Отмена
                    </Button>
                    <Button
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? 'Сохранение...' : (subject ? 'Сохранить изменения' : 'Создать раздел')}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default SubjectForm;