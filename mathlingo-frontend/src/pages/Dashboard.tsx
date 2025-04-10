import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// Определим типы для данных
interface UserData {
    id: number;
    username: string;
    email: string;
    // Добавьте другие необходимые поля
}

interface Subject {
    id: number;
    name: string;
    code: string;
    description: string;
    icon: string;
    is_active: boolean;
}

// Получаем базовый URL API из переменной окружения
const API_URL = import.meta.env.VITE_API_URL;

const Dashboard = () => {
    const [userData, setUserData] = useState<UserData | null>(null);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                console.log("📡 Отправляем запрос на /api/me...");
                const response = await fetch(`${API_URL}/api/me`, {
                    method: "GET",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                });

                if (!response.ok) {
                    // Получаем подробности ошибки, если есть
                    const errorData = await response.json().catch(() => ({}));
                    const errorMessage = errorData.detail || "Ошибка авторизации. Войдите заново.";
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                console.log("📩 Ответ от сервера:", data);
                setUserData(data);
            } catch (err: unknown) {
                if (err instanceof Error) {
                    console.error("❌ Ошибка при запросе:", err.message);
                    setError(err.message);
                } else {
                    console.error("❌ Неизвестная ошибка:", err);
                    setError("Неизвестная ошибка");
                }
            } finally {
                setIsLoading(false);
            }
        };

        const fetchSubjects = async () => {
            try {
                const response = await fetch(`${API_URL}/api/subjects/`, {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                });

                // Обработка ошибок
                if (!response.ok) {
                    const errorData = await response.text();
                    console.error("Ошибка загрузки:", errorData);
                    throw new Error("Не удалось загрузить предметы");
                }

                const data = await response.json();
                setSubjects(data);
            } catch (err) {
                console.error("Ошибка при загрузке предметов:", err);
                setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
            }
        };

        Promise.all([fetchUserData(), fetchSubjects()]);
    }, []);

    if (error) {
        return (
            <div className="mt-16 container mx-auto px-4 py-6 text-red-500">
                Ошибка: {error}
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="mt-16 container mx-auto px-4 py-6">
                Загрузка...
            </div>
        );
    }

    return (
        <div className="mt-16 container mx-auto px-4 py-6">
            <h2 className="text-2xl font-bold mb-6 text-white dark:text-gray-900 transition-colors">Панель управления</h2>

            <div className="bg-gray-800 dark:bg-gray-100 rounded-lg shadow-md p-6 mb-8 transition-colors">
                <h3 className="text-xl font-semibold mb-4 text-white dark:text-gray-900 transition-colors">Ваш профиль</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <p className="text-gray-400 dark:text-gray-700 transition-colors">ID:</p>
                        <p className="font-medium text-white dark:text-gray-900 transition-colors">{userData?.id}</p>
                    </div>
                    <div>
                        <p className="text-gray-400 dark:text-gray-700 transition-colors">Имя пользователя:</p>
                        <p className="font-medium text-white dark:text-gray-900 transition-colors">{userData?.username}</p>
                    </div>
                    <div>
                        <p className="text-gray-400 dark:text-gray-700 transition-colors">Email:</p>
                        <p className="font-medium text-white dark:text-gray-900 transition-colors">{userData?.email}</p>
                    </div>
                </div>
            </div>

            <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4 text-white dark:text-gray-900 transition-colors">Доступные предметы</h3>

                {subjects.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {subjects.map((subject) => (
                            <div key={subject.id}
                                 className="bg-gray-800 dark:bg-gray-100 rounded-lg shadow-md overflow-hidden transition-colors">
                                <div className="p-5">
                                    <div className="flex items-center">
                                        {subject.icon && (
                                            <img src={subject.icon} alt={subject.name} className="w-10 h-10 mr-3"/>
                                        )}
                                        <h3 className="text-lg font-semibold text-white dark:text-gray-900 transition-colors">{subject.name}</h3>
                                    </div>
                                    <p className="mt-2 text-gray-400 dark:text-gray-700 line-clamp-2 transition-colors">{subject.description}</p>

                                    <div className="mt-4 flex space-x-3">
                                        {/* Кнопка для обычного режима */}
                                        <Link
                                            to={`/subject/${subject.id}/tasks`}
                                            className="flex-1 px-4 py-2 bg-blue-600 text-white text-center rounded-md hover:bg-blue-700"
                                        >
                                            Обычный режим
                                        </Link>

                                        {/* Кнопка для режима приключения */}
                                        <Link
                                            to={`/subject/${subject.id}/map`}
                                            className="flex-1 px-4 py-2 bg-purple-600 text-white text-center rounded-md hover:bg-purple-700"
                                        >
                                            Приключение
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-gray-800 dark:bg-gray-100 rounded-lg p-8 text-center transition-colors">
                        <p className="text-gray-400 dark:text-gray-700 transition-colors">Предметы не найдены</p>
                    </div>
                )}
            </div>

            <div className="bg-gray-700 dark:bg-gray-200 rounded-lg p-6 transition-colors">
                <h3 className="text-lg font-semibold mb-2 text-white dark:text-gray-900 transition-colors">Что нового?</h3>
                <p className="mb-4 text-gray-300 dark:text-gray-800 transition-colors">
                    Теперь вы можете изучать математику в игровой форме!
                    Попробуйте новый режим "Приключение" и зарабатывайте очки, исследуя интерактивную карту.
                </p>
                <div className="flex justify-end">
                    <Link
                        to={subjects.length > 0 ? `/subject/${subjects[0].id}/map` : '#'}
                        className={`px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 ${
                            subjects.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    >
                        Начать приключение
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;