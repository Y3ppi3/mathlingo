import { AuthProvider } from "./context/AuthContext"; // Контекст авторизации
import AppRoutes from "./routes";
import Navbar from "./components/Navbar";

function App() {
    return (
        <AuthProvider>
            <Navbar />
            <AppRoutes />
        </AuthProvider>
    );
}

export default App;
