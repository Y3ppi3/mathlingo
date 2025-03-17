// src/pages/AdminDashboard.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
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
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Панель администратора</h1>
                <div>
                    <Button onClick={handleLogout} variant="outline">
                        Выйти
                    </Button>
                </div>
            </div>

            {/* Навигация */}
            <div className="flex border-b mb-6 overflow-x-auto">
                <button
                    className={`px-4 py-2 whitespace-nowrap ${activeTab === 'tasks' ? 'border-b-2 border-indigo-500 font-medium' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('tasks')}
                >
                    Задания
                </button>
                <button
                    className={`px-4 py-2 whitespace-nowrap ${activeTab === 'subjects' ? 'border-b-2 border-indigo-500 font-medium' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('subjects')}
                >
                    Разделы
                </button>
                <button
                    className={`px-4 py-2 whitespace-nowrap ${activeTab === 'users' ? 'border-b-2 border-indigo-500 font-medium' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('users')}
                >
                    Пользователи
                </button>
                <button
                    className={`px-4 py-2 whitespace-nowrap ${activeTab === 'gamification' ? 'border-b-2 border-indigo-500 font-medium bg-purple-100 dark:bg-purple-900' : 'text-gray-500 hover:bg-purple-50 dark:hover:bg-purple-900/30'} transition-colors rounded-t-md`}
                    onClick={() => setActiveTab('gamification')}
                >
                    <span className="flex items-center">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                        </svg>
                        Геймификация
                    </span>
                </button>
            </div>

            {/* Содержимое панели */}
            {activeTab === 'tasks' && <TasksPanel />}
            {activeTab === 'users' && <UsersPanel />}
            {activeTab === 'subjects' && <SubjectsPanel />}
            {activeTab === 'gamification' && <GamificationPanel />}
        </div>
    );
};

export default AdminDashboard;