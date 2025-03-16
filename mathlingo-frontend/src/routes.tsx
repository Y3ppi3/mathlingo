// routes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { JSX } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import LogoutPage from "./pages/LogoutPage";
// Удален неиспользуемый импорт useAuth

// Импорт компонентов админ-панели
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminTaskForm from "./pages/AdminTaskForm";
import ProtectedRoute from "./components/ProtectedRoute";

// Компонент для защиты маршрутов админа
function AdminProtectedRoute({ children }: { children: JSX.Element }) {
    const isAdmin = localStorage.getItem('adminToken');

    if (!isAdmin) {
        return <Navigate to="/admin/login" />;
    }

    return children;
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />
            <Route path="/logout" element={<LogoutPage />} />

            {/* Маршруты для админ-панели */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
                path="/admin/dashboard"
                element={
                    <AdminProtectedRoute>
                        <AdminDashboard />
                    </AdminProtectedRoute>
                }
            />
            <Route
                path="/admin/task/:taskId"
                element={
                    <AdminProtectedRoute>
                        <AdminTaskForm />
                    </AdminProtectedRoute>
                }
            />
            <Route path="/admin" element={<Navigate to="/admin/login" />} />
        </Routes>
    );
}

export default AppRoutes;