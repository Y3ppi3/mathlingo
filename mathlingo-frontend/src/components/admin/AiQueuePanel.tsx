// src/components/admin/AiQueuePanel.tsx
import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import {
    fetchSubjects, fetchSkills, fetchPromptTemplates, createPromptTemplate,
    fetchAiOrders, fetchAiOrder, createAiOrder,
    fetchMyAiQuota, fetchAllAiQuotas, setAiQuota,
    Subject, Skill, TaskLevel, TaskAnswerType, PromptTemplate, AIGenerationOrder, AIGenerationOrderDetail, AIQuota,
} from '../../utils/adminApi';
import { adminHasRole } from '../../utils/auth';

const inputCls = "px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

const ITEM_STATUS_COLOR: Record<string, string> = {
    ready: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
    pending: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
    failed_generation: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
    failed_validation: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
    failed_answer_check: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
};

// R2 task 5: провайдер всегда мок (MockAIProvider) — выбор реального
// провайдера не принят, это отдельный decision gate (см.
// docs/roadmap/product-technical-plan.md, R2 §7). Заказ обрабатывается
// синхронно на сервере, поэтому "Создать" может занять заметное время
// при большом count — это ожидаемо для мока, не баг.
const AiQueuePanel = () => {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [subjectId, setSubjectId] = useState<number | null>(null);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [skillId, setSkillId] = useState<number | null>(null);
    const [templates, setTemplates] = useState<PromptTemplate[]>([]);
    const [orders, setOrders] = useState<AIGenerationOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<AIGenerationOrderDetail | null>(null);

    const [taskType, setTaskType] = useState<TaskAnswerType>('single_answer');
    const [level, setLevel] = useState<TaskLevel>('standard');
    const [count, setCount] = useState('3');
    const [templateId, setTemplateId] = useState<number | null>(null);

    const [showTemplateForm, setShowTemplateForm] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templateText, setTemplateText] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [myQuota, setMyQuota] = useState<AIQuota | null>(null);
    const [allQuotas, setAllQuotas] = useState<AIQuota[]>([]);
    const isSuperadmin = adminHasRole('superadmin');

    const loadMyQuota = () => fetchMyAiQuota().then(setMyQuota).catch(() => {});

    useEffect(() => {
        fetchSubjects().then(list => {
            setSubjects(list);
            if (list.length > 0 && list[0].id) setSubjectId(list[0].id);
        }).catch(() => setError('Не удалось загрузить разделы'));
        fetchPromptTemplates().then(setTemplates).catch(() => {});
        loadMyQuota();
        if (isSuperadmin) fetchAllAiQuotas().then(setAllQuotas).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (subjectId == null) return;
        fetchSkills(subjectId).then(list => {
            setSkills(list);
            setSkillId(list.length > 0 ? list[0].id ?? null : null);
        }).catch(() => setError('Не удалось загрузить темы'));
    }, [subjectId]);

    const loadOrders = () => {
        if (skillId == null) return;
        fetchAiOrders(skillId).then(setOrders).catch(() => setError('Не удалось загрузить заказы'));
    };

    useEffect(loadOrders, [skillId]);

    const templatesForType = templates.filter(t => t.task_type === taskType);
    useEffect(() => {
        setTemplateId(templatesForType.length > 0 ? templatesForType[0].id : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskType, templates]);

    const handleCreateTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const created = await createPromptTemplate({ name: templateName, template_text: templateText, task_type: taskType });
            setTemplates(prev => [...prev, created]);
            setTemplateId(created.id);
            setShowTemplateForm(false);
            setTemplateName('');
            setTemplateText('');
        } catch {
            setError('Не удалось создать шаблон');
        }
    };

    const handleCreateOrder = async () => {
        if (skillId == null || subjectId == null || templateId == null) return;
        setSubmitting(true);
        setError('');
        try {
            const order = await createAiOrder({
                subject_id: subjectId, skill_id: skillId, level, task_type: taskType,
                count: parseInt(count) || 1, prompt_template_id: templateId,
            });
            setSelectedOrder(order);
            loadOrders();
            loadMyQuota();
        } catch (err) {
            const detail = (err as AxiosError<{ detail?: string }>).response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Не удалось создать заказ');
        } finally {
            setSubmitting(false);
        }
    };

    const openOrder = (id: number) => {
        fetchAiOrder(id).then(setSelectedOrder).catch(() => setError('Не удалось загрузить заказ'));
    };

    const handleSetQuota = async (adminId: number, newLimit: number) => {
        try {
            await setAiQuota(adminId, newLimit);
            const updated = await fetchAllAiQuotas();
            setAllQuotas(updated);
            if (adminId === myQuota?.admin_id) loadMyQuota();
        } catch {
            setError('Не удалось изменить квоту');
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI-очередь</h2>
                <div className="flex items-center gap-2">
                    <select className={inputCls} value={subjectId ?? ''} onChange={e => setSubjectId(e.target.value ? parseInt(e.target.value) : null)}>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select className={inputCls} value={skillId ?? ''} onChange={e => setSkillId(e.target.value ? parseInt(e.target.value) : null)}>
                        {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl">
                    <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                </div>
            )}

            {/* Своя квота (R2 task 6) */}
            {myQuota && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        Квота на {myQuota.period}: {myQuota.used} / {myQuota.monthly_limit}
                    </span>
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${myQuota.used >= myQuota.monthly_limit ? 'bg-red-500' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.min(100, (myQuota.used / Math.max(1, myQuota.monthly_limit)) * 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Новый заказ */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Новый заказ</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                        <label className={labelCls}>Тип ответа</label>
                        <select className={inputCls} value={taskType} onChange={e => setTaskType(e.target.value as TaskAnswerType)}>
                            <option value="single_answer">Ответ строкой</option>
                            <option value="multiple_choice">Варианты ответа</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Уровень</label>
                        <select className={inputCls} value={level} onChange={e => setLevel(e.target.value as TaskLevel)}>
                            <option value="basic">Базовый</option>
                            <option value="standard">Стандартный</option>
                            <option value="advanced">Продвинутый</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Количество</label>
                        <input type="number" min={1} max={20} className={inputCls} value={count} onChange={e => setCount(e.target.value)} />
                    </div>
                    <div>
                        <label className={labelCls}>Шаблон промпта</label>
                        {templatesForType.length > 0 ? (
                            <select className={inputCls} value={templateId ?? ''} onChange={e => setTemplateId(parseInt(e.target.value))}>
                                {templatesForType.map(t => <option key={t.id} value={t.id}>{t.name} v{t.version}</option>)}
                            </select>
                        ) : (
                            <button type="button" onClick={() => setShowTemplateForm(true)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                                Нет шаблонов — создать
                            </button>
                        )}
                    </div>
                </div>

                {showTemplateForm && (
                    <form onSubmit={handleCreateTemplate} className="flex items-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex-1">
                            <label className={labelCls}>Название шаблона</label>
                            <input className={inputCls + " w-full"} value={templateName} onChange={e => setTemplateName(e.target.value)} required />
                        </div>
                        <div className="flex-1">
                            <label className={labelCls}>Текст промпта</label>
                            <input className={inputCls + " w-full"} value={templateText} onChange={e => setTemplateText(e.target.value)} required />
                        </div>
                        <button type="submit" style={{ padding: '0.625rem 1rem' }} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium">
                            Сохранить
                        </button>
                    </form>
                )}

                <button
                    onClick={handleCreateOrder}
                    disabled={submitting || templateId == null || skillId == null}
                    style={{ padding: '0.5rem 1.25rem' }}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                >
                    {submitting ? 'Генерация...' : 'Создать заказ'}
                </button>
            </div>

            {/* Список заказов */}
            <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Заказы по теме</h3>
                {orders.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">Пока нет заказов.</p>
                ) : (
                    <div className="space-y-2">
                        {orders.map(o => (
                            <button
                                key={o.id}
                                onClick={() => openOrder(o.id)}
                                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left"
                            >
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    #{o.id} — {o.count} шт., {o.task_type === 'multiple_choice' ? 'варианты' : 'строкой'}, {o.level}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                    {o.status}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Детали выбранного заказа */}
            {selectedOrder && (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50">
                            {['#', 'Статус', 'Заголовок', 'Причина отказа', 'Критик'].map(h => (
                                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                            ))}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                        {selectedOrder.items.map(item => (
                            <tr key={item.id}>
                                <td className="px-4 py-2.5 text-sm text-gray-400 dark:text-gray-500">{item.index_in_order + 1}</td>
                                <td className="px-4 py-2.5">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ITEM_STATUS_COLOR[item.status]}`}>{item.status}</span>
                                </td>
                                <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300">
                                    {(item.draft_json?.title as string) ?? '—'}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-red-500 dark:text-red-400">{item.failure_reason ?? ''}</td>
                                <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                                    {(item.ai_critic_result?.verdict as string) ?? '—'}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Управление квотами — только superadmin */}
            {isSuperadmin && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Квоты администраторов</h3>
                    <div className="space-y-2">
                        {allQuotas.map(q => (
                            <div key={q.admin_id} className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    admin #{q.admin_id} — {q.used} / {q.monthly_limit} за {q.period}
                                </span>
                                <input
                                    type="number"
                                    min={0}
                                    defaultValue={q.monthly_limit}
                                    onBlur={e => {
                                        const value = parseInt(e.target.value);
                                        if (!isNaN(value) && value !== q.monthly_limit) handleSetQuota(q.admin_id, value);
                                    }}
                                    className={inputCls + " w-24"}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AiQueuePanel;
