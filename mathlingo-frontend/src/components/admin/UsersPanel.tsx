// src/components/admin/UsersPanel.tsx
import React, { useEffect, useState } from 'react';
import { fetchUsers, User } from '../../utils/adminApi';

const UsersPanel: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadUsers = async () => {
            try {
                setLoading(true);
                const data = await fetchUsers();
                setUsers(data);
            } catch (err) {
                console.error('Ошибка при загрузке пользователей:', err);
                setError('Не удалось загрузить пользователей');
            } finally {
                setLoading(false);
            }
        };

        loadUsers();
    }, []);

    if (loading) {
        return <div className="text-center py-10 text-white dark:text-gray-900 transition-colors">Загрузка...</div>;
    }

    if (error) {
        return <div className="bg-red-900/50 dark:bg-red-100 text-red-200 dark:text-red-700 p-3 rounded transition-colors">{error}</div>;
    }

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4 text-white dark:text-gray-900 transition-colors">Пользователи системы</h2>

            <div className="bg-gray-800 dark:bg-gray-100 rounded-lg shadow overflow-hidden transition-colors">
                <table className="min-w-full divide-y divide-gray-700 dark:divide-gray-200 transition-colors">
                    <thead className="bg-gray-700 dark:bg-gray-200 transition-colors">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">Имя пользователя</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">Статус</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-700 uppercase tracking-wider transition-colors">Дата регистрации</th>
                    </tr>
                    </thead>
                    <tbody className="bg-gray-800 dark:bg-gray-100 divide-y divide-gray-700 dark:divide-gray-200 transition-colors">
                    {users.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-4 text-center text-gray-400 dark:text-gray-500 transition-colors">
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
                                        user.is_active ? 'bg-green-900 text-green-200 dark:bg-green-100 dark:text-green-800' : 'bg-red-900 text-red-200 dark:bg-red-100 dark:text-red-800'
                                    } transition-colors`}>
                                        {user.is_active ? 'Активен' : 'Неактивен'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-white dark:text-gray-900 transition-colors">
                                    {new Date(user.created_at).toLocaleDateString()}
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