// App.tsx
import AppRoutes from "./routes";
import Navbar from "./components/Navbar";

function App() {
    return (
        <div className="bg-gray-900 dark:bg-white text-gray-100 dark:text-gray-900 min-h-screen flex flex-col transition-colors">
            {/* Шапка */}
            <Navbar />

            {/* Основной контент */}
            <main className="flex-grow container mx-auto px-4 py-6">
                <AppRoutes />
            </main>
        </div>
    );
}

export default App;