import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@heroicons/react/24/solid";

function ThemeToggle() {
    // Определяем предпочтительную тему пользователя из localStorage или системных настроек
    const [theme, setTheme] = useState<"dark" | "light">(() => {
        // Проверяем сохраненную тему в localStorage
        const savedTheme = localStorage.getItem("theme");
        if (savedTheme === "dark" || savedTheme === "light") {
            return savedTheme;
        }

        // Если нет сохраненной темы, проверяем системные предпочтения
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return "dark";
        }

        // По умолчанию используем светлую тему
        return "light";
    });

    // При каждом изменении theme добавляем/убираем класс .dark на <html> и сохраняем в localStorage
    useEffect(() => {
        if (theme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }

        // Сохраняем выбранную тему в localStorage
        localStorage.setItem("theme", theme);
    }, [theme]);

    // Функция переключения темы
    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
    };

    return (
        <div className="flex items-center space-x-2">
            <MoonIcon
                className={`h-5 w-5 transition-colors ${
                    theme === "dark" ? "text-indigo-300" : "text-gray-500"
                }`}
            />
            <label className="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={theme === "dark"}
                    onChange={toggleTheme}
                />
                {/* Фон переключателя */}
                <div
                    className="
            w-12 h-6
            bg-gray-300
            dark:bg-gray-600
            peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500
            rounded-full peer
            transition-colors
            peer-checked:bg-indigo-500
          "
                ></div>
                {/* Ползунок */}
                <div
                    className="
            absolute left-1 top-1
            w-4 h-4
            bg-white
            rounded-full
            border border-gray-300 dark:border-gray-500
            transition-all
            peer-checked:translate-x-6
          "
                ></div>
            </label>
            <SunIcon
                className={`h-5 w-5 transition-colors ${
                    theme === "light" ? "text-yellow-400" : "text-gray-500"
                }`}
            />
        </div>
    );
}

export default ThemeToggle;