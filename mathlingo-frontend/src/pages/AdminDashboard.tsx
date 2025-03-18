// src/pages/AdminDashboard.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TasksPanel from '../components/admin/TasksPanel';
import UsersPanel from '../components/admin/UsersPanel';
import SubjectsPanel from '../components/admin/SubjectsPanel';
import GamificationPanel from '../components/admin/GamificationPanel';

const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'tasks' | 'users' | 'subjects' | 'gamification'>('tasks');
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminId');
        localStorage.removeItem('adminUsername');
        navigate('/admin/login');
    };

    return (
        <div className="min-h-screen bg-[#0F1729] dark:bg-white text-white dark:text-gray-900 transition-colors">
            <header className="flex justify-between items-center p-4 border-b border-gray-800 dark:border-gray-200">
                <div className="flex items-center space-x-2">
                    <img src="/logo.png" alt="MathLingo" className="h-8 w-8" />
                    <span className="text-xl font-bold text-indigo-400 dark:text-indigo-600">MathLingo</span>
                </div>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={handleLogout}
                        className="px-4 py-1 text-sm rounded hover:bg-gray-800 dark:hover:bg-gray-200"
                    >
                        Выйти
                    </button>
                    <div className="flex items-center space-x-2">
                        <span className="text-gray-400 dark:text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        </span>
                        <div className="w-10 h-5 bg-gray-700 dark:bg-gray-300 rounded-full flex items-center px-0.5">
                            <div className="w-4 h-4 bg-indigo-500 rounded-full transform transition-transform dark:translate-x-5"></div>
                        </div>
                        <span className="text-gray-400 dark:text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </span>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-6">
                {/* Навигация */}
                <div className="flex border-b border-gray-800 dark:border-gray-200 mb-6">
                    <button
                        className={`px-4 py-2 mr-1 ${activeTab === 'tasks' ? 'border-b-2 border-indigo-500' : ''}`}
                        onClick={() => setActiveTab('tasks')}
                    >
                        Задания
                    </button>
                    <button
                        className={`px-4 py-2 mr-1 ${activeTab === 'subjects' ? 'border-b-2 border-indigo-500' : ''}`}
                        onClick={() => setActiveTab('subjects')}
                    >
                        Разделы
                    </button>
                    <button
                        className={`px-4 py-2 mr-1 ${activeTab === 'users' ? 'border-b-2 border-indigo-500' : ''}`}
                        onClick={() => setActiveTab('users')}
                    >
                        Пользователи
                    </button>
                    <button
                        className={`px-4 py-2 mr-1 flex items-center ${activeTab === 'gamification' ? 'bg-purple-900/30 dark:bg-purple-100 border-b-2 border-purple-500 rounded-t-md' : ''}`}
                        onClick={() => setActiveTab('gamification')}
                    >
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                        </svg>
                        Геймификация
                    </button>
                </div>

                {/* Содержимое панели */}
                {activeTab === 'tasks' && <TasksPanel />}
                {activeTab === 'users' && <UsersPanel />}
                {activeTab === 'subjects' && <SubjectsPanel />}
                {activeTab === 'gamification' && <GamificationPanel />}
            </div>
        </div>
    );
};

export default AdminDashboard;