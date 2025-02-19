import { createContext, useContext, useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
    isAuthenticated: boolean | null;
    login: (token: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const checkAuth = async () => {
            const token = Cookies.get("token");
            if (token) {
                try {
                    // Проверяем авторизацию с использованием токена в заголовке Authorization
                    const response = await fetch("http://127.0.0.1:8000/api/me", {
                        method: "GET",
                        credentials: "include",  // Куки будут переданы автоматически
                        headers: {
                            "Authorization": `Bearer ${token}`,  // Передаем токен в заголовке
                            "Content-Type": "application/json",
                        },
                    });

                    if (response.ok) {
                        setIsAuthenticated(true);
                    } else {
                        setIsAuthenticated(false);
                    }
                } catch (error) {
                    console.error("Ошибка проверки авторизации:", error);
                    setIsAuthenticated(false);
                }
            } else {
                setIsAuthenticated(false); // Если токен отсутствует в куках, то считаем, что пользователь не авторизован
            }
        };

        checkAuth();
    }, []); // Вызываем один раз при монтировании компонента

    const login = (token: string) => {
        // Сохраняем токен в куки
        Cookies.set("token", token, { expires: 1, secure: true, sameSite: "Strict" });
        setIsAuthenticated(true);
        navigate("/dashboard");
    };

    const logout = () => {
        // Удаляем токен из куков при выходе
        Cookies.remove("token");
        setIsAuthenticated(false);
        navigate("/login");
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
