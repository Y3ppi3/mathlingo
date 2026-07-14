import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import { useUser } from '../hooks/useUser';
import AvatarSelector from '../components/ui/AvatarSelector';
import Input from '../components/ui/Input';
import { ArrowLeft, Save, User, Image, Mail, Lock, Bell, Trash2 } from 'lucide-react';

type NotificationKey = 'email' | 'browser' | 'weekly' | 'achievements';

interface NotificationSettings {
    email: boolean;
    browser: boolean;
    weekly: boolean;
    achievements: boolean;
}

const ProfileSettingsPage = () => {
    const { user, loading, error, refreshUserData, updateUserProfile } = useUser();
    const navigate = useNavigate();
    const isMounted = useRef(true);

    const [formData, setFormData] = useState({
        username: '',
        avatarId: undefined as number | undefined,
    });
    const [originalData, setOriginalData] = useState({
        username: '',
        avatarId: undefined as number | undefined,
    });

    const [formError, setFormError]           = useState('');
    const [isSaving, setIsSaving]             = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [formKey, setFormKey]               = useState(Date.now());

    const [passwords, setPasswords] = useState({
        current: '', next: '', confirm: '',
    });

    const [notifications, setNotifications] = useState<NotificationSettings>({
        email: true, browser: false, weekly: true, achievements: true,
    });

    useEffect(() => {
        if (user) {
            const userData = { username: user.username, avatarId: user.avatarId };
            setFormData(userData);
            setOriginalData(userData);
        }
    }, [user]);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    const hasFormChanges = useCallback(() =>
            formData.username !== originalData.username ||
            formData.avatarId !== originalData.avatarId,
        [formData, originalData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!hasFormChanges()) {
            setSuccessMessage('Нет изменений для сохранения.');
            return;
        }

        setFormError('');
        setSuccessMessage('');
        setIsSaving(true);

        try {
            const updateData: { username?: string; avatarId?: number | null } = {};
            if (formData.username !== originalData.username) updateData.username = formData.username;
            if (formData.avatarId !== originalData.avatarId) updateData.avatarId = formData.avatarId ?? null;

            // Через useUser().updateUserProfile (общий axios-инстанс api), а не
            // отдельный raw fetch — тот брал X-CSRF-Token из
            // meta[name="csrf-token"], которого в приложении никогда не
            // существовало (токен живёт только в JS-модуле studentApi.ts),
            // так что обновление профиля тут всегда падало с 403.
            const result = await updateUserProfile(updateData) as { success: boolean; canceled?: boolean };
            if (result.canceled) return;

            setSuccessMessage('Профиль успешно обновлён!');

            const freshUser = await refreshUserData();
            if (freshUser && isMounted.current) {
                const freshData = { username: freshUser.username, avatarId: freshUser.avatarId };
                setFormData(freshData);
                setOriginalData(freshData);
                setFormKey(Date.now());
            }
        } catch (err) {
            setFormError(`Не удалось сохранить: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`);
        } finally {
            if (isMounted.current) setIsSaving(false);
        }
    };

    const toggleNotification = (key: NotificationKey) => {
        setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const notificationItems: { key: NotificationKey; label: string; desc: string }[] = [
        { key: 'email',        label: 'Email-уведомления',    desc: 'Получать уведомления на почту'    },
        { key: 'browser',      label: 'Уведомления браузера', desc: 'Push-уведомления в браузере'      },
        { key: 'weekly',       label: 'Еженедельный отчёт',   desc: 'Сводка прогресса за неделю'       },
        { key: 'achievements', label: 'Достижения',           desc: 'Уведомления о новых достижениях'  },
    ];

    // — Loading —
    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
                <Navbar />
                <div className="container mx-auto px-4 mt-16 flex justify-center items-center h-96">
                    <div className="flex items-center gap-3 text-gray-400 dark:text-slate-400">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        Загрузка...
                    </div>
                </div>
            </div>
        );
    }

    // — Error —
    if (error || !user) {
        return (
            <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
                <Navbar />
                <div className="container mx-auto px-4 mt-16 py-8">
                    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 text-center transition-colors">
                        <p className="text-red-500 dark:text-red-400 text-lg mb-4">
                            {error || 'Не удалось загрузить профиль'}
                        </p>
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-medium rounded-xl transition-all"
                        >
                            Вернуться на главную
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const isFormChanged = hasFormChanges();

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <Navbar />
            <div className="max-w-3xl mx-auto px-4 py-8 mt-16">

                {/* Заголовок */}
                <div className="mb-8 flex items-center gap-4">
                    <button
                        onClick={() => navigate('/profile')}
                        style={{padding: 0}} // глобальный button { padding: 0.6em 1.2em } из index.css ломает w-10 h-10
                        className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all"
                        aria-label="Назад к профилю"
                    >
                        <ArrowLeft className="w-5 h-5"/>
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white transition-colors">
                            Настройки профиля
                        </h1>
                        <p className="text-gray-400 dark:text-slate-400 mt-0.5 text-sm transition-colors">
                            Управление аккаунтом и предпочтениями
                        </p>
                    </div>
                </div>

                <form key={formKey} onSubmit={handleSubmit} className="space-y-6">

                    {/* Уведомления формы */}
                    {formError && (
                        <div
                            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm transition-colors">
                            {formError}
                        </div>
                    )}
                    {successMessage && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-green-600 dark:text-green-400 text-sm transition-colors">
                            {successMessage}
                        </div>
                    )}

                    {/* — Имя пользователя — */}
                    <div className="bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 backdrop-blur transition-colors">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2 transition-colors">
                            <User className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                            Основная информация
                        </h2>
                        <label className="block text-xs font-medium text-gray-400 dark:text-slate-400 mb-1.5 uppercase tracking-wider transition-colors">
                            Имя пользователя
                        </label>
                        <Input
                            id="username-field"
                            name="username"
                            type="text"
                            value={formData.username}
                            onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                            required
                        />
                        <div className="mt-5 flex justify-end">
                            <button
                                type="submit"
                                disabled={isSaving || !isFormChanged}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                    isFormChanged && !isSaving
                                        ? 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white shadow-sm shadow-indigo-500/25'
                                        : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                                }`}
                            >
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Сохранение...' : 'Сохранить'}
                            </button>
                        </div>
                    </div>

                    {/* — Аватар — */}
                    <div className="bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 backdrop-blur transition-colors">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2 transition-colors">
                            <Image className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                            Аватар
                        </h2>
                        <AvatarSelector
                            selectedAvatar={formData.avatarId}
                            onSelect={id => setFormData(prev => ({ ...prev, avatarId: id }))}
                        />
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-3 transition-colors">
                            Выберите аватар из галереи — он будет отображаться в профиле и меню.
                        </p>
                    </div>

                    {/* — Email — */}
                    <div className="bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 backdrop-blur transition-colors">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2 transition-colors">
                            <Mail className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                            Email
                        </h2>
                        <div className="bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 transition-colors">
                            <p className="text-sm font-medium text-gray-900 dark:text-white transition-colors">
                                {user.email}
                            </p>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 transition-colors">
                            Email нельзя изменить после регистрации.
                        </p>
                    </div>

                </form>

                {/* — Смена пароля — (отдельно от form) */}
                <div className="mt-6 bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 backdrop-blur transition-colors">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2 transition-colors">
                        <Lock className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                        Смена пароля
                    </h2>
                    <div className="grid sm:grid-cols-3 gap-4">
                        {(['current', 'next', 'confirm'] as const).map((key, i) => (
                            <div key={key}>
                                <label className="block text-xs font-medium text-gray-400 dark:text-slate-400 mb-1.5 uppercase tracking-wider transition-colors">
                                    {['Текущий пароль', 'Новый пароль', 'Подтвердите'][i]}
                                </label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={passwords[key]}
                                    onChange={e => setPasswords(prev => ({ ...prev, [key]: e.target.value }))}
                                    className="w-full bg-white dark:bg-gray-900/80 border border-gray-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-all text-sm"
                                />
                            </div>
                        ))}
                    </div>
                    <div className="mt-4">
                        <button className="px-6 py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-700 dark:text-white text-sm font-medium transition-all">
                            Изменить пароль
                        </button>
                    </div>
                </div>

                {/* — Уведомления — */}
                <div className="mt-6 bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 backdrop-blur transition-colors">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2 transition-colors">
                        <Bell className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                        Уведомления
                    </h2>
                    <div className="space-y-4">
                        {notificationItems.map(n => (
                            <div key={n.key} className="flex items-center justify-between py-1">
                                <div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white transition-colors">{n.label}</div>
                                    <div className="text-xs text-gray-400 dark:text-slate-500 transition-colors">{n.desc}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => toggleNotification(n.key)}
                                    aria-label={`Переключить ${n.label}`}
                                    className={`relative w-12 h-6 rounded-full transition-all ${
                                        notifications[n.key] ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-slate-700'
                                    }`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                        notifications[n.key] ? 'left-7' : 'left-1'
                                    }`} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* — Danger zone — */}
                <div className="mt-6 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-2xl p-6 backdrop-blur transition-colors">
                    <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2 transition-colors">
                        <Trash2 className="w-5 h-5" />
                        Опасная зона
                    </h2>
                    <p className="text-gray-500 dark:text-slate-400 text-sm mb-4 transition-colors">
                        Удаление аккаунта необратимо. Все данные будут уничтожены.
                    </p>
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/30 hover:border-red-300 dark:hover:border-red-500/50 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium transition-all">
                        <Trash2 className="w-4 h-4" />
                        Удалить аккаунт
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ProfileSettingsPage;