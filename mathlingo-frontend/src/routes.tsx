import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { JSX } from "react";


function ProtectedRoute({ children }: { children: JSX.Element }) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const token = Cookies.get("token");
        setIsAuthenticated(!!token);
    }, []);

    if (isAuthenticated === null) return <p>Загрузка...</p>; // Ожидание проверки

    return isAuthenticated ? children : <Navigate to="/login" />;
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        </Routes>
    );
}

export default AppRoutes;
