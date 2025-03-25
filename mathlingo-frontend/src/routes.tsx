// routes.tsx (обновленный)
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { JSX } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import LogoutPage from "./pages/LogoutPage";
import AdventureMapPage from "./pages/AdventureMapPage";
import GamificationPanel from "./components/admin/GamificationPanel";
import GameLauncherPage from "./pages/GameLauncherPage";
import GamePage from "./pages/GamePage";
import ProfilePage from "./pages/ProfilePage";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";

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

// Компонент для перенаправления с task-group на games
function TaskGroupRedirect() {
    const location = useLocation();
    // Извлекаем subjectId из URL
    const subjectId = location.pathname.split('/')[2];

    // Перенаправляем на страницу игр с правильным subjectId
    return <Navigate to={`/subject/${subjectId}/games`} replace />;
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

            {/* Профиль пользователя */}
            <Route
                path="/profile"
                element={
                    <ProtectedRoute>
                        <ProfilePage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/profile/settings"
                element={
                    <ProtectedRoute>
                        <ProfileSettingsPage />
                    </ProtectedRoute>
                }
            />

            {/* Маршруты для геймификации */}
            <Route
                path="/subject/:subjectId/map"
                element={
                    <ProtectedRoute>
                        <AdventureMapPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/subject/:subjectId/task-group/:taskGroupId"
                element={
                    <ProtectedRoute>
                        <TaskGroupRedirect />
                    </ProtectedRoute>
                }
            />

            {/* Новые маршруты для игровых механик */}
            <Route
                path="/subject/:subjectId/games"
                element={
                    <ProtectedRoute>
                        <GameLauncherPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/subject/:subjectId/games/:mechanicType"
                element={
                    <ProtectedRoute>
                        <GameLauncherPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/subject/:subjectId/game/:gameId"
                element={
                    <ProtectedRoute>
                        <GamePage />
                    </ProtectedRoute>
                }
            />

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
            {/* Маршрут для админ-панели геймификации */}
            <Route
                path="/admin/gamification"
                element={
                    <AdminProtectedRoute>
                        <GamificationPanel />
                    </AdminProtectedRoute>
                }
            />
            <Route path="/admin" element={<Navigate to="/admin/login" />} />
        </Routes>
    );
}

export default AppRoutes;