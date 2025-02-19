import { Routes, Route, Navigate } from "react-router-dom";
import { JSX } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import { useAuth } from "./context/AuthContext";

function ProtectedRoute({ children }: { children: JSX.Element }) {
    const { isAuthenticated } = useAuth();

    if (isAuthenticated === null) return <p>Загрузка...</p>; // Ожидание проверки токена

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
