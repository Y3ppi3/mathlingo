// src/components/admin/UsersPanel.tsx
import { useEffect, useState } from 'react';
import { fetchUsers, User, deleteUser, updateUserStatus, bulkUpdateUserStatus } from '../../utils/adminApi';
import { adminHasRole } from '../../utils/auth';

const UsersPanel = () => {
    const [users, setUsers]   = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState('');
    const [selected, setSelected] = useState<Set<number>>(new Set());

    // Управление учётками (статус/удаление) — только superadmin, см.
    // app/routes/admin.py (update_user_status/delete_user требуют
    // require_role("superadmin")). teacher/content_manager видят список
    // на чтение — это их зона "учащиеся и прогресс", не управление доступом.
    const canManageAccounts = adminHasRole('superadmin');

    const loadUsers = async () => {
        try {
            setLoading(true);
            setUsers(await fetchUsers());
            setError('');
        } catch {
            setError('Не удалось загрузить пользователей');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadUsers(); }, []);

    const handleToggleStatus = async (userId: number, current: boolean) => {
        try {
            await updateUserStatus(userId, !current);
            loadUsers();
        } catch (err: any) {
            setError(err.response?.data?.detail || err.message || 'Не удалось изменить статус пользователя');
        }
    };

    const handleDelete = async (userId: number) => {
        if (!confirm('Удалить этого пользователя? Это действие нельзя отменить.')) return;
        try {
            await deleteUser(userId);
            loadUsers();
        } catch {
            setError('Не удалось удалить пользователя');
        }
    };

    const toggleSelected = (userId: number) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const handleBulkStatus = async (isActive: boolean) => {
        try {
            await bulkUpdateUserStatus(Array.from(selected), isActive);
            setSelected(new Set());
            loadUsers();
        } catch {
            setError('Не удалось массово изменить статус');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Загрузка пользователей...
            </div>
        </div>
    );

    return (
        <div className="p-6 space-y-5">

            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors">
                    Пользователи
                    {users.length > 0 && (
                        <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">{users.length}</span>
                    )}
                </h2>
                <button
                    style={{ padding: '0.375rem 0.75rem' }}
                    onClick={loadUsers}
                    className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Обновить
                </button>
            </div>

            {/* Ошибка */}
            {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl transition-colors">
                    <svg className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                </div>
            )}

            {/* Массовые действия */}
            {canManageAccounts && selected.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl">
                    <span className="text-sm text-indigo-700 dark:text-indigo-300">Выбрано: {selected.size}</span>
                    <button onClick={() => handleBulkStatus(true)} className="text-xs font-medium text-green-700 dark:text-green-400 hover:underline">Активировать</button>
                    <button onClick={() => handleBulkStatus(false)} className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline">Деактивировать</button>
                    <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-400 hover:underline">Снять выделение</button>
                </div>
            )}

            {/* Таблица */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 transition-colors">
                    <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 transition-colors">
                        {canManageAccounts && <th className="px-5 py-3 w-8"></th>}
                        {['ID', 'Пользователь', 'Email', 'Статус', 'Дата регистрации', 'Действия'].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors">
                                {h}
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800 transition-colors">
                    {users.length === 0 ? (
                        <tr>
                            <td colSpan={canManageAccounts ? 7 : 6} className="px-5 py-12 text-center text-sm text-gray-400 dark:text-gray-500 transition-colors">
                                Пользователей пока нет.
                            </td>
                        </tr>
                    ) : (
                        users.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                {canManageAccounts && (
                                    <td className="px-5 py-3.5">
                                        <input
                                            type="checkbox"
                                            checked={selected.has(user.id)}
                                            onChange={() => toggleSelected(user.id)}
                                        />
                                    </td>
                                )}
                                <td className="px-5 py-3.5 text-sm text-gray-400 dark:text-gray-500 transition-colors">
                                    {user.id}
                                </td>
                                <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                                    {user.username.charAt(0).toUpperCase()}
                                                </span>
                                        </div>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white transition-colors">
                                                {user.username}
                                            </span>
                                    </div>
                                </td>
                                <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400 transition-colors">
                                    {user.email}
                                </td>
                                <td className="px-5 py-3.5">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                            user.is_active
                                                ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${user.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                                            {user.is_active ? 'Активен' : 'Неактивен'}
                                        </span>
                                </td>
                                <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400 transition-colors">
                                    {new Date(user.created_at).toLocaleDateString('ru-RU')}
                                </td>
                                <td className="px-5 py-3.5">
                                    {canManageAccounts ? (
                                        <div className="flex items-center gap-2">
                                            <button
                                                style={{ padding: '0.25rem 0.625rem' }}
                                                onClick={() => handleToggleStatus(user.id, user.is_active)}
                                                className={`rounded-lg text-xs font-medium transition-all ${
                                                    user.is_active
                                                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/20'
                                                        : 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30 hover:bg-green-100 dark:hover:bg-green-500/20'
                                                }`}
                                            >
                                                {user.is_active ? 'Деактивировать' : 'Активировать'}
                                            </button>
                                            <button
                                                style={{ padding: '0.25rem 0.625rem' }}
                                                onClick={() => handleDelete(user.id)}
                                                className="rounded-lg text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
                                            >
                                                Удалить
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-400 dark:text-gray-500">Только просмотр</span>
                                    )}
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