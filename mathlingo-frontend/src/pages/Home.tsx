import { Link } from "react-router-dom";
import { Sigma, Zap, Brain, BarChart2, ArrowRight, GraduationCap } from "lucide-react";

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
}

const features: Feature[] = [
    {
        icon: <Sigma className="w-8 h-8 text-white" />,
        title: "Автогенерация заданий",
        desc: "ИИ генерирует уникальные задачи по пределам, производным, интегралам и дифференциальным уравнениям.",
        color: "from-indigo-500 to-blue-500",
    },
    {
        icon: <Brain className="w-8 h-8 text-white" />,
        title: "Адаптивные тесты",
        desc: "Система анализирует ваши результаты и автоматически подбирает задания оптимальной сложности.",
        color: "from-violet-500 to-purple-500",
    },
    {
        icon: <BarChart2 className="w-8 h-8 text-white" />,
        title: "Детальная статистика",
        desc: "Отслеживайте прогресс по каждому разделу, анализируйте ошибки и получайте персонализированные рекомендации.",
        color: "from-purple-500 to-pink-500",
    },
];

const steps: Step[] = [
    {
        step: "01",
        title: "Создайте аккаунт",
        desc: "Зарегистрируйтесь как студент или преподаватель и настройте профиль под свои цели.",
    },
    {
        step: "02",
        title: "Выберите тему",
        desc: "Укажите раздел математики и желаемый уровень сложности заданий.",
    },
    {
        step: "03",
        title: "Решайте и анализируйте",
        desc: "Решайте задачи, получайте мгновенную проверку и просматривайте детальный разбор ошибок.",
    },
];

const mathExpressions = ["∫₀¹ x² dx = ⅓", "lim(x→0) sin(x)/x = 1", "f'(x) = 2x + 1"];

function Home() {
    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors">

            {/* Декоративные математические символы */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none select-none">
                <span className="absolute top-20 left-10 text-9xl text-gray-200/80 dark:text-slate-800/50 font-serif">∫</span>
                <span className="absolute top-40 right-20 text-8xl text-gray-200/80 dark:text-slate-800/50 font-serif">∑</span>
                <span className="absolute bottom-40 left-20 text-7xl text-gray-200/80 dark:text-slate-800/50 font-serif">∂</span>
                <span className="absolute bottom-20 right-10 text-9xl text-gray-200/80 dark:text-slate-800/50 font-serif">∇</span>
                <span className="absolute top-1/2 left-1/3 text-6xl text-gray-200/60 dark:text-slate-800/30 font-serif">π</span>
                <span className="absolute top-1/3 right-1/3 text-7xl text-gray-200/60 dark:text-slate-800/30 font-serif">∞</span>
            </div>

            {/* Hero */}
            <section className="relative z-10 max-w-5xl mx-auto px-8 pt-28 pb-20 text-center">
                <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-full px-4 py-1.5 text-indigo-600 dark:text-indigo-300 text-sm mb-8 transition-colors">
                    <Zap className="w-4 h-4" />
                    Учите математику весело и эффективно
                </div>

                <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                    <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 bg-clip-text text-transparent">
                        MathLingo
                    </span>
                    <br />
                    <span className="text-gray-900 dark:text-white transition-colors">
                        лучший способ учить
                    </span>
                    <br />
                    <span className="text-gray-900 dark:text-white transition-colors">
                        математику
                    </span>
                </h1>

                <p className="text-lg text-gray-500 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed transition-colors">
                    Система автоматической генерации персонализированных заданий по математике.
                    Адаптивное обучение, детальная аналитика и мгновенная проверка решений.
                </p>

                <div className="flex items-center justify-center gap-4 flex-wrap">
                    <Link
                        to="/register"
                        className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/25"
                    >
                        Начать бесплатно <ArrowRight className="w-5 h-5" />
                    </Link>
                    <Link
                        to="/login"
                        className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-white font-semibold px-8 py-3.5 rounded-xl transition-all"
                    >
                        У меня есть аккаунт
                    </Link>
                </div>

                {/* Math preview */}
                <div className="mt-16 grid grid-cols-3 gap-4 max-w-lg mx-auto opacity-70 dark:opacity-60">
                    {mathExpressions.map((expr) => (
                        <div
                            key={expr}
                            className="bg-gray-100 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-indigo-600 dark:text-indigo-300 font-mono transition-colors"
                        >
                            {expr}
                        </div>
                    ))}
                </div>
            </section>

            {/* Features */}
            <section className="relative z-10 max-w-6xl mx-auto px-8 py-20">
                <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4 transition-colors">
                    Возможности системы
                </h2>
                <p className="text-gray-500 dark:text-slate-400 text-center mb-12 transition-colors">
                    Всё необходимое для эффективного обучения математике
                </p>
                <div className="grid md:grid-cols-3 gap-6">
                    {features.map((f) => (
                        <div
                            key={f.title}
                            className="bg-gray-50 dark:bg-slate-800/50 backdrop-blur border border-gray-200 dark:border-slate-700 rounded-2xl p-6 hover:border-gray-300 dark:hover:border-slate-600 transition-all group"
                        >
                            <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${f.color} mb-4 group-hover:scale-110 transition-transform`}>
                                {f.icon}
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 transition-colors">
                                {f.title}
                            </h3>
                            <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed transition-colors">
                                {f.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* How it works */}
            <section className="relative z-10 max-w-4xl mx-auto px-8 py-20">
                <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4 transition-colors">
                    Как это работает
                </h2>
                <p className="text-gray-500 dark:text-slate-400 text-center mb-12 transition-colors">
                    Три простых шага до эффективного обучения
                </p>
                <div className="grid md:grid-cols-3 gap-8">
                    {steps.map((item) => (
                        <div key={item.step} className="relative text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 mb-4 transition-colors">
                                <span className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
                                    {item.step}
                                </span>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 transition-colors">
                                {item.title}
                            </h3>
                            <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed transition-colors">
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA Banner */}
            <section className="relative z-10 max-w-4xl mx-auto px-8 py-12 mb-12">
                <div className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/10 dark:to-violet-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-10 text-center transition-colors">
                    <GraduationCap className="w-12 h-12 text-indigo-500 dark:text-indigo-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 transition-colors">
                        Готовы начать?
                    </h2>
                    <p className="text-gray-500 dark:text-slate-400 mb-6 transition-colors">
                        Присоединяйтесь к тысячам студентов и преподавателей уже сегодня
                    </p>
                    <Link
                        to="/register"
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/25"
                    >
                        Зарегистрироваться бесплатно <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-gray-200 dark:border-slate-800 py-8 text-center transition-colors">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <Sigma className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                    <span className="font-semibold text-gray-900 dark:text-white transition-colors">
                        MathLingo
                    </span>
                </div>
                <p className="text-gray-400 dark:text-slate-500 text-sm transition-colors">
                    Учите математику бесплатно, весело и эффективно
                </p>
            </footer>

        </div>
    );
}

export default Home;