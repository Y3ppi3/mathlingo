import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Navbar() {
    const { isAuthenticated, logout } = useAuth();

    return (
        <nav className="bg-gray-800 p-4">
            <div className="container mx-auto flex justify-between">
                <Link to="/" className="text-white text-lg font-bold">
                    MathLingo
                </Link>
                <div>
                    {isAuthenticated ? (
                        <button
                            onClick={logout}
                            className="text-white px-3 focus:outline-none"
                        >
                            Выйти
                        </button>
                    ) : (
                        <>
                            <Link to="/login" className="text-white px-3">
                                Вход
                            </Link>
                            <Link to="/register" className="text-white px-3">
                                Регистрация
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
