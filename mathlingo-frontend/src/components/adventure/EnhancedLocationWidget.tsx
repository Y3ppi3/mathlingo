// src/components/adventure/EnhancedLocationWidget.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../Button';

interface GameMechanicInfo {
    id: string;
    name: string;
    description: string;
    icon: string;
    type: string;
}

interface TaskGroupInfo {
    id: number;
    name: string;
    description: string;
    difficulty: number;
    reward_points: number;
    tasks: number[];
    completed: boolean;
}

interface LocationWidgetProps {
    locationName: string;
    locationDescription: string;
    subjectId: number;
    taskGroups: TaskGroupInfo[];
    gameMechanics: GameMechanicInfo[];
    onClose: () => void;
}

const EnhancedLocationWidget: React.FC<LocationWidgetProps> = ({
                                                                   locationName,
                                                                   locationDescription,
                                                                   subjectId,
                                                                   taskGroups,
                                                                   gameMechanics,
                                                                   onClose
                                                               }) => {
    const navigate = useNavigate();

    const startTaskGroup = (taskGroupId: number) => {
        navigate(`/subject/${subjectId}/task-group/${taskGroupId}`);
    };

    const openGames = (mechanicType?: string) => {
        if (mechanicType) {
            navigate(`/subject/${subjectId}/games/${mechanicType}`);
        } else {
            navigate(`/subject/${subjectId}/games`);
        }
    };

    return (
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white dark:bg-gray-900 bg-opacity-90 dark:bg-opacity-90 p-4 shadow-lg">
            <button
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={onClose}
            >
                &times;
            </button>

            <h3 className="text-xl font-bold mb-2 text-gray-800 dark:text-white">{locationName}</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{locationDescription}</p>

            {/* Секция игровых механик */}
            <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">Игровые механики:</h4>
                {gameMechanics.length > 0 ? (
                    <div className="space-y-3">
                        {gameMechanics.map((mechanic) => (
                            <div
                                key={mechanic.id}
                                className="p-3 rounded-lg cursor-pointer transition-colors bg-indigo-50 dark:bg-indigo-900 hover:bg-indigo-100 dark:hover:bg-indigo-800"
                                onClick={() => openGames(mechanic.type)}
                            >
                                <div className="flex items-center mb-2">
                                    <span className="text-2xl mr-2">{mechanic.icon}</span>
                                    <h5 className="font-medium text-gray-800 dark:text-white">{mechanic.name}</h5>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-300">{mechanic.description}</p>
                            </div>
                        ))}

                        <div className="text-center pt-2">
                            <Button
                                variant="outline"
                                onClick={() => openGames()}
                                className="w-full py-2"
                            >
                                Показать все игры
                            </Button>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        В этой локации пока нет доступных игровых механик.
                    </p>
                )}
            </div>

            {/* Секция заданий */}
            <h4 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">Задания:</h4>
            {taskGroups.length > 0 ? (
                <div className="space-y-3">
                    {taskGroups.map((group) => (
                        <div
                            key={group.id}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                                group.completed
                                    ? 'bg-green-100 dark:bg-green-900'
                                    : 'bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800'
                            }`}
                            onClick={() => startTaskGroup(group.id)}
                        >
                            <div className="flex justify-between items-center">
                                <h5 className="font-medium text-gray-800 dark:text-white">{group.name}</h5>
                                <span className="text-xs px-2 py-1 rounded bg-blue-200 dark:bg-blue-700 text-blue-800 dark:text-white">
                                    {group.reward_points} очков
                                </span>
                            </div>
                            <p className="text-xs mt-1 text-gray-700 dark:text-gray-300">{group.description}</p>
                            <div className="flex items-center mt-2">
                                <div className="flex">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <span
                                            key={i}
                                            className={`w-4 h-4 ${
                                                i < group.difficulty
                                                    ? 'text-yellow-500'
                                                    : 'text-gray-300 dark:text-gray-600'
                                            }`}
                                        >
                                            ★
                                        </span>
                                    ))}
                                </div>
                                <span className="text-xs ml-2 text-gray-600 dark:text-gray-300">
                                    {group.tasks.length} задани{group.tasks.length === 1 ? 'е' : 'й'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">В этой локации пока нет доступных заданий.</p>
            )}
        </div>
    );
};

export default EnhancedLocationWidget;