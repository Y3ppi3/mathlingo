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
export const fetchTasks = async (): Promise<Task[]> => {
    try {
        const response = await adminApi.get("/admin/tasks");
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