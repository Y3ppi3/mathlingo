// src/components/admin/StaffPanel.tsx
import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { fetchAdmins, createAdmin, AdminAccount } from '../../utils/adminApi';

const ROLE_LABELS: Record<AdminAccount['role'], string> = {
    superadmin: 'Superadmin',
    content_manager: 'Content manager',
    teacher: 'Teacher',
};

const inputCls = "w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors";

// Только superadmin: управление ролями/квотами — его зона ответственности,
// см. docs/roadmap/product-technical-plan.md, R1 §5. Backend (list_admins,
// register) уже это перепроверяет независимо от того, что показано тут.
const StaffPanel = () => {
    const [admins, setAdmins] = useState<AdminAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<AdminAccount['role']>('content_manager');
    const [submitting, setSubmitting] = useState(false);

    const load = async () => {
        try {
            setLoading(true);
            setAdmins(await fetchAdmins());
            setError('');
        } catch {
            setError('Не удалось загрузить список администраторов');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await createAdmin({ username, email, password, role });
            setShowForm(false);
            setUsername(''); setEmail(''); setPassword(''); setRole('content_manager');
            load();
        } catch (err) {
            const detail = (err as AxiosError<{ detail?: string }>).response?.data?.detail;
            setError(detail || 'Не удалось создать администратора');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Загрузка...
            </div>
        </div>
    );

    return (
        <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Пользователи и роли
                    <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">{admins.length}</span>
                </h2>
                <button
                    style={{ padding: '0.5rem 1rem' }}
                    onClick={() => setShowForm(v => !v)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                    {showForm ? 'Отмена' : 'Добавить администратора'}
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl">
                    <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                </div>
            )}

            {showForm && (
                <form onSubmit={handleCreate} className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-2xl p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Имя пользователя</label>
                            <input className={inputCls} value={username} onChange={e => setUsername(e.target.value)} required />
                        </div>
                        <div>
                            <label className={labelCls}>Email</label>
                            <input type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} required />
                        </div>
                        <div>
                            <label className={labelCls}>Пароль</label>
                            <input type="password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} required />
                        </div>
                        <div>
                            <label className={labelCls}>Роль</label>
                            <select className={inputCls} value={role} onChange={e => setRole(e.target.value as AdminAccount['role'])}>
                                <option value="content_manager">Content manager</option>
                                <option value="teacher">Teacher</option>
                                <option value="superadmin">Superadmin</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={submitting}
                            style={{ padding: '0.5rem 1.25rem' }}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors"
                        >
                            {submitting ? 'Создание...' : 'Создать'}
                        </button>
                    </div>
                </form>
            )}

            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                        {['ID', 'Имя', 'Email', 'Роль', 'Статус'].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                    {admins.map(a => (
                        <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-5 py-3.5 text-sm text-gray-400 dark:text-gray-500">{a.id}</td>
                            <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-white">{a.username}</td>
                            <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">{a.email}</td>
                            <td className="px-5 py-3.5">
                                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                                    {ROLE_LABELS[a.role]}
                                </span>
                            </td>
                            <td className="px-5 py-3.5">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    a.is_active
                                        ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                }`}>
                                    {a.is_active ? 'Активен' : 'Неактивен'}
                                </span>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StaffPanel;
