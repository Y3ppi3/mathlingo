// src/pages/TaskSolverPage.tsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import TaskSolver from '../components/adventure/TaskSolver';

const TaskSolverPage: React.FC = () => {
    const { taskGroupId } = useParams<{ taskGroupId: string }>();
    const navigate = useNavigate();

    if (!taskGroupId) {
        return (
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
                <Navbar />
                <div className="container mx-auto px-4 py-8">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
                        <h2 className="text-xl text-red-500 mb-4">Группа заданий не найдена</h2>
                        <button
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            <Navbar />
            <div className="container mx-auto px-4 py-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                    <TaskSolver />
                </div>
            </div>
        </div>
    );
};

export default TaskSolverPage;