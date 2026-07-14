// src/components/admin/GameScenariosPanel.tsx
import { useEffect, useState } from 'react';
import {
    fetchGameScenarios, createGameScenario, updateGameScenario,
    fetchGameScenarioChecklist, checkGameScenarioChecklistItem,
    previewGameScenario, publishGameScenario, archiveGameScenario,
    fetchSkills,
    GameScenario, GameScenarioTemplateKey, GameScenarioStatus,
    GameScenarioChecklistItem, CHECKLIST_ITEM_KEYS, Skill,
} from '../../api/adminApi';
import {
    DerivFallGameConfig, DerivFallProblemConfig,
    IntegralBuilderGameConfig, IntegralBuilderProblemConfig,
    MathLabGameConfig, MathLabTaskConfig,
    mapIntegralBuilderProblems, mapMathLabTasks, mapLimitsTasks, mapSeriesTasks, mapSlopeFieldTasks,
} from '../../api/studentApi';
import { adminHasRole } from '../../utils/auth';
import DerivFall from '../games/DerivFall';
import IntegralBuilder from '../games/IntegralBuilder';
import MathLab from '../games/MathLab';
import LimitsApproach from '../games/LimitsApproach';
import SeriesFilling from '../games/SeriesFilling';
import SlopeField from '../games/SlopeField';

// R3 task 5: конструктор игровых сценариев без кода — форма конфигурации
// поверх контракта GameConfigSchema (см. mathlingo-backend/app/services/
// game_config.py) + чек-лист + live-предпросмотр "от лица ученика" (тот же
// компонент игры, что видит студент — не имитация). Backend (CRUD, схема,
// preview/publish-гейт) — R3 task 2, здесь только UI поверх него.

const inputCls = "w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";
const labelCls = "block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors";
const btnPrimary = "px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary = "px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white rounded-xl text-sm font-medium transition-colors";
const btnDanger = "px-4 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium transition-colors";
const btnTiny = "px-2.5 py-1 text-xs rounded-lg font-medium transition-colors";

const TEMPLATE_LABEL: Record<GameScenarioTemplateKey, string> = {
    derivfall: 'DerivFall (падение)',
    integralbuilder: 'IntegralBuilder (сборка)',
    mathlab: 'MathLab (лаборатория)',
};

const MATHLAB_MODE_LABEL: Record<'derivatives' | 'integrals' | 'limits' | 'series' | 'slopefield', string> = {
    derivatives: 'Производные',
    integrals: 'Интегралы',
    limits: 'Приближение (пределы)',
    series: 'Наполнение (ряды)',
    slopefield: 'Наклон (диф. уравнения)',
};

const STATUS_LABEL: Record<GameScenarioStatus, string> = {
    draft: 'Черновик', published: 'Опубликовано', archived: 'В архиве',
};

const STATUS_COLOR: Record<GameScenarioStatus, string> = {
    draft: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    published: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
    archived: 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
};

const CHECKLIST_LABEL: Record<string, string> = {
    texts_correct: 'Тексты корректны',
    no_placeholders: 'Нет плейсхолдеров',
    katex_renders: 'KaTeX рендерится',
};

let rowIdCounter = 0;
const genRowId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(rowIdCounter++).toString(36)}`;

const errorDetail = (err: unknown, fallback: string): string =>
    (err instanceof Error && err.message) || fallback;

// ── Модальное окно (тот же паттерн, что в GamificationPanel.tsx) ───────────────
const Modal = ({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) => (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
        <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col transition-colors`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 transition-colors">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white transition-colors">{title}</h3>
                <button
                    style={{ padding: '0.25rem' }}
                    onClick={onClose}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-lg leading-none"
                >✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
        </div>
    </div>
);

// ── Список строк-строк (options/solution_pieces/distractors/hints) ─────────────
const StringListEditor = ({ label, values, onChange, placeholder }: {
    label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) => (
    <div>
        <label className={labelCls}>{label}</label>
        <div className="space-y-1.5">
            {values.map((v, i) => (
                <div key={i} className="flex gap-2">
                    <input
                        className={inputCls}
                        value={v}
                        placeholder={placeholder}
                        onChange={e => onChange(values.map((x, j) => j === i ? e.target.value : x))}
                    />
                    <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} className="w-9 flex-shrink-0 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">✕</button>
                </div>
            ))}
            <button type="button" onClick={() => onChange([...values, ''])} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">+ Добавить</button>
        </div>
    </div>
);

// ── Формы конфигурации по шаблонам ──────────────────────────────────────────────

type FormConfig =
    | { template_key: 'derivfall'; difficulty: number; time_limit: number; problems: DerivFallProblemConfig[] }
    | { template_key: 'integralbuilder'; initial_difficulty: number; time_limit: number; problems: IntegralBuilderProblemConfig[] }
    | { template_key: 'mathlab'; mode: 'derivatives' | 'integrals' | 'limits' | 'series' | 'slopefield'; difficulty: number; tasks: MathLabTaskConfig[] };

const emptyConfig = (key: GameScenarioTemplateKey): FormConfig => {
    if (key === 'derivfall') return { template_key: 'derivfall', difficulty: 3, time_limit: 60, problems: [] };
    if (key === 'integralbuilder') return { template_key: 'integralbuilder', initial_difficulty: 3, time_limit: 300, problems: [] };
    return { template_key: 'mathlab', mode: 'derivatives', difficulty: 3, tasks: [] };
};

// Задачи derivatives/integrals (свободный ввод, options необязательны) и
// limits/series/slopefield (обязательный выбор из options + строгий type,
// см. game_config.py _limits_and_series_tasks_are_multiple_choice)
// структурно разные — новая задача заполняется под тот режим, что выбран
// сейчас.
const emptyMathLabTask = (mode: 'derivatives' | 'integrals' | 'limits' | 'series' | 'slopefield'): MathLabTaskConfig => {
    if (mode === 'limits') return { id: genRowId('t'), type: 'limit', question: '', function_expression: '', correct_answer: '', options: ['', ''], difficulty: 3, hints: [], approach_x: '' };
    if (mode === 'series') return { id: genRowId('t'), type: 'series', question: '', function_expression: '', correct_answer: '', options: ['', ''], difficulty: 3, hints: [] };
    if (mode === 'slopefield') return { id: genRowId('t'), type: 'slope', question: '', function_expression: '', correct_answer: '', options: ['', ''], difficulty: 3, hints: [], start_point: [0, 0] };
    return { id: genRowId('t'), type: 'calculate', question: '', function_expression: '', correct_answer: '', options: [], difficulty: 3, hints: [] };
};

const DerivFallForm = ({ config, onChange }: { config: Extract<FormConfig, { template_key: 'derivfall' }>; onChange: (c: FormConfig) => void }) => (
    <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Сложность (1–5)</label><input type="number" min={1} max={5} className={inputCls} value={config.difficulty} onChange={e => onChange({ ...config, difficulty: parseInt(e.target.value) || 1 })} /></div>
            <div><label className={labelCls}>Время (сек)</label><input type="number" min={10} max={1800} className={inputCls} value={config.time_limit} onChange={e => onChange({ ...config, time_limit: parseInt(e.target.value) || 60 })} /></div>
        </div>
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className={labelCls}>Задачи ({config.problems.length})</label>
                <button type="button" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    onClick={() => onChange({ ...config, problems: [...config.problems, { id: genRowId('d'), problem: '', options: ['', ''], answer: '', difficulty: 'easy' }] })}
                >+ Добавить задачу</button>
            </div>
            {config.problems.map((p, i) => (
                <div key={p.id} className="p-3 border border-gray-200 dark:border-gray-600 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500">#{i + 1}</span>
                        <button type="button" onClick={() => onChange({ ...config, problems: config.problems.filter((_, j) => j !== i) })} className="text-xs text-red-500 hover:underline">Удалить</button>
                    </div>
                    <div><label className={labelCls}>Условие (LaTeX)</label><input className={inputCls} value={p.problem} placeholder="(x^2)'" onChange={e => onChange({ ...config, problems: config.problems.map((x, j) => j === i ? { ...x, problem: e.target.value } : x) })} /></div>
                    <StringListEditor label="Варианты ответа (LaTeX)" values={p.options} placeholder="2x" onChange={v => onChange({ ...config, problems: config.problems.map((x, j) => j === i ? { ...x, options: v } : x) })} />
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Правильный ответ</label>
                            <select className={inputCls} value={p.answer} onChange={e => onChange({ ...config, problems: config.problems.map((x, j) => j === i ? { ...x, answer: e.target.value } : x) })}>
                                <option value="">— выберите из вариантов —</option>
                                {p.options.filter(Boolean).map((opt, k) => <option key={k} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Сложность задачи</label>
                            <select className={inputCls} value={p.difficulty} onChange={e => onChange({ ...config, problems: config.problems.map((x, j) => j === i ? { ...x, difficulty: e.target.value as DerivFallProblemConfig['difficulty'] } : x) })}>
                                <option value="easy">Лёгкая</option><option value="medium">Средняя</option><option value="hard">Сложная</option>
                            </select>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const IntegralBuilderForm = ({ config, onChange }: { config: Extract<FormConfig, { template_key: 'integralbuilder' }>; onChange: (c: FormConfig) => void }) => (
    <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Начальная сложность (1–5)</label><input type="number" min={1} max={5} className={inputCls} value={config.initial_difficulty} onChange={e => onChange({ ...config, initial_difficulty: parseInt(e.target.value) || 1 })} /></div>
            <div><label className={labelCls}>Время (сек)</label><input type="number" min={10} max={1800} className={inputCls} value={config.time_limit} onChange={e => onChange({ ...config, time_limit: parseInt(e.target.value) || 300 })} /></div>
        </div>
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className={labelCls}>Задачи ({config.problems.length})</label>
                <button type="button" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    onClick={() => onChange({ ...config, problems: [...config.problems, { id: genRowId('i'), question: '', solution_pieces: [''], distractors: [], difficulty: 'easy' }] })}
                >+ Добавить задачу</button>
            </div>
            {config.problems.map((p, i) => (
                <div key={p.id} className="p-3 border border-gray-200 dark:border-gray-600 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500">#{i + 1}</span>
                        <button type="button" onClick={() => onChange({ ...config, problems: config.problems.filter((_, j) => j !== i) })} className="text-xs text-red-500 hover:underline">Удалить</button>
                    </div>
                    <div><label className={labelCls}>Условие</label><input className={inputCls} value={p.question} placeholder="∫ x² dx" onChange={e => onChange({ ...config, problems: config.problems.map((x, j) => j === i ? { ...x, question: e.target.value } : x) })} /></div>
                    <StringListEditor label="Фрагменты правильного решения (по порядку)" values={p.solution_pieces} placeholder="x³/3" onChange={v => onChange({ ...config, problems: config.problems.map((x, j) => j === i ? { ...x, solution_pieces: v } : x) })} />
                    <StringListEditor label="Отвлекающие фрагменты" values={p.distractors} placeholder="x²/2" onChange={v => onChange({ ...config, problems: config.problems.map((x, j) => j === i ? { ...x, distractors: v } : x) })} />
                    <div>
                        <label className={labelCls}>Сложность задачи</label>
                        <select className={inputCls} value={p.difficulty} onChange={e => onChange({ ...config, problems: config.problems.map((x, j) => j === i ? { ...x, difficulty: e.target.value as IntegralBuilderProblemConfig['difficulty'] } : x) })}>
                            <option value="easy">Лёгкая</option><option value="medium">Средняя</option><option value="hard">Сложная</option>
                        </select>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const MathLabForm = ({ config, onChange }: { config: Extract<FormConfig, { template_key: 'mathlab' }>; onChange: (c: FormConfig) => void }) => {
    const isChoiceMode = config.mode === 'limits' || config.mode === 'series' || config.mode === 'slopefield';

    const handleModeChange = (mode: typeof config.mode) => {
        // derivatives/integrals (свободный ввод) и limits/series (строгий
        // MC-формат) несовместимы по форме задачи — при смене режима
        // безопаснее начать список задач с нуля, чем тащить старые записи,
        // которые не пройдут валидацию бэкенда (game_config.py).
        onChange({ ...config, mode, tasks: [] });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Режим</label>
                    <select className={inputCls} value={config.mode} onChange={e => handleModeChange(e.target.value as typeof config.mode)}>
                        {(Object.keys(MATHLAB_MODE_LABEL) as (typeof config.mode)[]).map(m => <option key={m} value={m}>{MATHLAB_MODE_LABEL[m]}</option>)}
                    </select>
                </div>
                <div><label className={labelCls}>Сложность (1–5)</label><input type="number" min={1} max={5} className={inputCls} value={config.difficulty} onChange={e => onChange({ ...config, difficulty: parseInt(e.target.value) || 1 })} /></div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
                {config.mode === 'limits' && 'Ответ всегда выбор из вариантов — укажите точку приближения и варианты, один из которых совпадает с правильным ответом.'}
                {config.mode === 'series' && 'Ответ всегда выбор из вариантов — укажите формулу общего члена ряда a(n) (переменная n, не x).'}
                {config.mode === 'slopefield' && 'Ответ всегда выбор из вариантов — укажите правую часть уравнения f(x,y), точку старта и явные формулы y(x) кандидатных кривых, одна из которых совпадает с правильным ответом.'}
                {!isChoiceMode && 'Вкладка «Графики» (живой калькулятор) конструктору не подчиняется — только вкладка «Задачи».'}
            </p>
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className={labelCls}>Задачи ({config.tasks.length})</label>
                    <button type="button" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                        onClick={() => onChange({ ...config, tasks: [...config.tasks, emptyMathLabTask(config.mode)] })}
                    >+ Добавить задачу</button>
                </div>
                {config.tasks.map((t, i) => (
                    <div key={t.id} className="p-3 border border-gray-200 dark:border-gray-600 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">#{i + 1}</span>
                            <button type="button" onClick={() => onChange({ ...config, tasks: config.tasks.filter((_, j) => j !== i) })} className="text-xs text-red-500 hover:underline">Удалить</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {!isChoiceMode && (
                                <div>
                                    <label className={labelCls}>Тип</label>
                                    <select className={inputCls} value={t.type} onChange={e => onChange({ ...config, tasks: config.tasks.map((x, j) => j === i ? { ...x, type: e.target.value as MathLabTaskConfig['type'] } : x) })}>
                                        <option value="calculate">calculate</option><option value="find">find</option><option value="analyze">analyze</option>
                                    </select>
                                </div>
                            )}
                            <div><label className={labelCls}>Сложность задачи (1–5)</label><input type="number" min={1} max={5} className={inputCls} value={t.difficulty} onChange={e => onChange({ ...config, tasks: config.tasks.map((x, j) => j === i ? { ...x, difficulty: parseInt(e.target.value) || 1 } : x) })} /></div>
                        </div>
                        <div>
                            <label className={labelCls}>Вопрос</label>
                            <input
                                className={inputCls}
                                value={t.question}
                                placeholder={config.mode === 'series' ? 'Сходится ли ряд с общим членом a(n)?' : config.mode === 'limits' ? 'Найдите предел функции при x → 2' : config.mode === 'slopefield' ? 'Какая кривая — решение через отмеченную точку?' : "Найдите производную: y'(x) = x³"}
                                onChange={e => onChange({ ...config, tasks: config.tasks.map((x, j) => j === i ? { ...x, question: e.target.value } : x) })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>{config.mode === 'series' ? 'Формула общего члена a(n)' : config.mode === 'slopefield' ? 'Правая часть f(x,y) в dy/dx = f(x,y)' : 'Выражение функции'}</label>
                                <input className={inputCls} value={t.function_expression} placeholder={config.mode === 'series' ? '1/2^n' : config.mode === 'slopefield' ? 'x - y' : 'x^3'} onChange={e => onChange({ ...config, tasks: config.tasks.map((x, j) => j === i ? { ...x, function_expression: e.target.value } : x) })} />
                            </div>
                            {config.mode === 'limits' ? (
                                <div>
                                    <label className={labelCls}>Точка приближения</label>
                                    <input className={inputCls} value={t.approach_x ?? ''} placeholder="2 / infinity / -infinity" onChange={e => onChange({ ...config, tasks: config.tasks.map((x, j) => j === i ? { ...x, approach_x: e.target.value } : x) })} />
                                </div>
                            ) : config.mode === 'slopefield' ? (
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelCls}>Старт x₀</label>
                                        <input type="number" className={inputCls} value={t.start_point?.[0] ?? 0} onChange={e => onChange({ ...config, tasks: config.tasks.map((x, j) => j === i ? { ...x, start_point: [parseFloat(e.target.value) || 0, x.start_point?.[1] ?? 0] } : x) })} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Старт y₀</label>
                                        <input type="number" className={inputCls} value={t.start_point?.[1] ?? 0} onChange={e => onChange({ ...config, tasks: config.tasks.map((x, j) => j === i ? { ...x, start_point: [x.start_point?.[0] ?? 0, parseFloat(e.target.value) || 0] } : x) })} />
                                    </div>
                                </div>
                            ) : !isChoiceMode ? (
                                <div><label className={labelCls}>Правильный ответ</label><input className={inputCls} value={t.correct_answer} placeholder="3x^2" onChange={e => onChange({ ...config, tasks: config.tasks.map((x, j) => j === i ? { ...x, correct_answer: e.target.value } : x) })} /></div>
                            ) : null}
                        </div>
                        <StringListEditor label={isChoiceMode ? (config.mode === 'slopefield' ? 'Варианты ответа — формулы y(x) кандидатных кривых' : 'Варианты ответа') : 'Варианты ответа (необязательно)'} values={t.options ?? []} placeholder={config.mode === 'slopefield' ? '2*exp(-x) + x - 1' : undefined} onChange={v => onChange({ ...config, tasks: config.tasks.map((x, j) => j === i ? { ...x, options: v } : x) })} />
                        {isChoiceMode && (
                            <div>
                                <label className={labelCls}>Правильный ответ</label>
                                <select className={inputCls} value={t.correct_answer} onChange={e => onChange({ ...config, tasks: config.tasks.map((x, j) => j === i ? { ...x, correct_answer: e.target.value } : x) })}>
                                    <option value="">— выберите из вариантов —</option>
                                    {(t.options ?? []).filter(Boolean).map((opt, k) => <option key={k} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                        )}
                        <StringListEditor label="Подсказки" values={t.hints} onChange={v => onChange({ ...config, tasks: config.tasks.map((x, j) => j === i ? { ...x, hints: v } : x) })} />
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── Форма создания/редактирования сценария ──────────────────────────────────────
const ScenarioForm = ({ initial, skills, onClose, onSaved }: { initial: GameScenario | null; skills: Skill[]; onClose: () => void; onSaved: () => void }) => {
    const [templateKey, setTemplateKey] = useState<GameScenarioTemplateKey>(initial?.template_key ?? 'derivfall');
    const [config, setConfig] = useState<FormConfig>(
        initial ? ({ ...initial.config, template_key: initial.template_key } as FormConfig) : emptyConfig(templateKey)
    );
    const [skillId, setSkillId] = useState<string>(initial?.skill_id?.toString() ?? '');
    const [levelMin, setLevelMin] = useState<string>(initial?.level_range?.[0]?.toString() ?? '');
    const [levelMax, setLevelMax] = useState<string>(initial?.level_range?.[1]?.toString() ?? '');
    const [availFrom, setAvailFrom] = useState<string>(initial?.availability_from?.slice(0, 16) ?? '');
    const [availTo, setAvailTo] = useState<string>(initial?.availability_to?.slice(0, 16) ?? '');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const handleTemplateChange = (key: GameScenarioTemplateKey) => {
        setTemplateKey(key);
        setConfig(emptyConfig(key));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        const levelRange: [number, number] | undefined =
            levelMin && levelMax ? [parseInt(levelMin, 10), parseInt(levelMax, 10)] : undefined;
        const { template_key, ...configBody } = config;
        try {
            if (initial) {
                await updateGameScenario(initial.id, {
                    config: configBody,
                    skill_id: skillId ? parseInt(skillId, 10) : null,
                    level_range: levelRange ?? null,
                    availability_from: availFrom ? new Date(availFrom).toISOString() : null,
                    availability_to: availTo ? new Date(availTo).toISOString() : null,
                });
            } else {
                await createGameScenario({
                    template_key,
                    config: configBody,
                    skill_id: skillId ? parseInt(skillId, 10) : undefined,
                    level_range: levelRange,
                    availability_from: availFrom ? new Date(availFrom).toISOString() : undefined,
                    availability_to: availTo ? new Date(availTo).toISOString() : undefined,
                });
            }
            onSaved();
        } catch (err) {
            setError(errorDetail(err, 'Не удалось сохранить сценарий — проверьте заполнение полей'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={initial ? 'Редактировать сценарий' : 'Новый сценарий'} onClose={onClose} wide>
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-sm text-red-600 dark:text-red-400">
                        {error}
                    </div>
                )}
                <div>
                    <label className={labelCls}>Шаблон игры</label>
                    <select className={inputCls} value={templateKey} disabled={!!initial} onChange={e => handleTemplateChange(e.target.value as GameScenarioTemplateKey)}>
                        {(Object.keys(TEMPLATE_LABEL) as GameScenarioTemplateKey[]).map(k => <option key={k} value={k}>{TEMPLATE_LABEL[k]}</option>)}
                    </select>
                    {initial && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Шаблон нельзя сменить после создания.</p>}
                </div>

                <div>
                    <label className={labelCls}>Тема (необязательно)</label>
                    <select className={inputCls} value={skillId} onChange={e => setSkillId(e.target.value)}>
                        <option value="">— без темы —</option>
                        {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Без темы попытки в игре пишутся в статистику, но не влияют на рекомендованный уровень ученика.</p>
                </div>

                {config.template_key === 'derivfall' && <DerivFallForm config={config} onChange={setConfig} />}
                {config.template_key === 'integralbuilder' && <IntegralBuilderForm config={config} onChange={setConfig} />}
                {config.template_key === 'mathlab' && <MathLabForm config={config} onChange={setConfig} />}

                <div className="pt-2 border-t border-gray-200 dark:border-gray-600 space-y-3">
                    <label className={labelCls}>Диапазон уровня (необязательно)</label>
                    <div className="grid grid-cols-2 gap-3">
                        <input type="number" min={1} max={5} className={inputCls} placeholder="От" value={levelMin} onChange={e => setLevelMin(e.target.value)} />
                        <input type="number" min={1} max={5} className={inputCls} placeholder="До" value={levelMax} onChange={e => setLevelMax(e.target.value)} />
                    </div>
                    <label className={labelCls}>Доступность (необязательно)</label>
                    <div className="grid grid-cols-2 gap-3">
                        <input type="datetime-local" className={inputCls} value={availFrom} onChange={e => setAvailFrom(e.target.value)} />
                        <input type="datetime-local" className={inputCls} value={availTo} onChange={e => setAvailTo(e.target.value)} />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-1">
                    <button type="button" className={btnSecondary} onClick={onClose}>Отмена</button>
                    <button type="submit" className={btnPrimary} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
                </div>
            </form>
        </Modal>
    );
};

// ── Live-предпросмотр "от лица ученика" — те же компоненты, что видит студент ──
const ScenarioPreview = ({ scenario, onClose }: { scenario: GameScenario; onClose: () => void }) => (
    <Modal title="Предпросмотр от лица ученика" onClose={onClose} wide>
        <div className="h-[70vh] rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {scenario.template_key === 'derivfall' && (() => {
                const config = scenario.config as unknown as DerivFallGameConfig;
                return (
                    <DerivFall
                        difficulty={config.difficulty}
                        timeLimit={config.time_limit}
                        problemsSource={config.problems}
                        onComplete={() => {}}
                    />
                );
            })()}
            {scenario.template_key === 'integralbuilder' && (() => {
                const config = scenario.config as unknown as IntegralBuilderGameConfig;
                return (
                    <IntegralBuilder
                        initialDifficulty={config.initial_difficulty}
                        timeLimit={config.time_limit}
                        problemsSource={mapIntegralBuilderProblems(config.problems)}
                        onComplete={() => {}}
                    />
                );
            })()}
            {scenario.template_key === 'mathlab' && (() => {
                const config = scenario.config as unknown as MathLabGameConfig;
                if (config.mode === 'limits') {
                    return <LimitsApproach difficulty={config.difficulty} tasksSource={mapLimitsTasks(config.tasks)} onComplete={() => {}} />;
                }
                if (config.mode === 'series') {
                    return <SeriesFilling difficulty={config.difficulty} tasksSource={mapSeriesTasks(config.tasks)} onComplete={() => {}} />;
                }
                if (config.mode === 'slopefield') {
                    return <SlopeField difficulty={config.difficulty} tasksSource={mapSlopeFieldTasks(config.tasks)} onComplete={() => {}} />;
                }
                return (
                    <MathLab
                        mode={config.mode}
                        difficulty={config.difficulty}
                        tasksSource={mapMathLabTasks(config.tasks)}
                        onComplete={() => {}}
                    />
                );
            })()}
        </div>
    </Modal>
);

// ── Чек-лист + публикация ────────────────────────────────────────────────────
const ScenarioDetail = ({ scenario, onChanged }: { scenario: GameScenario; onChanged: () => void }) => {
    const [checklist, setChecklist] = useState<GameScenarioChecklistItem[]>([]);
    const [loadingChecklist, setLoadingChecklist] = useState(true);
    const [error, setError] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [busy, setBusy] = useState(false);

    const canManage = adminHasRole('superadmin', 'content_manager');
    const canCheckItems = adminHasRole('superadmin', 'content_manager', 'teacher');

    const loadChecklist = () => {
        setLoadingChecklist(true);
        fetchGameScenarioChecklist(scenario.id)
            .then(setChecklist)
            .catch(() => setError('Не удалось загрузить чек-лист'))
            .finally(() => setLoadingChecklist(false));
    };

    useEffect(loadChecklist, [scenario.id]);

    const handleCheckItem = async (itemKey: typeof CHECKLIST_ITEM_KEYS[number]) => {
        setError('');
        try {
            await checkGameScenarioChecklistItem(scenario.id, itemKey);
            loadChecklist();
        } catch (err) {
            setError(errorDetail(err, 'Не удалось отметить пункт чек-листа'));
        }
    };

    const handlePreview = async () => {
        setError('');
        setBusy(true);
        try {
            await previewGameScenario(scenario.id);
            setShowPreview(true);
            onChanged();
        } catch (err) {
            setError(errorDetail(err, 'Конфиг невалиден — предпросмотр недоступен'));
        } finally {
            setBusy(false);
        }
    };

    const handlePublish = async () => {
        setError('');
        setBusy(true);
        try {
            await publishGameScenario(scenario.id);
            onChanged();
        } catch (err) {
            setError(errorDetail(err, 'Не удалось опубликовать сценарий'));
        } finally {
            setBusy(false);
        }
    };

    const handleArchive = async () => {
        if (!confirm('Архивировать сценарий? Он перестанет быть доступен ученикам.')) return;
        setError('');
        setBusy(true);
        try {
            await archiveGameScenario(scenario.id);
            onChanged();
        } catch (err) {
            setError(errorDetail(err, 'Не удалось архивировать сценарий'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="p-4 space-y-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700">
            {error && (
                <div className="px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            <div>
                <p className={labelCls}>Чек-лист перед публикацией</p>
                {loadingChecklist ? (
                    <p className="text-xs text-gray-400">Загрузка...</p>
                ) : (
                    <div className="space-y-1.5">
                        {checklist.map(item => (
                            <div key={item.item_key} className="flex items-center justify-between text-sm">
                                <span className="text-gray-700 dark:text-gray-300">{CHECKLIST_LABEL[item.item_key] ?? item.item_key}</span>
                                {item.checked_at ? (
                                    <span className="text-xs text-green-600 dark:text-green-400">отмечено</span>
                                ) : canCheckItems ? (
                                    <button onClick={() => handleCheckItem(item.item_key as typeof CHECKLIST_ITEM_KEYS[number])} className={`${btnTiny} bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20`}>
                                        Отметить
                                    </button>
                                ) : (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">не отмечено</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button onClick={handlePreview} disabled={busy} className={`${btnSecondary} disabled:opacity-50`}>
                    Предпросмотр {scenario.preview_passed_at ? '(пройден)' : ''}
                </button>
                {canManage && scenario.status === 'draft' && (
                    <button onClick={handlePublish} disabled={busy} className={btnPrimary}>Опубликовать</button>
                )}
                {canManage && scenario.status !== 'archived' && (
                    <button onClick={handleArchive} disabled={busy} className={btnDanger}>В архив</button>
                )}
            </div>

            {showPreview && <ScenarioPreview scenario={scenario} onClose={() => setShowPreview(false)} />}
        </div>
    );
};

// ── Основной компонент ────────────────────────────────────────────────────────
const GameScenariosPanel = () => {
    const [scenarios, setScenarios] = useState<GameScenario[]>([]);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState<GameScenarioStatus | ''>('');
    const [templateFilter, setTemplateFilter] = useState<GameScenarioTemplateKey | ''>('');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingScenario, setEditingScenario] = useState<GameScenario | null>(null);

    const canManage = adminHasRole('superadmin', 'content_manager');
    const skillsById = new Map(skills.map(s => [s.id, s.name]));

    const load = () => {
        setLoading(true);
        fetchGameScenarios({
            status_filter: statusFilter || undefined,
            template_key: templateFilter || undefined,
        })
            .then(setScenarios)
            .catch(() => setError('Не удалось загрузить сценарии'))
            .finally(() => setLoading(false));
    };

    useEffect(load, [statusFilter, templateFilter]);
    useEffect(() => { fetchSkills().then(setSkills).catch(() => {}); }, []);

    const handleCreate = () => { setEditingScenario(null); setShowForm(true); };
    const handleEdit = (s: GameScenario) => { setEditingScenario(s); setShowForm(true); };
    const handleFormSaved = () => { setShowForm(false); setEditingScenario(null); load(); };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white transition-colors">Игровые сценарии</h2>
                {canManage && <button className={btnPrimary} onClick={handleCreate}>+ Создать сценарий</button>}
            </div>

            <div className="flex flex-wrap gap-3">
                <select className={inputCls} style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value as GameScenarioStatus | '')}>
                    <option value="">Все статусы</option>
                    {(Object.keys(STATUS_LABEL) as GameScenarioStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <select className={inputCls} style={{ width: 'auto' }} value={templateFilter} onChange={e => setTemplateFilter(e.target.value as GameScenarioTemplateKey | '')}>
                    <option value="">Все шаблоны</option>
                    {(Object.keys(TEMPLATE_LABEL) as GameScenarioTemplateKey[]).map(k => <option key={k} value={k}>{TEMPLATE_LABEL[k]}</option>)}
                </select>
            </div>

            {error && (
                <div className="px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Загрузка...</p>
            ) : scenarios.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 dark:bg-gray-700/50 border border-dashed border-gray-200 dark:border-gray-600 rounded-xl">
                    <p className="text-sm text-gray-400 dark:text-gray-500">Сценариев пока нет</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {scenarios.map(s => (
                        <div key={s.id} className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                            <div className="p-4 flex items-center justify-between flex-wrap gap-2 cursor-pointer" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{TEMPLATE_LABEL[s.template_key]}</span>
                                    {typeof (s.config as { mode?: unknown }).mode === 'string' && (
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                            {(s.config as { mode: string }).mode}
                                        </span>
                                    )}
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                                    {s.skill_id != null && (
                                        <span className="text-xs text-gray-400 dark:text-gray-500">{skillsById.get(s.skill_id) ?? `тема #${s.skill_id}`}</span>
                                    )}
                                    {s.level_range && (
                                        <span className="text-xs text-gray-400 dark:text-gray-500">уровень {s.level_range[0]}–{s.level_range[1]}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {canManage && s.status === 'draft' && (
                                        <button onClick={e => { e.stopPropagation(); handleEdit(s); }} className={`${btnTiny} bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600`}>
                                            Редактировать
                                        </button>
                                    )}
                                    <span className="text-xs text-gray-400 dark:text-gray-500">{expandedId === s.id ? '▲' : '▼'}</span>
                                </div>
                            </div>
                            {expandedId === s.id && (
                                <div className="px-4 pb-4">
                                    <ScenarioDetail scenario={s} onChanged={load} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showForm && (
                <ScenarioForm
                    initial={editingScenario}
                    skills={skills}
                    onClose={() => { setShowForm(false); setEditingScenario(null); }}
                    onSaved={handleFormSaved}
                />
            )}
        </div>
    );
};

export default GameScenariosPanel;
