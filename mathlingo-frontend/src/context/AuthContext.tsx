import { createContext, useContext, useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
    isAuthenticated: boolean | null;
    login: () => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = Cookies.get("token");
        console.log("🔍 Проверка токена:", token);
        setIsAuthenticated(!!token);
    }, []);

    const login = (token: string) => {
        Cookies.set("token", token, { expires: 1, secure: true, sameSite: "Strict" });
        setIsAuthenticated(true);
        navigate("/dashboard");
    };

    const logout = () => {
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
