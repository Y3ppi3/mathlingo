// App.tsx
import { useLocation } from 'react-router-dom';
import AppRoutes from './routes';
import Navbar from './components/layout/Navbar';

function App() {
    const { pathname } = useLocation();

    // На страницах /admin/* Navbar не нужен —
    // у AdminLogin и AdminLayout есть собственные шапки
    const hideNavbar = pathname.startsWith('/admin');

    return (
        <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen flex flex-col transition-colors">
            {!hideNavbar && <Navbar />}
            <main className="flex-grow">
                <AppRoutes />
            </main>
        </div>
    );
}

export default App;