// src/components/admin/ContentZonePanel.tsx
import { useState } from 'react';
import TasksPanel from './TasksPanel';
import SubjectsPanel from './SubjectsPanel';

type SubTab = 'tasks' | 'subjects';

// "Каталог учебного контента" объединяет задания и разделы/темы — обе части
// одной content-модели (см. docs/roadmap/product-technical-plan.md, R1 §3).
const ContentZonePanel = () => {
    const [tab, setTab] = useState<SubTab>('tasks');

    return (
        <div>
            <div className="flex items-center gap-1 px-6 pt-5">
                {([
                    ['tasks', 'Задания'],
                    ['subjects', 'Разделы и темы'],
                ] as [SubTab, string][]).map(([id, label]) => (
                    <button
                        key={id}
                        style={{ padding: '0.375rem 0.875rem' }}
                        onClick={() => setTab(id)}
                        className={`rounded-lg text-sm font-medium transition-all ${
                            tab === id
                                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {tab === 'tasks' ? <TasksPanel /> : <SubjectsPanel />}
        </div>
    );
};

export default ContentZonePanel;
