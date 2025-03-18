// src/components/admin/UsersPanel.tsx
import React, { useEffect, useState } from 'react';
import { fetchUsers, User, deleteUser, updateUserStatus } from '../../utils/adminApi';

const UsersPanel: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadUsers = async () => {
        try {
            setLoading(true);
            const data = await fetchUsers();
            setUsers(data);
            setError('');
        } catch (err) {
            console.error('Ошибка при загрузке пользователей:', err);
            setError('Не удалось загрузить пользователей');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleUserStatusToggle = async (userId: number, currentStatus: boolean) => {
        try {
            await updateUserStatus(userId, !currentStatus);
            // Обновляем список пользователей
            loadUsers();
        } catch (err: any) {
            console.error('Ошибка при обновлении статуса пользователя:', err);

            const errorMessage = err.response?.data?.detail
                || err.message
                || 'Не удалось изменить статус пользователя';

            alert(errorMessage);
        }
    };

    const handleUserDelete = async (userId: number) => {
        const confirmDelete = window.confirm('Вы уверены, что хотите удалить этого пользователя? Это действие нельзя отменить.');

        if (confirmDelete) {
            try {
                await deleteUser(userId);
                // Обновляем список пользователей
                loadUsers();
            } catch (err) {
                console.error('Ошибка при удалении пользователя:', err);
                setError('Не удалось удалить пользователя');
            }
        }
    };

    if (loading) {
        return <div className="text-center py-10 text-white dark:text-gray-900 transition-colors">Загрузка...</div>;
    }

    if (error) {
        return <div className="bg-red-900/50 dark:bg-red-100 text-red-200 dark:text-red-700 p-3 rounded transition-colors">{error}</div>;
    }

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4 text-white dark:text-gray-900 transition-colors">
                Пользователи системы
            </h2>

            <div className="bg-gray-800 dark:bg-gray-100 rounded-lg shadow overflow-hidden transition-colors">
                <table className="min-w-full divide-y divide-gray-700 dark:divide-gray-200 transition-colors">
                    <thead className="bg-gray-700 dark:bg-gray-200 transition-colors">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">Имя пользователя</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">Статус</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">Дата регистрации</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">Действия</th>
                    </tr>
                    </thead>
                    <tbody className="bg-gray-800 dark:bg-gray-100 divide-y divide-gray-700 dark:divide-gray-200 transition-colors">
                    {users.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-6 py-4 text-center text-gray-400 dark:text-gray-500 transition-colors">
                                Пользователей пока нет.
                            </td>
                        </tr>
                    ) : (
                        users.map((user) => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-white dark:text-gray-900 transition-colors">{user.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-white dark:text-gray-900 transition-colors">{user.username}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-white dark:text-gray-900 transition-colors">{user.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            user.is_active
                                                ? 'bg-green-900 text-green-200 dark:bg-green-100 dark:text-green-800'
                                                : 'bg-red-900 text-red-200 dark:bg-red-100 dark:text-red-800'
                                        } transition-colors`}>
                                            {user.is_active ? 'Активен' : 'Неактивен'}
                                        </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-white dark:text-gray-900 transition-colors">
                                    {new Date(user.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                    <button
                                        onClick={() => handleUserStatusToggle(user.id, user.is_active)}
                                        className={`
                                                px-2 py-1 rounded 
                                                ${user.is_active
                                            ? 'bg-red-600 hover:bg-red-700 text-white'
                                            : 'bg-green-600 hover:bg-green-700 text-white'}
                                                transition-colors
                                            `}
                                    >
                                        {user.is_active ? 'Деактивировать' : 'Активировать'}
                                    </button>
                                    <button
                                        onClick={() => handleUserDelete(user.id)}
                                        className="
                                                px-2 py-1 rounded
                                                bg-red-600 hover:bg-red-700
                                                text-white
                                                transition-colors
                                            "
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

export default UsersPanel;