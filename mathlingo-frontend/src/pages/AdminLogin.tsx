// src/pages/AdminLogin.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin } from '../utils/auth';

const AdminLogin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await adminLogin(email, password);
            navigate('/admin/dashboard');
        } catch (err) {
            console.error("Ошибка при входе в админ-панель:", err);
            setError('Неверная почта или пароль');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0F1729] dark:bg-white transition-colors">
            <div className="bg-gray-800 dark:bg-gray-100 p-8 rounded-lg shadow-md w-full max-w-md transition-colors">
                <div className="flex justify-center mb-6">
                    <div className="flex items-center space-x-2">
                        <span className="text-xl font-bold text-indigo-400 dark:text-indigo-600">Admin MathLingo</span>
                    </div>
                </div>

                <h2 className="text-2xl font-bold mb-6 text-center text-white dark:text-gray-900 transition-colors">Вход для администратора</h2>

                {error && <div className="bg-red-500/20 text-red-100 dark:bg-red-100 dark:text-red-700 p-3 rounded mb-4 transition-colors">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-300 dark:text-gray-700 mb-2">Email</label>
                        <input
                            type="email"
                            placeholder="Введите email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-200 dark:border-gray-300 dark:text-gray-900"
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-gray-300 dark:text-gray-700 mb-2">Пароль</label>
                        <input
                            type="password"
                            placeholder="Введите пароль"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-200 dark:border-gray-300 dark:text-gray-900"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        Войти
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;