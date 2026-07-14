import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const LogoutPage = () => {
    const { logout } = useAuth();

    useEffect(() => {
        logout();
    }, []);

    return (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center transition-colors">
            <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Выход...
            </div>
        </div>
    );
};

export default LogoutPage;
