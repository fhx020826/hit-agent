/** 后端 API 客户端 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export interface Course {
  id: string;
  name: string;
  audience: string;
  student_level: string;
  chapter: string;
  objectives: string;
  duration_minutes: number;
  frontier_direction: string;
  created_at: string;
}

export interface LessonPack {
  id: string;
  course_id: string;
  version: number;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface QAResponse {
  answer: string;
  evidence: string[];
  in_scope: boolean;
}

export interface AnalyticsReport {
  lesson_pack_id: string;
  total_questions: number;
  high_freq_topics: string[];
  confused_concepts: string[];
  knowledge_gaps: string[];
  teaching_suggestions: string[];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  // 课程
  listCourses: () => request<Course[]>("/api/courses"),
  getCourse: (id: string) => request<Course>(`/api/courses/${id}`),
  createCourse: (data: Omit<Course, "id" | "created_at">) =>
    request<Course>("/api/courses", { method: "POST", body: JSON.stringify(data) }),

  // 课时包
  listLessonPacks: (courseId?: string) =>
    request<LessonPack[]>(`/api/lesson-packs${courseId ? `?course_id=${courseId}` : ""}`),
  getLessonPack: (id: string) => request<LessonPack>(`/api/lesson-packs/${id}`),
  generateLessonPack: (courseId: string) =>
    request<LessonPack>(`/api/lesson-packs/generate/${courseId}`, { method: "POST" }),
  updateLessonPack: (id: string, data: { payload?: Record<string, unknown>; status?: string }) =>
    request<LessonPack>(`/api/lesson-packs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  publishLessonPack: (id: string) =>
    request<LessonPack>(`/api/lesson-packs/${id}/publish`, { method: "POST" }),

  // 学生端
  listPublishedPacks: () => request<{ id: string; course_id: string; frontier_topic: Record<string, unknown> }[]>("/api/student/lesson-packs"),
  getStudentLessonPack: (id: string) => request<{ id: string; frontier_topic: Record<string, unknown>; teaching_objectives: string[]; main_thread: string }>(`/api/student/lesson-packs/${id}`),
  studentQA: (lpId: string, question: string) =>
    request<QAResponse>(`/api/student/lesson-packs/${lpId}/qa`, { method: "POST", body: JSON.stringify({ question }) }),

  // 分析
  getAnalytics: (lpId: string) => request<AnalyticsReport>(`/api/analytics/${lpId}`),
};
