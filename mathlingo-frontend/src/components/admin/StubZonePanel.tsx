// src/components/admin/StubZonePanel.tsx
interface StubZonePanelProps {
    title: string;
    availableFrom: string; // напр. "R2" — см. docs/roadmap/product-technical-plan.md
    description: string;
}

// Заглушка для зон God Mode, чья реализация запланирована на будущий релиз
// (AI-очередь, аналитика качества — R2/R3). Не пустая страница, а понятное
// объяснение "почему тут пусто" вместо молчаливого 404-подобного вида.
const StubZonePanel = ({ title, availableFrom, description }: StubZonePanelProps) => (
    <div className="p-10 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">{description}</p>
        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            Доступно с {availableFrom}
        </span>
    </div>
);

export default StubZonePanel;
