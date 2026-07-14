// src/pages/AdminLayout.tsx
import { JSX } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { adminLogout, getAdminRole, AdminRole } from '../utils/auth';

interface Zone {
    path: string;
    label: string;
    icon: JSX.Element;
    roles: AdminRole[] | null; // null = доступно любой staff-роли
}

const ZONES: Zone[] = [
    {
        path: 'overview',
        label: 'Обзор',
        roles: null,
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        path: 'content',
        label: 'Контент',
        roles: null,
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
        ),
    },
    {
        path: 'ai-queue',
        label: 'AI-очередь',
        roles: ['superadmin', 'content_manager'],
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        ),
    },
    {
        path: 'games',
        label: 'Игры и карты',
        roles: ['superadmin', 'content_manager'],
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
        ),
    },
    {
        path: 'game-scenarios',
        label: 'Игровые сценарии',
        // teacher: может отмечать чек-лист/предпросматривать, но не публиковать
        // (см. docs/roadmap/product-technical-plan.md R3 §5) — гейтится внутри панели.
        roles: null,
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
        ),
    },
    {
        path: 'students',
        label: 'Учащиеся',
        roles: null,
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
    {
        path: 'quality',
        label: 'Аналитика качества',
        roles: null,
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
    },
    {
        path: 'staff',
        label: 'Пользователи и роли',
        roles: ['superadmin'],
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
        ),
    },
    {
        path: 'audit',
        label: 'Аудит',
        roles: ['superadmin', 'content_manager'],
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
    },
];

const AdminLayout = () => {
    const navigate = useNavigate();
    const role = getAdminRole();
    const visibleZones = ZONES.filter(z => z.roles === null || (role && z.roles.includes(role)));

    const handleLogout = () => {
        adminLogout();
        navigate('/admin/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">

            {/* ── Шапка ── */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors">
                <div className="px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <span className="text-sm font-bold text-gray-900 dark:text-white transition-colors">MathLingo</span>
                            <span className="ml-2 text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded font-medium transition-colors">
                                Admin
                            </span>
                            {role && (
                                <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded font-medium transition-colors">
                                    {role}
                                </span>
                            )}
                        </div>
                    </div>

                    <button
                        style={{ padding: '0.375rem 0.875rem' }}
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-500/30 rounded-lg transition-all"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Выйти
                    </button>
                </div>
            </header>

            {/* ── Сайдбар + контент ── */}
            <div className="pt-14 flex">
                <nav className="fixed top-14 bottom-0 left-0 w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto transition-colors py-4 px-3 space-y-1">
                    {visibleZones.map(zone => (
                        <NavLink
                            key={zone.path}
                            to={`/admin/${zone.path}`}
                            style={{ padding: '0.5rem 0.75rem' }}
                            className={({ isActive }) =>
                                `flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all ${
                                    isActive
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`
                            }
                        >
                            {zone.icon}
                            {zone.label}
                        </NavLink>
                    ))}
                </nav>

                <main className="ml-56 flex-1 min-h-[calc(100vh-3.5rem)]">
                    <div className="max-w-6xl mx-auto px-4 py-6">
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm transition-colors">
                            <Outlet />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
