import { Link } from "react-router-dom";
import { Sigma, Zap, Brain, BarChart2, ArrowRight, GraduationCap } from "lucide-react";
import mascot from "../assets/logo.png";

interface Feature {
    icon: React.ReactNode;
    title: string;
    desc: string;
    color: string;
}

interface Step {
    step: string;
    title: string;
    desc: string;
    color: string;
}

const features: Feature[] = [
    {
        icon: <Sigma className="w-7 h-7 text-white" />,
        title: "Автогенерация заданий",
        desc: "ИИ придумывает уникальные задачи по пределам, производным, интегралам и дифференциальным уравнениям.",
        color: "from-indigo-500 to-blue-500",
    },
    {
        icon: <Brain className="w-7 h-7 text-white" />,
        title: "Адаптивные тесты",
        desc: "Система смотрит на твои результаты и мягко подбирает задания подходящей сложности.",
        color: "from-violet-500 to-purple-500",
    },
    {
        icon: <BarChart2 className="w-7 h-7 text-white" />,
        title: "Понятная статистика",
        desc: "Видишь прогресс по каждому разделу, разбираешь ошибки и получаешь дружелюбные подсказки.",
        color: "from-purple-500 to-pink-500",
    },
];

const steps: Step[] = [
    { step: "1", title: "Создай аккаунт", desc: "Зарегистрируйся и настрой профиль под свои цели.", color: "bg-feather" },
    { step: "2", title: "Выбери тему", desc: "Укажи раздел математики и уровень сложности.", color: "bg-macaw" },
    { step: "3", title: "Решай и расти", desc: "Решай задачи, получай мгновенную проверку и разбор.", color: "bg-fox" },
];

const mathExpressions = ["∫₀¹ x² dx = ⅓", "lim(x→0) sin(x)/x = 1", "f'(x) = 2x + 1"];

function Home() {
    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors">

            {/* Декоративные математические символы */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none select-none">
                <span className="absolute top-24 left-10 text-9xl text-gray-100 dark:text-slate-800/50 font-serif">∫</span>
                <span className="absolute top-40 right-20 text-8xl text-gray-100 dark:text-slate-800/50 font-serif">∑</span>
                <span className="absolute bottom-40 left-20 text-7xl text-gray-100 dark:text-slate-800/40 font-serif">∂</span>
                <span className="absolute bottom-24 right-10 text-9xl text-gray-100 dark:text-slate-800/50 font-serif">∇</span>
            </div>

            {/* Hero */}
            <section className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 pt-28 pb-16">
                <div className="grid lg:grid-cols-2 items-center gap-10 lg:gap-8">
                    {/* Текст */}
                    <div className="text-center lg:text-left order-2 lg:order-1">
                        <div className="inline-flex items-center gap-2 bg-feather/10 border-2 border-feather/30 rounded-full px-4 py-1.5 text-feather-shade dark:text-feather text-sm font-bold mb-6">
                            <Zap className="w-4 h-4" />
                            Учи математику весело и без стресса
                        </div>

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-5 leading-[1.1]">
                            <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 bg-clip-text text-transparent">
                                MathLingo
                            </span>
                            <br />
                            <span className="text-gray-900 dark:text-white">лучший способ учить математику</span>
                        </h1>

                        <p className="text-lg text-gray-500 dark:text-slate-400 max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
                            Персональные задания, адаптивное обучение и мгновенная проверка —
                            в тёплом, спокойном темпе, который тебе подходит.
                        </p>

                        <div className="flex items-center justify-center lg:justify-start gap-3 flex-wrap">
                            <Link
                                to="/register"
                                className="btn-3d bg-brand hover:bg-brand-dark border-brand-deep text-white text-lg px-8 py-3.5 focus-visible:ring-brand-light"
                            >
                                Начать бесплатно <ArrowRight className="w-5 h-5" />
                            </Link>
                            <Link
                                to="/login"
                                className="btn-3d bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-white text-lg px-8 py-3.5 focus-visible:ring-gray-300"
                            >
                                У меня есть аккаунт
                            </Link>
                        </div>
                    </div>

                    {/* Маскот с репликой */}
                    <div className="order-1 lg:order-2 flex flex-col items-center">
                        <div className="relative">
                            {/* Реплика */}
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 lg:left-auto lg:right-0 lg:translate-x-0 bg-white dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 rounded-2xl px-4 py-2 shadow-card whitespace-nowrap z-10">
                                <span className="text-sm font-bold text-gray-700 dark:text-slate-200">Привет! Порешаем? 🐾</span>
                                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-slate-800 border-b-2 border-r-2 border-gray-100 dark:border-slate-700 rotate-45" />
                            </div>
                            {/* Мягкое свечение под маскотом */}
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/20 to-violet-400/20 rounded-full blur-3xl scale-90" />
                            <img
                                src={mascot}
                                alt="Маскот MathLingo"
                                className="relative w-56 h-56 sm:w-72 sm:h-72 object-contain animate-bob drop-shadow-xl"
                            />
                        </div>

                        {/* Мини-превью формул */}
                        <div className="grid grid-cols-3 gap-2 mt-6 max-w-md w-full opacity-90">
                            {mathExpressions.map((expr) => (
                                <div
                                    key={expr}
                                    className="bg-gray-50 dark:bg-slate-800/80 border-2 border-gray-100 dark:border-slate-700 rounded-xl px-2.5 py-2 text-[11px] text-center text-indigo-600 dark:text-indigo-300 font-mono"
                                >
                                    {expr}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="relative z-10 bg-gray-50 dark:bg-slate-800/30 py-20 transition-colors">
                <div className="max-w-6xl mx-auto px-6 sm:px-8">
                    <h2 className="text-3xl font-extrabold text-center text-gray-900 dark:text-white mb-3">
                        Что внутри
                    </h2>
                    <p className="text-gray-500 dark:text-slate-400 text-center mb-12">
                        Всё, чтобы учиться в удовольствие
                    </p>
                    <div className="grid md:grid-cols-3 gap-6">
                        {features.map((f) => (
                            <div key={f.title} className="card-interactive p-6 group">
                                <div className={`inline-flex p-3.5 rounded-2xl bg-gradient-to-br ${f.color} mb-4 group-hover:scale-110 group-hover:-rotate-3 transition-transform`}>
                                    {f.icon}
                                </div>
                                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">
                                    {f.title}
                                </h3>
                                <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed">
                                    {f.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="relative z-10 max-w-4xl mx-auto px-6 sm:px-8 py-20">
                <h2 className="text-3xl font-extrabold text-center text-gray-900 dark:text-white mb-3">
                    Как это работает
                </h2>
                <p className="text-gray-500 dark:text-slate-400 text-center mb-12">
                    Три простых шага
                </p>
                <div className="grid md:grid-cols-3 gap-8">
                    {steps.map((item) => (
                        <div key={item.step} className="text-center">
                            <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${item.color} text-white text-2xl font-extrabold mb-4 shadow-card`}>
                                {item.step}
                            </div>
                            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">
                                {item.title}
                            </h3>
                            <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed">
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA Banner */}
            <section className="relative z-10 max-w-4xl mx-auto px-6 sm:px-8 pb-16">
                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl p-10 text-center shadow-card-hover">
                    <img src={mascot} alt="" className="absolute -right-6 -bottom-6 w-32 h-32 object-contain opacity-30 select-none pointer-events-none" />
                    <GraduationCap className="w-12 h-12 text-white mx-auto mb-4" />
                    <h2 className="text-2xl font-extrabold text-white mb-3">
                        Готов начать?
                    </h2>
                    <p className="text-indigo-100 mb-6">
                        Присоединяйся — это бесплатно, и никакого давления
                    </p>
                    <Link
                        to="/register"
                        className="btn-3d bg-white hover:bg-gray-50 border-gray-200 text-indigo-600 text-lg px-8 py-3.5 focus-visible:ring-white"
                    >
                        Зарегистрироваться <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t-2 border-gray-100 dark:border-slate-800 py-8 text-center transition-colors">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <img src={mascot} alt="" className="w-6 h-6 object-contain" />
                    <span className="font-extrabold text-gray-900 dark:text-white">MathLingo</span>
                </div>
                <p className="text-gray-400 dark:text-slate-500 text-sm">
                    Учи математику бесплатно, тепло и в своём темпе
                </p>
            </footer>

        </div>
    );
}

export default Home;
