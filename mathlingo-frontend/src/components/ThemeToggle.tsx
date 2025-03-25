import { useTheme } from "../context/ThemeContext";

interface ThemeToggleProps {
    isCompact?: boolean; // Компактный вид для меню
}

function ThemeToggle({ isCompact = false }: ThemeToggleProps) {
    // Используем хук useTheme для получения текущей темы и функции переключения
    const { theme, toggleTheme } = useTheme();

    if (isCompact) {
        return (
            <button
                className={`p-1 rounded-md ${
                    theme === "dark" ? "bg-gray-200 text-indigo-600" : "bg-gray-700 text-indigo-300"
                }`}
                onClick={toggleTheme}
            >
                {theme === "dark" ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                )}
            </button>
        );
    }

    return (
        <div className="flex items-center space-x-2">
            {/* Иконка луны */}
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-colors ${
                theme === "dark" ? "text-indigo-300" : "text-gray-500"
            }`} viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>

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
                    rounded-full peer
                    transition-colors
                    peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500
                    bg-gray-300 peer-checked:bg-indigo-500
                  "
                ></div>
                {/* Ползунок */}
                <div
                    className="
                    absolute left-1 top-1
                    w-4 h-4
                    bg-white
                    rounded-full
                    border border-gray-300
                    transition-all
                    peer-checked:translate-x-6
                    peer-checked:border-white
                  "
                ></div>
            </label>

            {/* Иконка солнца */}
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-colors ${
                theme === "light" ? "text-yellow-400" : "text-gray-500"
            }`} viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
            </svg>
        </div>
    );
}

export default ThemeToggle;