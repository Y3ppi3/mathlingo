import { Link } from "react-router-dom";

function Home() {
    return (
        // Увеличиваем отступ сверху, чтобы контент оказался ниже на странице
        <div className="pt-72 min-h-screen bg-gray-900 text-white dark:bg-white dark:text-gray-900 transition-colors">
            <div className="max-w-xl mx-auto p-8 text-center">
                <h1 className="text-4xl sm:text-5xl font-bold mb-4">
                    Учите математику бесплатно, весело и эффективно!
                </h1>
                <p className="text-lg mb-8">
                    Добро пожаловать в <span className="font-bold">MathLingo</span>! Изучайте и практикуйтесь...
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                        to="/register"
                        className="bg-indigo-500 text-white px-6 py-3 rounded-md hover:bg-indigo-400 transition-colors hover:animate-button-pulse"
                    >
                        Начать
                    </Link>
                    <Link
                        to="/login"
                        className="border border-indigo-500 text-indigo-300 px-6 py-3 rounded-md hover:bg-indigo-500 hover:text-white transition-colors hover:animate-button-pulse"
                    >
                        У меня уже есть аккаунт
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Home;
