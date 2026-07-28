// src/api/tutorsApi.ts
// Платформа репетиторов, Фаза 1: маркетплейс + связь «репетитор↔ученик».
// Использует общий axios-инстанс `api` (baseURL, куки, авто-CSRF).
import { api } from './studentApi';

export type ConnectionStatus = 'none' | 'pending' | 'active';

export interface TutorCard {
    user_id: number;
    username: string;
    avatar_id?: number | null;
    headline: string;
    bio?: string | null;
    subjects?: string[] | null;
    hourly_rate?: number | null;
    is_listed: boolean;
    connection_status: ConnectionStatus;
    students_count?: number | null;
}

export interface StudentCard {
    student_id: number;
    username: string;
    email: string;
    avatar_id?: number | null;
    status: 'pending' | 'active';
    created_at?: string | null;
}

export interface TutorConnection {
    tutor_id: number;
    username: string;
    avatar_id?: number | null;
    headline: string;
    status: 'pending' | 'active';
}

export interface TutorProfileInput {
    headline: string;
    bio?: string | null;
    subjects?: string[] | null;
    hourly_rate?: number | null;
    is_listed: boolean;
}

export const listTutors = () =>
    api.get<TutorCard[]>('/api/tutors').then((r) => r.data);

export const getTutor = (tutorId: number) =>
    api.get<TutorCard>(`/api/tutors/${tutorId}`).then((r) => r.data);

export const getMyTutorProfile = () =>
    api.get<TutorCard | null>('/api/tutors/me/profile').then((r) => r.data);

export const upsertMyTutorProfile = (body: TutorProfileInput) =>
    api.put<TutorCard>('/api/tutors/me/profile', body).then((r) => r.data);

export const getMyStudents = () =>
    api.get<StudentCard[]>('/api/tutors/me/students').then((r) => r.data);

export const acceptStudent = (studentId: number) =>
    api.post<StudentCard>(`/api/tutors/me/students/${studentId}/accept`).then((r) => r.data);

export const connectToTutor = (tutorId: number) =>
    api.post<TutorCard>(`/api/tutors/${tutorId}/connect`).then((r) => r.data);

export const getMyTutors = () =>
    api.get<TutorConnection[]>('/api/me/tutors').then((r) => r.data);

// --- Фаза 2: прогресс ученика для репетитора ---

export interface StudentActivity {
    total_attempts: number;
    accuracy_pct: number;
    streak_days: number;
    total_time_hours: number;
    total_points: number;
}

export interface RecentActivityItem {
    id: number;
    title: string;
    topic: string;
    is_correct: boolean;
    time_spent_ms: number | null;
    created_at: string;
}

export interface TopicProgress {
    skill_id: number;
    skill_name: string;
    level: string;
    progress_pct: number;
    done: number;
}

export interface StudentProgressDashboard {
    activity: StudentActivity;
    recent_activity: RecentActivityItem[];
    topics_progress: TopicProgress[];
}

export interface TutorStudentDashboard {
    student: StudentCard;
    dashboard: StudentProgressDashboard;
}

export const getStudentDashboard = (studentId: number) =>
    api.get<TutorStudentDashboard>(`/api/tutors/me/students/${studentId}/dashboard`).then((r) => r.data);

// --- Фаза 3: задания репетитора ученику ---

export type AssignmentKind = 'exam' | 'game' | 'material' | 'custom';

export interface Assignment {
    id: number;
    kind: AssignmentKind;
    title: string;
    link?: string | null;
    note?: string | null;
    due_at?: string | null;
    status: 'assigned' | 'done';
    created_at?: string | null;
    completed_at?: string | null;
    // Только в списке ученика:
    tutor_username?: string | null;
    tutor_avatar_id?: number | null;
}

export interface AssignmentInput {
    kind: AssignmentKind;
    title: string;
    link?: string | null;
    note?: string | null;
    due_at?: string | null;
}

export const getStudentAssignments = (studentId: number) =>
    api.get<Assignment[]>(`/api/tutors/me/students/${studentId}/assignments`).then((r) => r.data);

export const createAssignment = (studentId: number, body: AssignmentInput) =>
    api.post<Assignment>(`/api/tutors/me/students/${studentId}/assignments`, body).then((r) => r.data);

export const deleteAssignment = (assignmentId: number) =>
    api.delete(`/api/tutors/me/assignments/${assignmentId}`).then((r) => r.data);

export const getMyAssignments = () =>
    api.get<Assignment[]>('/api/me/assignments').then((r) => r.data);

export const completeAssignment = (assignmentId: number, done = true) =>
    api.post<Assignment>(`/api/me/assignments/${assignmentId}/complete`, null, { params: { done } }).then((r) => r.data);

// --- Фаза 5: занятия/конференции ---

export interface TutorSessionCard {
    id: number;
    starts_at: string;
    duration_min: number;
    title?: string | null;
    meeting_url?: string | null;
    note?: string | null;
    status: 'scheduled' | 'cancelled';
    // Одна из сторон — зависит от того, чья агенда:
    student_id?: number | null;
    student_username?: string | null;
    student_avatar_id?: number | null;
    tutor_username?: string | null;
    tutor_avatar_id?: number | null;
}

export interface SessionInput {
    starts_at: string;         // ISO
    duration_min: number;
    title?: string | null;
    meeting_url?: string | null;
    note?: string | null;
}

export const getMyAgenda = () =>
    api.get<TutorSessionCard[]>('/api/tutors/me/sessions').then((r) => r.data);

export const getStudentSessions = (studentId: number) =>
    api.get<TutorSessionCard[]>(`/api/tutors/me/students/${studentId}/sessions`).then((r) => r.data);

export const createSession = (studentId: number, body: SessionInput) =>
    api.post<TutorSessionCard>(`/api/tutors/me/students/${studentId}/sessions`, body).then((r) => r.data);

export const updateSession = (sessionId: number, body: SessionInput) =>
    api.put<TutorSessionCard>(`/api/tutors/me/sessions/${sessionId}`, body).then((r) => r.data);

export const cancelSession = (sessionId: number) =>
    api.delete(`/api/tutors/me/sessions/${sessionId}`).then((r) => r.data);

export const getMySessions = () =>
    api.get<TutorSessionCard[]>('/api/me/sessions').then((r) => r.data);

// --- Фаза 4: свой контент репетитора ---

export type ContentKind = 'task' | 'material';

export interface TutorContentItem {
    id: number;
    kind: ContentKind;
    title: string;
    body?: string | null;
    answer?: string | null;
    attachment_url?: string | null;
    created_at?: string | null;
    tutor_username?: string | null;
}

export interface ContentInput {
    kind: ContentKind;
    title: string;
    body?: string | null;
    answer?: string | null;
    attachment_url?: string | null;
}

export const getMyContent = () =>
    api.get<TutorContentItem[]>('/api/tutors/me/content').then((r) => r.data);

export const createContent = (body: ContentInput) =>
    api.post<TutorContentItem>('/api/tutors/me/content', body).then((r) => r.data);

export const updateContent = (id: number, body: ContentInput) =>
    api.put<TutorContentItem>(`/api/tutors/me/content/${id}`, body).then((r) => r.data);

export const deleteContent = (id: number) =>
    api.delete(`/api/tutors/me/content/${id}`).then((r) => r.data);

export const getContent = (id: number) =>
    api.get<TutorContentItem>(`/api/tutors/content/${id}`).then((r) => r.data);
