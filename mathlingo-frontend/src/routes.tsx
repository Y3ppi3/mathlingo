// routes.tsx (обновленный)
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { JSX } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import LogoutPage from "./pages/LogoutPage";
import AdventureMapPage from "./pages/AdventureMapPage";
import DiagnosticSolver from "./components/adventure/DiagnosticSolver";
import GamificationPanel from "./components/admin/GamificationPanel";
import GameLauncherPage from "./pages/GameLauncherPage";
import GamePage from "./pages/GamePage";
import ProfilePage from "./pages/ProfilePage";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";

import AdminLogin from "./pages/AdminLogin";
import AdminLayout from "./pages/AdminLayout";
import AdminTaskForm from "./pages/AdminTaskForm";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminOverviewPanel from "./components/admin/AdminOverviewPanel";
import ContentZonePanel from "./components/admin/ContentZonePanel";
import UsersPanel from "./components/admin/UsersPanel";
import StaffPanel from "./components/admin/StaffPanel";
import AuditLogPanel from "./components/admin/AuditLogPanel";
import StubZonePanel from "./components/admin/StubZonePanel";
import AiQueuePanel from "./components/admin/AiQueuePanel";

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

            {/* Диагностика по теме (R2 task 3) */}
            <Route
                path="/subject/:subjectId/skill/:skillId/diagnostic"
                element={
                    <ProtectedRoute>
                        <DiagnosticSolver />
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

            {/* Маршруты для админ-панели ("God Mode" — см. docs/roadmap/product-technical-plan.md, R1 §3) */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
                path="/admin/task/:taskId"
                element={
                    <AdminProtectedRoute>
                        <AdminTaskForm />
                    </AdminProtectedRoute>
                }
            />
            {/* Обратная совместимость со старыми путями */}
            <Route path="/admin/dashboard" element={<Navigate to="/admin/overview" replace />} />
            <Route path="/admin/gamification" element={<Navigate to="/admin/games" replace />} />

            <Route
                path="/admin"
                element={
                    <AdminProtectedRoute>
                        <AdminLayout />
                    </AdminProtectedRoute>
                }
            >
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<AdminOverviewPanel />} />
                <Route path="content" element={<ContentZonePanel />} />
                <Route path="ai-queue" element={<AiQueuePanel />} />
                <Route path="games" element={<GamificationPanel />} />
                <Route path="students" element={<UsersPanel />} />
                <Route
                    path="quality"
                    element={
                        <StubZonePanel
                            title="Аналитика качества"
                            availableFrom="R2"
                            description="Точность, время решения, жалобы и оценки преподавателей по AI-сгенерированным заданиям."
                        />
                    }
                />
                <Route path="staff" element={<StaffPanel />} />
                <Route path="audit" element={<AuditLogPanel />} />
            </Route>
        </Routes>
    );
}

export default AppRoutes;