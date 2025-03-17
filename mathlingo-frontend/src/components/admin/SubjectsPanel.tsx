// src/components/admin/SubjectsPanel.tsx
import React, { useEffect, useState } from 'react';
import { fetchSubjects, deleteSubject, Subject } from '../../utils/adminApi';
import Button from '../Button';
import SubjectForm from './SubjectForm';

const SubjectsPanel: React.FC = () => {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

    const loadSubjects = async () => {
        try {
            setLoading(true);
            const data = await fetchSubjects();
            setSubjects(data);
            setError('');
        } catch (err) {
            console.error('Ошибка при загрузке разделов:', err);
            setError('Не удалось загрузить разделы математики');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSubjects();
    }, []);

    const handleAddSubject = () => {
        setEditingSubject(null);
        setShowForm(true);
    };

    const handleEditSubject = (subject: Subject) => {
        setEditingSubject(subject);
        setShowForm(true);
    };

    const handleDeleteSubject = async (id: number) => {
        if (window.confirm('Вы уверены, что хотите удалить этот раздел?')) {
            try {
                await deleteSubject(id);
                setSubjects(subjects.filter(subject => subject.id !== id));
            } catch (err) {
                console.error('Ошибка при удалении раздела:', err);
                setError('Не удалось удалить раздел');
            }
        }
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingSubject(null);
    };

    const handleFormSubmit = () => {
        setShowForm(false);
        setEditingSubject(null);
        loadSubjects();
    };

    if (loading && subjects.length === 0) {
        return <div className="text-center py-10">Загрузка...</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Управление разделами</h2>
                <Button onClick={handleAddSubject}>Добавить раздел</Button>
            </div>

            {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

            {showForm && (
                <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                    <SubjectForm
                        subject={editingSubject}
                        onSubmit={handleFormSubmit}
                        onCancel={handleFormClose}
                    />
                </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Код</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Порядок</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Кол-во заданий</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {subjects.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                                Разделов пока нет. Создайте первый раздел!
                            </td>
                        </tr>
                    ) : (
                        subjects.map((subject) => (
                            <tr key={subject.id}>
                                <td className="px-6 py-4 whitespace-nowrap">{subject.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{subject.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{subject.code}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{subject.order || 0}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{subject.tasks_count || 0}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${subject.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {subject.is_active ? 'Активен' : 'Неактивен'}
                                        </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <button
                                        onClick={() => handleEditSubject(subject)}
                                        className="text-blue-600 hover:text-blue-900 mr-4"
                                    >
                                        Редактировать
                                    </button>
                                    <button
                                        onClick={() => subject.id && handleDeleteSubject(subject.id)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        Удалить
                                    </button>
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

export default SubjectsPanel;