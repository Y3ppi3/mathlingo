import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const LogoutPage = () => {
    const { logout } = useAuth();

    useEffect(() => {
        logout();
    }, []);

    return <div>Выход...</div>;
};

export default LogoutPage;
