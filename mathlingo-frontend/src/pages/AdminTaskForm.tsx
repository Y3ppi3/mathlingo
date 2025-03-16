// src/pages/AdminTaskForm.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button';
import Input from '../components/Input';
import { createTask, fetchTaskById, updateTask } from '../utils/api';

const AdminTaskForm: React.FC = () => {
    const { taskId } = useParams<{ taskId: string }>();
    const isEditing = taskId !== 'new' && taskId !== undefined;

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [subject, setSubject] = useState('');
    const [ownerId, setOwnerId] = useState<string>('');
    const [loading, setLoading] = useState(isEditing);
    const [error, setError] = useState('');

    const navigate = useNavigate();

    useEffect(() => {
        const adminToken = localStorage.getItem('adminToken');
        if (!adminToken) {
            navigate('/admin/login');
            return;
        }

        if (isEditing) {
            const loadTask = async () => {
                try {
                    const task = await fetchTaskById(parseInt(taskId as string));
                    setTitle(task.title);
                    setDescription(task.description || '');
                    setSubject(task.subject);
                    setOwnerId(task.owner_id ? task.owner_id.toString() : '');
                    setLoading(false);
                } catch (err) {
                    console.error("Ошибка при загрузке задания:", err);
                    setError('Ошибка при загрузке задания');
                    setLoading(false);
                }
            };

            loadTask();
        }
    }, [isEditing, taskId, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const taskData = {
                title,
                description: description || undefined,
                subject,
                owner_id: ownerId ? parseInt(ownerId) : undefined
            };

            if (isEditing) {
                await updateTask(parseInt(taskId as string), taskData);
            } else {
                await createTask(taskData);
            }

            navigate('/admin/dashboard');
        } catch (err) {
            console.error("Ошибка при сохранении задания:", err);
            setError('Ошибка при сохранении задания');
        }
    };

    if (loading) {
        return <div className="text-center py-10">Загрузка...</div>;
    }

    return (
        <div className="container mx-auto p-4">
            <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow">
                <h1 className="text-2xl font-bold mb-6">
                    {isEditing ? 'Редактирование задания' : 'Создание нового задания'}
                </h1>

                {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2">Название задания</label>
                        <Input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            placeholder="Введите название задания"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2">Предмет</label>
                        <select
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            required
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Выберите предмет</option>
                            <option value="derivatives">Производные</option>
                            <option value="integrals">Интегралы</option>
                            <option value="probability">Теория вероятности</option>
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2">Описание</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={5}
                            placeholder="Введите описание задания"
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-gray-700 mb-2">ID пользователя (необязательно)</label>
                        <Input
                            type="number"
                            value={ownerId}
                            onChange={(e) => setOwnerId(e.target.value)}
                            placeholder="Оставьте пустым для общего задания"
                        />
                    </div>

                    <div className="flex justify-end space-x-4">
                        <Button
                            variant="outline"
                            onClick={() => navigate('/admin/dashboard')}
                            type="button"
                        >
                            Отмена
                        </Button>
                        <Button type="submit">
                            {isEditing ? 'Сохранить изменения' : 'Создать задание'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminTaskForm;