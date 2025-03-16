// src/pages/AdminDashboard.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import TasksPanel from '../components/admin/TasksPanel';
import UsersPanel from '../components/admin/UsersPanel';
import SubjectsPanel from '../components/admin/SubjectsPanel';

const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'tasks' | 'users' | 'subjects'>('tasks');
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
            <div className="flex border-b mb-6">
                <button
                    className={`px-4 py-2 ${activeTab === 'tasks' ? 'border-b-2 border-indigo-500 font-medium' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('tasks')}
                >
                    Задания
                </button>
                <button
                    className={`px-4 py-2 ${activeTab === 'subjects' ? 'border-b-2 border-indigo-500 font-medium' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('subjects')}
                >
                    Разделы
                </button>
                <button
                    className={`px-4 py-2 ${activeTab === 'users' ? 'border-b-2 border-indigo-500 font-medium' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('users')}
                >
                    Пользователи
                </button>
            </div>

            {/* Содержимое панели */}
            {activeTab === 'tasks' && <TasksPanel />}
            {activeTab === 'users' && <UsersPanel />}
            {activeTab === 'subjects' && <SubjectsPanel />}
        </div>
    );
};

export default AdminDashboard;