// Обновленный AuthContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
    isAuthenticated: boolean | null;
    login: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Получаем базовый URL API из переменной окружения
const API_URL = import.meta.env.VITE_API_URL;

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch(`${API_URL}/api/me`, {
                    method: "GET",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
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
        };

        checkAuth();
    }, []);

    const login = async (): Promise<void> => {
        return new Promise<void>((resolve) => {
            setIsAuthenticated(true);
            // Используем setTimeout, чтобы дать состоянию обновиться перед навигацией
            setTimeout(() => {
                resolve();
            }, 100);
        });
    };

    const logout = async (): Promise<void> => {
        try {
            await fetch(`${API_URL}/api/logout/`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
            });
            setIsAuthenticated(false);
            navigate("/login");
        } catch (error) {
            console.error("Ошибка при выходе:", error);
            // Даже при ошибке, считаем пользователя вышедшим
            setIsAuthenticated(false);
            navigate("/login");
        }
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