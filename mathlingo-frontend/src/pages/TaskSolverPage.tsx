// src/pages/TaskSolverPage.tsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import TaskSolver from '../components/adventure/TaskSolver';

const TaskSolverPage: React.FC = () => {
    const { taskGroupId } = useParams<{ taskGroupId: string }>();
    const navigate = useNavigate();

    if (!taskGroupId) {
        return (
            <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
                <Navbar />
                <div className="mt-16 max-w-3xl mx-auto px-4 py-8">
                    <div className="bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl backdrop-blur p-6 text-center transition-colors">
                        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">Группа заданий не найдена</h2>
                        <button
                            style={{ padding: '0.625rem 1.25rem' }}
                            className="brand-gradient brand-gradient-hover text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25"
                            onClick={() => navigate('/dashboard')}
                        >
                            Вернуться на главную
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            <Navbar />
            <div className="mt-16 max-w-3xl mx-auto px-4 py-8">
                <div className="bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl backdrop-blur p-6 transition-colors">
                    <TaskSolver />
                </div>
            </div>
        </div>
    );
};

export default TaskSolverPage;