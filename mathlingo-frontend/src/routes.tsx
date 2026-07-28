// routes.tsx (обновленный)
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
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
const AccountDeactivatedPage = lazy(() => import("./pages/AccountDeactivatedPage"));

// R4: весь admin-поддерево и игровые компоненты (katex/mathjs/recharts/
// dnd-kit/framer-motion) грузились уже на экране логина — эти маршруты
// не нужны студенту/гостю. React.lazy выносит их в отдельные чанки,
// подгружаемые только при заходе на конкретный маршрут.
const DiagnosticSolver = lazy(() => import("./components/adventure/DiagnosticSolver"));
const GamificationPanel = lazy(() => import("./components/admin/GamificationPanel"));
const GameLauncherPage = lazy(() => import("./pages/GameLauncherPage"));
const GamePage = lazy(() => import("./pages/GamePage"));
// Матричные мини-игры (Фаза 0) — отдельный хаб верхнего уровня /games, не
// привязанный к subject: семейство живёт своим набором игр вне subject-навигации.
const GamesHubPage = lazy(() => import("./pages/GamesHubPage"));
const MatrixGameStubPage = lazy(() => import("./pages/MatrixGameStubPage"));
const GaussJordanGamePage = lazy(() => import("./pages/GaussJordanGamePage"));
const EigenArrowGamePage = lazy(() => import("./pages/EigenArrowGamePage"));
const QuizPage = lazy(() => import("./pages/QuizPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));

// Школьные игры (Ф4) — живут на /games/{id} через InternalGameRoute.
const BalanceScalesGamePage = lazy(() => import("./pages/BalanceScalesGamePage"));
const NumberLineGamePage = lazy(() => import("./pages/NumberLineGamePage"));
const SpeedMathGamePage = lazy(() => import("./pages/SpeedMathGamePage"));

// Курс подготовки к ЕГЭ/ОГЭ (Ф3): карта курса по номерам заданий + тренажёр.
const ExamCoursePage = lazy(() => import("./pages/ExamCoursePage"));
const ExamTrainerPage = lazy(() => import("./pages/ExamTrainerPage"));

// Платформа репетиторов (Фаза 1): маркетплейс + кабинет репетитора.
const TutorsMarketplacePage = lazy(() => import("./pages/TutorsMarketplacePage"));
const TutorDashboardPage = lazy(() => import("./pages/TutorDashboardPage"));
// Фаза 2: прогресс ученика глазами репетитора.
const TutorStudentProgressPage = lazy(() => import("./pages/TutorStudentProgressPage"));
// Фаза 4: просмотр собственного материала/задачи репетитора.
const TutorMaterialPage = lazy(() => import("./pages/TutorMaterialPage"));

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
const GamesAnalyticsPanel = lazy(() => import("./components/admin/GamesAnalyticsPanel"));
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

// Диспетчер игр, живущих на внутреннем маршруте /games/{id} (launch.kind =
// "internal"): матричные (Гаусс-Жордан, «Стрелка Судьбы») и школьные (Ф4).
// Заглушка остаётся запасным вариантом на случай будущих незаконченных game_id.
function InternalGameRoute() {
    const { gameId } = useParams<{ gameId: string }>();
    if (gameId === 'gauss_jordan') return <GaussJordanGamePage />;
    if (gameId === 'eigen_arrow') return <EigenArrowGamePage />;
    if (gameId === 'balance-scales') return <BalanceScalesGamePage />;
    if (gameId === 'number-line') return <NumberLineGamePage />;
    if (gameId === 'speed-math') return <SpeedMathGamePage />;
    return <MatrixGameStubPage />;
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
            <Route path="/account-deactivated" element={<AccountDeactivatedPage />} />
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

            {/* Курс ЕГЭ/ОГЭ (Ф3) */}
            <Route
                path="/exam"
                element={
                    <ProtectedRoute>
                        <ExamCoursePage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/exam/train"
                element={
                    <ProtectedRoute>
                        <ExamTrainerPage />
                    </ProtectedRoute>
                }
            />

            {/* Платформа репетиторов (Фаза 1) */}
            <Route
                path="/tutors"
                element={
                    <ProtectedRoute>
                        <TutorsMarketplacePage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/tutors/me"
                element={
                    <ProtectedRoute>
                        <TutorDashboardPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/tutors/students/:studentId"
                element={
                    <ProtectedRoute>
                        <TutorStudentProgressPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/tutors/material/:id"
                element={
                    <ProtectedRoute>
                        <TutorMaterialPage />
                    </ProtectedRoute>
                }
            />

            {/* Матричные мини-игры (Фаза 0): хаб верхнего уровня + заглушки игр */}
            <Route
                path="/games"
                element={
                    <ProtectedRoute>
                        <GamesHubPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/games/quiz/:quizType"
                element={
                    <ProtectedRoute>
                        <QuizPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/games/leaderboard"
                element={
                    <ProtectedRoute>
                        <LeaderboardPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/games/:gameId"
                element={
                    <ProtectedRoute>
                        <InternalGameRoute />
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
                <Route path="games-analytics" element={<GamesAnalyticsPanel />} />
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