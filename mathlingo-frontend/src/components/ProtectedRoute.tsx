// src/components/ProtectedRoute.tsx
import { JSX } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children }: { children: JSX.Element }) {
    const { isAuthenticated } = useAuth();

    if (isAuthenticated === null) {
        return <p className="text-center mt-4">Загрузка...</p>;
    }

    return isAuthenticated ? children : <Navigate to="/login" />;
}

export default ProtectedRoute;