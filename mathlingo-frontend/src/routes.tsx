// routes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { JSX } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import LogoutPage from "./pages/LogoutPage";
// Импорт компонентов для геймификации
import AdventureMapPage from "./pages/AdventureMapPage";
import TaskSolverPage from "./pages/TaskSolverPage";
import GamificationPanel from "./components/admin/GamificationPanel";
// Импорт новых страниц для игровых механик
import GameLauncherPage from "./pages/GameLauncherPage";
import GamePage from "./pages/GamePage";

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
                        <TaskSolverPage />
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