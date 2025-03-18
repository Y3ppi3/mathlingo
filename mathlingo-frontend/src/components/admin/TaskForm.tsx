// src/components/admin/TaskForm.tsx
import React, { useState, useEffect } from 'react';
import { createTask, updateTask, Task, fetchUsers, User } from '../../utils/adminApi';
import Input from '../Input';
import Button from '../Button';

interface TaskFormProps {
    task: Task | null;
    onSubmit: () => void;
    onCancel: () => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ task, onSubmit, onCancel }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [subject, setSubject] = useState('');
    const [ownerId, setOwnerId] = useState<string>('');
    const [users, setUsers] = useState<User[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Загрузка списка пользователей для выбора
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const data = await fetchUsers();
                setUsers(data);

                // Если пользователи есть, и не задан owner_id, устанавливаем первого пользователя по умолчанию
                if (data.length > 0 && !ownerId) {
                    setOwnerId(data[0].id.toString());
                }
            } catch (err) {
                console.error('Ошибка при загрузке пользователей:', err);
            }
        };

        loadUsers();
    }, []);

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setDescription(task.description || '');
            setSubject(task.subject);
            setOwnerId(task.owner_id ? task.owner_id.toString() : '');
        }
    }, [task]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Проверка наличия owner_id
        if (!ownerId) {
            setError('Необходимо выбрать владельца задания');
            return;
        }

        setLoading(true);

        try {
            const taskData: Task = {
                title,
                description: description || undefined,
                subject,
                owner_id: parseInt(ownerId)
            };

            if (task && task.id) {
                await updateTask(task.id, taskData);
            } else {
                await createTask(taskData);
            }

            onSubmit();
        } catch (err) {
            console.error('Ошибка при сохранении задания:', err);
            setError('Не удалось сохранить задание');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="text-white dark:text-gray-900 transition-colors">
            <h3 className="text-lg font-medium mb-4">
                {task ? 'Редактирование задания' : 'Создание нового задания'}
            </h3>

            {error && <div className="bg-red-900/50 dark:bg-red-100 text-red-200 dark:text-red-700 p-3 rounded mb-4 transition-colors">{error}</div>}

            <form onSubmit={handleSubmit}>
                <div className="mb-4">
                    <label className="block text-gray-300 dark:text-gray-700 mb-2 transition-colors">Название задания</label>
                    <Input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        placeholder="Введите название задания"
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-gray-300 dark:text-gray-700 mb-2 transition-colors">Предмет</label>
                    <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        required
                        className="w-full p-2 border rounded bg-gray-700 border-gray-600 text-white dark:bg-gray-200 dark:border-gray-300 dark:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    >
                        <option value="">Выберите предмет</option>
                        <option value="derivatives">Производные</option>
                        <option value="integrals">Интегралы</option>
                        <option value="probability">Теория вероятности</option>
                    </select>
                </div>

                <div className="mb-4">
                    <label className="block text-gray-300 dark:text-gray-700 mb-2 transition-colors">Описание</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-2 border rounded bg-gray-700 border-gray-600 text-white dark:bg-gray-200 dark:border-gray-300 dark:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        rows={5}
                        placeholder="Введите описание задания"
                    />
                </div>

                <div className="mb-6">
                    <label className="block text-gray-300 dark:text-gray-700 mb-2 transition-colors">Владелец задания <span className="text-red-500">*</span></label>
                    <select
                        value={ownerId}
                        onChange={(e) => setOwnerId(e.target.value)}
                        required
                        className="w-full p-2 border rounded bg-gray-700 border-gray-600 text-white dark:bg-gray-200 dark:border-gray-300 dark:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    >
                        <option value="">Выберите пользователя</option>
                        {users.map(user => (
                            <option key={user.id} value={user.id}>
                                {user.username} ({user.email})
                            </option>
                        ))}
                    </select>
                    <p className="mt-1 text-sm text-gray-400 dark:text-gray-500 transition-colors">Это поле обязательно для заполнения</p>
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
                        {loading ? 'Сохранение...' : (task ? 'Сохранить изменения' : 'Создать задание')}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default TaskForm;