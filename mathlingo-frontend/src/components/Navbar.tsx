import { Link } from "react-router-dom";

function Navbar() {
    return (
        <nav className="bg-gray-800 p-4">
            <div className="container mx-auto flex justify-between">
                <Link to="/" className="text-white text-lg font-bold">MathLingo</Link>
                <div>
                    <Link to="/login" className="text-white px-3">Вход</Link>
                    <Link to="/register" className="text-white px-3">Регистрация</Link>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
