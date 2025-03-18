// src/components/admin/TasksPanel.tsx
import React, { useEffect, useState } from 'react';
import { fetchTasks, deleteTask, Task } from '../../utils/adminApi';
import Button from '../Button';
import TaskForm from './TaskForm';

const TasksPanel: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    const loadTasks = async () => {
        try {
            setLoading(true);
            const data = await fetchTasks();
            setTasks(data);
            setError('');
        } catch (err) {
            console.error('Ошибка при загрузке заданий:', err);
            setError('Не удалось загрузить задания');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();
    }, []);

    const handleAddTask = () => {
        setEditingTask(null);
        setShowForm(true);
    };

    const handleEditTask = (task: Task) => {
        setEditingTask(task);
        setShowForm(true);
    };

    const handleDeleteTask = async (id: number) => {
        if (window.confirm('Вы уверены, что хотите удалить это задание?')) {
            try {
                await deleteTask(id);
                setTasks(tasks.filter(task => task.id !== id));
            } catch (err) {
                console.error('Ошибка при удалении задания:', err);
                setError('Не удалось удалить задание');
            }
        }
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingTask(null);
    };

    const handleFormSubmit = () => {
        setShowForm(false);
        setEditingTask(null);
        loadTasks();
    };

    if (loading && tasks.length === 0) {
        return <div className="text-center py-10 text-white dark:text-gray-900 transition-colors">Загрузка...</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white dark:text-gray-900 transition-colors">Управление заданиями</h2>
                <Button onClick={handleAddTask}>Добавить задание</Button>
            </div>

            {error && <div className="bg-red-900/50 dark:bg-red-100 text-red-200 dark:text-red-700 p-3 rounded mb-4 transition-colors">{error}</div>}

            {showForm && (
                <div className="mb-6 bg-gray-700 dark:bg-gray-200 p-4 rounded-lg transition-colors">
                    <TaskForm
                        task={editingTask}
                        onSubmit={handleFormSubmit}
                        onCancel={handleFormClose}
                    />
                </div>
            )}

            <div className="bg-gray-800 dark:bg-gray-100 rounded-lg shadow overflow-hidden transition-colors">
                <table className="min-w-full divide-y divide-gray-700 dark:divide-gray-200 transition-colors">
                    <thead className="bg-gray-700 dark:bg-gray-200 transition-colors">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">Название</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">Предмет</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">Описание</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">Действия</th>
                    </tr>
                    </thead>
                    <tbody className="bg-gray-800 dark:bg-gray-100 divide-y divide-gray-700 dark:divide-gray-200 transition-colors">
                    {tasks.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-4 text-center text-gray-400 dark:text-gray-500 transition-colors">
                                Заданий пока нет. Создайте первое задание!
                            </td>
                        </tr>
                    ) : (
                        tasks.map((task) => (
                            <tr key={task.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-white dark:text-gray-900 transition-colors">{task.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-white dark:text-gray-900 transition-colors">{task.title}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-white dark:text-gray-900 transition-colors">
                                    {task.subject === 'derivatives' && 'Производные'}
                                    {task.subject === 'integrals' && 'Интегралы'}
                                    {task.subject === 'probability' && 'Теория вероятности'}
                                    {!['derivatives', 'integrals', 'probability'].includes(task.subject) && task.subject}
                                </td>
                                <td className="px-6 py-4 text-white dark:text-gray-900 transition-colors">
                                    {task.description ? task.description.substring(0, 50) + (task.description.length > 50 ? '...' : '') : '—'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <button
                                        onClick={() => handleEditTask(task)}
                                        className="text-blue-400 dark:text-blue-600 hover:text-blue-300 dark:hover:text-blue-800 mr-4 transition-colors"
                                    >
                                        Редактировать
                                    </button>
                                    <button
                                        onClick={() => task.id && handleDeleteTask(task.id)}
                                        className="text-red-400 dark:text-red-600 hover:text-red-300 dark:hover:text-red-800 transition-colors"
                                    >
                                        Удалить
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TasksPanel;