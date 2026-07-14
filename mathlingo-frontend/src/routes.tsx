// routes.tsx (обновленный)
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { JSX, lazy, Suspense } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import LogoutPage from "./pages/LogoutPage";
import AdventureMapPage from "./pages/AdventureMapPage";
import ProfilePage from "./pages/ProfilePage";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

// Низкочастотные экраны (R4) — тоже не нужны в основном бандле.
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

// R4: весь admin-поддерево и игровые компоненты (katex/mathjs/recharts/
// dnd-kit/framer-motion) грузились уже на экране логина — эти маршруты
// не нужны студенту/гостю. React.lazy выносит их в отдельные чанки,
// подгружаемые только при заходе на конкретный маршрут.
const DiagnosticSolver = lazy(() => import("./components/adventure/DiagnosticSolver"));
const GamificationPanel = lazy(() => import("./components/admin/GamificationPanel"));
const GameLauncherPage = lazy(() => import("./pages/GameLauncherPage"));
const GamePage = lazy(() => import("./pages/GamePage"));

const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminLayout = lazy(() => import("./pages/AdminLayout"));
const AdminTaskForm = lazy(() => import("./pages/AdminTaskForm"));
const AdminOverviewPanel = lazy(() => import("./components/admin/AdminOverviewPanel"));
const ContentZonePanel = lazy(() => import("./components/admin/ContentZonePanel"));
const UsersPanel = lazy(() => import("./components/admin/UsersPanel"));
const StaffPanel = lazy(() => import("./components/admin/StaffPanel"));
const AuditLogPanel = lazy(() => import("./components/admin/AuditLogPanel"));
const AiQueuePanel = lazy(() => import("./components/admin/AiQueuePanel"));
const QualityPanel = lazy(() => import("./components/admin/QualityPanel"));
const GameScenariosPanel = lazy(() => import("./components/admin/GameScenariosPanel"));

const RouteFallback = () => (
    <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
);

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
        <Suspense fallback={<RouteFallback />}>
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
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
                <Route path="game-scenarios" element={<GameScenariosPanel />} />
                <Route path="students" element={<UsersPanel />} />
                <Route path="quality" element={<QualityPanel />} />
                <Route path="staff" element={<StaffPanel />} />
                <Route path="audit" element={<AuditLogPanel />} />
            </Route>

            {/* Любой не совпавший путь — дружелюбная 404, а не пустой экран */}
            <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
    );
}

export default AppRoutes;