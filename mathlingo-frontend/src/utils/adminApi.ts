// Updated adminApi.ts with improved error handling
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Create axios instance with base settings
export const adminApi = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
    // Important: Include credentials to ensure cookies are sent
    withCredentials: true,
});

// Add token to requests
adminApi.interceptors.request.use((config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    console.error("Request error:", error);
    return Promise.reject(error);
});

// Add response interceptor for better error handling
adminApi.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle CORS errors
        if (error.message === 'Network Error') {
            console.error('CORS or network error:', error);
            return Promise.reject(new Error('Проблема с сетевым подключением. Возможно, CORS не настроен на сервере.'));
        }

        // Return the error response data if it exists (for confirmation flow)
        if (error.response && error.response.data) {
            return Promise.resolve(error.response);
        }

        return Promise.reject(error);
    }
);

// Data interfaces
export type TaskLevel = 'basic' | 'standard' | 'advanced';
export type TaskStatus = 'draft' | 'in_review' | 'needs_revision' | 'approved' | 'published' | 'archived';
export type TaskTransitionAction = 'submit_review' | 'approve' | 'request_changes' | 'publish' | 'archive';
export type TaskAnswerType = 'single_answer' | 'multiple_choice';

export interface Task {
    id?: number;
    title: string;
    description?: string;
    subject: string;
    owner_id?: number;
    skill_id?: number | null;
    level?: TaskLevel;
    status?: TaskStatus;
    version?: number;
    source?: 'manual' | 'ai';
    created_by_admin_id?: number | null;
    approved_by_admin_id?: number | null;
    published_at?: string | null;
    archived_at?: string | null;
    content?: string | null;
    answer_type?: TaskAnswerType;
    options?: string[] | null;
    correct_answer?: string | null;
}

export interface Skill {
    id?: number;
    subject_id: number;
    name: string;
    code: string;
    order?: number;
    is_active?: boolean;
    created_at?: string;
}

export interface AdminAccount {
    id: number;
    username: string;
    email: string;
    role: 'superadmin' | 'content_manager' | 'teacher';
    is_active: boolean;
    created_at: string;
}

export interface AuditLogEntry {
    id: number;
    actor_admin_id: number | null;
    actor_role: string | null;
    method: string;
    path: string;
    entity_type: string | null;
    entity_id: string | null;
    action: string | null;
    status_code: number;
    created_at: string;
}

export interface Subject {
    id?: number;
    name: string;
    code: string;
    description?: string;
    order?: number;
    icon?: string;
    is_active?: boolean;
    created_at?: string;
    tasks_count?: number;
}

export interface User {
    id: number;
    username: string;
    email: string;
    is_active: boolean;
    created_at: string;
}

// Task functions
export const fetchTasks = async (filters?: { skill_id?: number; status_filter?: TaskStatus }): Promise<Task[]> => {
    try {
        const response = await adminApi.get("/admin/tasks", { params: filters });
        return response.data;
    } catch (error) {
        console.error('Error fetching tasks:', error);
        throw error;
    }
};

export const fetchTask = async (id: number): Promise<Task> => {
    try {
        const response = await adminApi.get(`/admin/tasks/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching task ${id}:`, error);
        throw error;
    }
};

export const createTask = async (task: Task): Promise<Task> => {
    try {
        const response = await adminApi.post("/admin/tasks", task);
        return response.data;
    } catch (error) {
        console.error('Error creating task:', error);
        throw error;
    }
};

export const updateTask = async (id: number, task: Partial<Task>): Promise<Task> => {
    try {
        const response = await adminApi.put(`/admin/tasks/${id}`, task);
        return response.data;
    } catch (error) {
        console.error(`Error updating task ${id}:`, error);
        throw error;
    }
};

export const deleteTask = async (id: number): Promise<void> => {
    try {
        await adminApi.delete(`/admin/tasks/${id}`);
    } catch (error) {
        console.error(`Error deleting task ${id}:`, error);
        throw error;
    }
};

// Переходы статуса контента (см. mathlingo-backend/app/routes/admin.py TASK_TRANSITIONS)
export const transitionTask = async (id: number, action: TaskTransitionAction, comment?: string): Promise<Task> => {
    const path = `/admin/tasks/${id}/${action.replace(/_/g, '-')}`;
    const body = action === 'request_changes' ? { comment } : undefined;
    const response = await adminApi.post(path, body);
    return response.data;
};

export interface TaskBulkActionResult {
    succeeded: number[];
    failed: { id: number; detail: string }[];
}

export const bulkTaskAction = async (
    ids: number[],
    action: TaskTransitionAction,
    comment?: string
): Promise<TaskBulkActionResult> => {
    const response = await adminApi.post('/admin/tasks/bulk', { ids, action, comment });
    return response.data;
};

// Обычная <a href> не сработает: admin-токен передаётся только заголовком
// Authorization (см. admin.py login_admin — cookie не выставляется), а
// прямая навигация браузера его не подставит. Скачиваем через axios и сами
// создаём blob-ссылку.
export const downloadTasksExport = async (format: 'json' | 'csv' = 'csv'): Promise<void> => {
    const response = await adminApi.get('/admin/tasks/export', {
        params: { format },
        responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

export interface TaskImportResult {
    created: number[];
    failed: { row: number; detail: string }[];
}

export const importTasksCsv = async (file: File): Promise<TaskImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await adminApi.post('/admin/tasks/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

// Skill functions
export const fetchSkills = async (subjectId?: number): Promise<Skill[]> => {
    const response = await adminApi.get('/admin/skills/', { params: subjectId ? { subject_id: subjectId } : {} });
    return response.data;
};

export const createSkill = async (skill: Skill): Promise<Skill> => {
    const response = await adminApi.post('/admin/skills/', skill);
    return response.data;
};

export const updateSkill = async (id: number, skill: Partial<Skill>): Promise<Skill> => {
    const response = await adminApi.put(`/admin/skills/${id}`, skill);
    return response.data;
};

// Staff (Admin accounts) — только для superadmin, см. app/routes/admin.py list_admins
export const fetchAdmins = async (): Promise<AdminAccount[]> => {
    const response = await adminApi.get('/admin/admins');
    return response.data;
};

export const createAdmin = async (data: {
    username: string;
    email: string;
    password: string;
    role: AdminAccount['role'];
}): Promise<AdminAccount> => {
    const response = await adminApi.post('/admin/register', data);
    return response.data;
};

// Audit log — superadmin видит всё, content_manager только свои действия
export const fetchAuditLog = async (params?: {
    entity_type?: string;
    actor_admin_id?: number;
    skip?: number;
    limit?: number;
}): Promise<AuditLogEntry[]> => {
    const response = await adminApi.get('/admin/audit-log', { params });
    return response.data;
};

export const bulkUpdateUserStatus = async (ids: number[], isActive: boolean): Promise<{ updated_count: number }> => {
    const response = await adminApi.post('/admin/users/bulk-status', { ids, is_active: isActive });
    return response.data;
};

// User functions
export const fetchUsers = async (): Promise<User[]> => {
    try {
        const response = await adminApi.get("/admin/users");
        return response.data;
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
};

// Subject functions
export const fetchSubjects = async (): Promise<Subject[]> => {
    try {
        const response = await adminApi.get("/admin/subjects");
        return response.data;
    } catch (error) {
        console.error('Error fetching subjects:', error);
        throw error;
    }
};

export const fetchSubject = async (id: number): Promise<Subject> => {
    try {
        const response = await adminApi.get(`/admin/subjects/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching subject ${id}:`, error);
        throw error;
    }
};

export const createSubject = async (subject: Subject): Promise<Subject> => {
    try {
        const response = await adminApi.post("/admin/subjects", subject);
        return response.data;
    } catch (error) {
        console.error('Error creating subject:', error);
        throw error;
    }
};

export const updateSubject = async (id: number, subject: Partial<Subject>): Promise<Subject> => {
    try {
        const response = await adminApi.put(`/admin/subjects/${id}`, subject);
        return response.data;
    } catch (error) {
        console.error(`Error updating subject ${id}:`, error);
        throw error;
    }
};

export const deleteSubject = async (id: number, force: boolean = false): Promise<any> => {
    try {
        console.log(`Attempting to delete subject ${id} with force=${force}`);

        const response = await adminApi.delete(`/admin/subjects/${id}${force ? '?force=true' : ''}`);

        console.log("Response status:", response.status);
        console.log("Response data:", response.data);

        if (response.status >= 400 ||
            (response.data && response.data.detail &&
                typeof response.data.detail === 'string' &&
                response.data.detail.includes('связано'))) {

            return {
                success: false,
                status: response.status,
                data: response.data
            };
        }

        return {
            success: true,
            data: response.data
        };
    } catch (error: any) {
        console.error("Delete operation threw an exception:", error);

        if (error.response) {
            return {
                success: false,
                status: error.response.status,
                data: error.response.data
            };
        }

        return {
            success: false,
            error: error.message || 'Unknown error'
        };
    }
};

// Alternative bypass method for subject deletion
export const deleteSubjectBypass = async (id: number): Promise<any> => {
    try {
        console.log(`Attempting to bypass-delete subject ${id}`);

        // Using the subject_operations endpoint that performs direct deletion
        const response = await adminApi.delete(`/admin/subject-ops/${id}`);

        console.log("Bypass delete response:", response.status, response.data);

        return {
            success: true,
            data: response.data
        };
    } catch (error: any) {
        console.error("Bypass delete error:", error);

        if (error.response) {
            return {
                success: false,
                status: error.response.status,
                data: error.response.data
            };
        }

        return {
            success: false,
            error: error.message || 'Unknown error'
        };
    }
};

export const deleteUser = async (userId: number): Promise<void> => {
    try {
        await adminApi.delete(`/admin/users/${userId}`);
    } catch (error) {
        console.error(`Error deleting user ${userId}:`, error);
        throw error;
    }
};

export const updateUserStatus = async (userId: number, isActive: boolean): Promise<void> => {
    try {
        await adminApi.put(`/admin/users/${userId}/status`, { is_active: isActive });
    } catch (error) {
        console.error(`Error updating user status ${userId}:`, error);
        throw error;
    }
};

// Adventure map functions
export const deleteAdventureMap = async (mapId: number, force: boolean = false): Promise<any> => {
    try {
        const response = await adminApi.delete(`/admin/gamification/maps/${mapId}${force ? '?force=true' : ''}`);
        return response.data;
    } catch (error: any) {
        // If we received a well-formed response, return it (for confirmation flow)
        if (error.response && error.response.data) {
            return error.response.data;
        }
        throw error;
    }
};

export const deleteSubjectOperation = async (id: number): Promise<any> => {
    try {
        const response = await adminApi.delete(`/admin/subject-ops/${id}`);
        return response.data;
    } catch (error: any) {
        if (error.response && error.response.data) {
            return error.response.data;
        }
        throw error;
    }
};

// Diagnostics (R2 task 3)
export interface Diagnostic {
    id: number;
    skill_id: number;
    task_ids: number[];
    is_active: boolean;
    created_by_admin_id?: number | null;
    created_at: string;
}

export const fetchDiagnostics = async (skillId?: number): Promise<Diagnostic[]> => {
    const response = await adminApi.get('/admin/diagnostics', { params: skillId ? { skill_id: skillId } : {} });
    return response.data;
};

export const createDiagnostic = async (skillId: number, taskIds: number[]): Promise<Diagnostic> => {
    const response = await adminApi.post('/admin/diagnostics', { skill_id: skillId, task_ids: taskIds });
    return response.data;
};

export const updateDiagnostic = async (id: number, data: Partial<Pick<Diagnostic, 'task_ids' | 'is_active'>>): Promise<Diagnostic> => {
    const response = await adminApi.put(`/admin/diagnostics/${id}`, data);
    return response.data;
};

// AI-конвейер (R2 task 5) — провайдер всегда MockAIProvider, пока не
// закрыт decision gate по выбору реального провайдера.
export interface PromptTemplate {
    id: number;
    name: string;
    version: number;
    template_text: string;
    task_type: TaskAnswerType;
    created_at: string;
}

export interface AIGenerationItem {
    id: number;
    index_in_order: number;
    status: 'pending' | 'ready' | 'failed_generation' | 'failed_validation' | 'failed_answer_check';
    failure_reason?: string | null;
    draft_json?: Record<string, unknown> | null;
    validation_result?: Record<string, unknown> | null;
    sanitization_result?: Record<string, unknown> | null;
    deterministic_check_result?: Record<string, unknown> | null;
    ai_critic_result?: Record<string, unknown> | null;
    task_id?: number | null;
}

export interface AIGenerationOrder {
    id: number;
    subject_id: number;
    skill_id: number;
    level: TaskLevel;
    task_type: TaskAnswerType;
    count: number;
    prompt_template_id: number;
    model_version: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    created_at: string;
}

export interface AIGenerationOrderDetail extends AIGenerationOrder {
    items: AIGenerationItem[];
}

export const fetchPromptTemplates = async (): Promise<PromptTemplate[]> => {
    const response = await adminApi.get('/admin/ai/prompt-templates');
    return response.data;
};

export const createPromptTemplate = async (data: { name: string; template_text: string; task_type: TaskAnswerType }): Promise<PromptTemplate> => {
    const response = await adminApi.post('/admin/ai/prompt-templates', data);
    return response.data;
};

export const fetchAiOrders = async (skillId?: number): Promise<AIGenerationOrder[]> => {
    const response = await adminApi.get('/admin/ai/orders', { params: skillId ? { skill_id: skillId } : {} });
    return response.data;
};

export const fetchAiOrder = async (id: number): Promise<AIGenerationOrderDetail> => {
    const response = await adminApi.get(`/admin/ai/orders/${id}`);
    return response.data;
};

export const createAiOrder = async (data: {
    subject_id: number;
    skill_id: number;
    level: TaskLevel;
    task_type: TaskAnswerType;
    count: number;
    prompt_template_id: number;
}): Promise<AIGenerationOrderDetail> => {
    const response = await adminApi.post('/admin/ai/orders', data);
    return response.data;
};

// Квоты (R2 task 6)
export interface AIQuota {
    admin_id: number;
    period: string;
    monthly_limit: number;
    used: number;
}

export const fetchMyAiQuota = async (): Promise<AIQuota> => {
    const response = await adminApi.get('/admin/ai/quota');
    return response.data;
};

export const fetchAllAiQuotas = async (): Promise<AIQuota[]> => {
    const response = await adminApi.get('/admin/ai/quotas');
    return response.data;
};

export const setAiQuota = async (adminId: number, monthlyLimit: number): Promise<AIQuota> => {
    const response = await adminApi.put(`/admin/ai/quota/${adminId}`, { monthly_limit: monthlyLimit });
    return response.data;
};

// Пост-публикационный мониторинг (R2 task 7)
export type ContentFlagType = 'anomaly' | 'complaint';
export type ContentFlagStatus = 'open' | 'resolved' | 'dismissed';

export interface ContentFlag {
    id: number;
    task_id: number;
    flag_type: ContentFlagType;
    details?: Record<string, unknown> | null;
    status: ContentFlagStatus;
    created_by_admin_id?: number | null;
    resolved_by_admin_id?: number | null;
    created_at: string;
    resolved_at?: string | null;
}

export interface TaskQuality {
    task_id: number;
    title: string;
    status: TaskStatus;
    sample_size: number;
    accuracy?: number | null;
    avg_time_spent_ms?: number | null;
    avg_hints_used?: number | null;
    open_flags: number;
    flags: ContentFlag[];
}

export const fetchAiTaskQuality = async (): Promise<TaskQuality[]> => {
    const response = await adminApi.get('/admin/quality/ai-tasks');
    return response.data;
};

export const fileContentComplaint = async (taskId: number, comment: string): Promise<ContentFlag> => {
    const response = await adminApi.post(`/admin/tasks/${taskId}/flags`, { comment });
    return response.data;
};

export const updateContentFlag = async (flagId: number, status: 'resolved' | 'dismissed'): Promise<ContentFlag> => {
    const response = await adminApi.put(`/admin/content-flags/${flagId}`, { status });
    return response.data;
};

export const returnTaskToReview = async (taskId: number): Promise<Task> => {
    const response = await adminApi.post(`/admin/tasks/${taskId}/return-to-review`);
    return response.data;
};

// Перехватчик adminApi выше нарочно РЕЗОЛВИТ (не реджектит) любой ответ с
// телом ошибки (используется для confirmation-flow при удалении), из-за
// этого try/catch вокруг обычного adminApi.post/put в остальном файле не
// ловит 4xx. Трогать общий перехватчик рискованно — на нём завязан
// confirmation-flow в deleteSubject/deleteAdventureMap; вместо этого
// разворачиваем ответ точечно там, где try/catch реально нужен (game
// scenarios, dashboard).
const unwrapAdminResponse = <T,>(response: { status: number; data: unknown }): T => {
    if (response.status >= 400) {
        throw new Error((response.data as { detail?: string } | undefined)?.detail || 'Запрос не выполнен');
    }
    return response.data as T;
};

// Игровые сценарии (R3 task 2 backend, task 5 конструктор) — конфиг
// типизирован per-template в самой панели через DerivFallGameConfig /
// IntegralBuilderGameConfig / MathLabGameConfig из utils/api.ts (тот же
// контракт, что использует студенческий эндпоинт активного сценария).
export type GameScenarioTemplateKey = 'derivfall' | 'integralbuilder' | 'mathlab';
export type GameScenarioStatus = 'draft' | 'published' | 'archived';

export interface GameScenario {
    id: number;
    template_key: GameScenarioTemplateKey;
    config: Record<string, unknown>;
    status: GameScenarioStatus;
    skill_id?: number | null;
    level_range?: [number, number] | null;
    availability_from?: string | null;
    availability_to?: string | null;
    created_by_admin_id?: number | null;
    preview_passed_at?: string | null;
    published_at?: string | null;
    created_at: string;
    updated_at?: string | null;
}

// Синхронизировано с GameScenarioChecklistItem.ITEM_KEYS (app/models.py).
export const CHECKLIST_ITEM_KEYS = ['texts_correct', 'no_placeholders', 'katex_renders'] as const;
export type ChecklistItemKey = typeof CHECKLIST_ITEM_KEYS[number];

export interface GameScenarioChecklistItem {
    item_key: string;
    checked_by_admin_id?: number | null;
    checked_at?: string | null;
}

export const fetchGameScenarios = async (filters?: { status_filter?: GameScenarioStatus; template_key?: GameScenarioTemplateKey }): Promise<GameScenario[]> => {
    const response = await adminApi.get('/admin/game-scenarios/', { params: filters });
    return unwrapAdminResponse<GameScenario[]>(response);
};

export const fetchGameScenario = async (id: number): Promise<GameScenario> => {
    const response = await adminApi.get(`/admin/game-scenarios/${id}`);
    return unwrapAdminResponse<GameScenario>(response);
};

export const createGameScenario = async (data: {
    template_key: GameScenarioTemplateKey;
    config: Record<string, unknown>;
    skill_id?: number | null;
    level_range?: [number, number] | null;
    availability_from?: string | null;
    availability_to?: string | null;
}): Promise<GameScenario> => {
    const response = await adminApi.post('/admin/game-scenarios/', data);
    return unwrapAdminResponse<GameScenario>(response);
};

export const updateGameScenario = async (id: number, data: {
    config?: Record<string, unknown>;
    skill_id?: number | null;
    level_range?: [number, number] | null;
    availability_from?: string | null;
    availability_to?: string | null;
}): Promise<GameScenario> => {
    const response = await adminApi.put(`/admin/game-scenarios/${id}`, data);
    return unwrapAdminResponse<GameScenario>(response);
};

export const fetchGameScenarioChecklist = async (id: number): Promise<GameScenarioChecklistItem[]> => {
    const response = await adminApi.get(`/admin/game-scenarios/${id}/checklist`);
    return unwrapAdminResponse<GameScenarioChecklistItem[]>(response);
};

export const checkGameScenarioChecklistItem = async (id: number, itemKey: ChecklistItemKey): Promise<GameScenarioChecklistItem> => {
    const response = await adminApi.post(`/admin/game-scenarios/${id}/checklist/${itemKey}`);
    return unwrapAdminResponse<GameScenarioChecklistItem>(response);
};

export const previewGameScenario = async (id: number): Promise<GameScenario> => {
    const response = await adminApi.post(`/admin/game-scenarios/${id}/preview`);
    return unwrapAdminResponse<GameScenario>(response);
};

export const publishGameScenario = async (id: number): Promise<GameScenario> => {
    const response = await adminApi.post(`/admin/game-scenarios/${id}/publish`);
    return unwrapAdminResponse<GameScenario>(response);
};

export const archiveGameScenario = async (id: number): Promise<GameScenario> => {
    const response = await adminApi.post(`/admin/game-scenarios/${id}/archive`);
    return unwrapAdminResponse<GameScenario>(response);
};

// Финальный dashboard (R3 task 7) — см. mathlingo-backend/app/services/dashboard.py.
export interface DashboardActivitySummary {
    window_days: number;
    total_attempts: number;
    active_users: number;
    by_content_type: Record<string, { attempts: number; active_users: number }>;
}

export interface DashboardSkillProgress {
    skill_id: number;
    skill_name: string;
    student_count: number;
    levels: Record<string, number>;
    avg_confidence: number;
}

export interface DashboardGameCompletion {
    template_key: GameScenarioTemplateKey;
    sessions: number;
    pass_rate: number | null;
    avg_time_spent_ms: number | null;
}

export interface DashboardAiQuality {
    published_ai_tasks: number;
    open_anomaly_flags: number;
    open_complaint_flags: number;
}

export interface DashboardReviewQueue {
    tasks_in_review: number;
    ai_items_pending: number;
}

export interface DashboardAdminAction {
    id: number;
    actor_username: string | null;
    actor_role: string | null;
    method: string;
    path: string;
    action: string | null;
    status_code: number;
    created_at: string;
}

export interface DashboardOverview {
    activity: DashboardActivitySummary;
    skill_progress: DashboardSkillProgress[];
    game_completion: DashboardGameCompletion[];
    ai_quality: DashboardAiQuality;
    review_queue: DashboardReviewQueue;
    publish_errors: Record<string, number>;
    // null для teacher — см. R3 §5, "частично, без раздела действий администраторов".
    admin_actions: DashboardAdminAction[] | null;
}

export const fetchDashboardOverview = async (): Promise<DashboardOverview> => {
    const response = await adminApi.get('/admin/dashboard/overview');
    return unwrapAdminResponse<DashboardOverview>(response);
};