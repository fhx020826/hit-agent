function getDefaultApiBase() {
  const protocol = process.env.NEXT_PUBLIC_API_PROTOCOL || "http";
  const port = process.env.NEXT_PUBLIC_API_PORT || "8000";

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }

  return `${protocol}://127.0.0.1:${port}`;
}

const RESOLVED_API_BASE = process.env.NEXT_PUBLIC_API_BASE || getDefaultApiBase();
const TOKEN_KEY = "hit-agent-token";

export { RESOLVED_API_BASE as API_BASE, TOKEN_KEY };

function getToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) || "";
}

function resolveRequestUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${RESOLVED_API_BASE}${path}`;
}

async function request<T>(path: string, options?: RequestInit, auth = true): Promise<T> {
  const headers = new Headers(options?.headers || {});
  if (!(options?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${RESOLVED_API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `接口请求失败：${res.status}`);
  }
  return res.json();
}

async function requestBinary(path: string, options?: RequestInit, auth = true): Promise<Response> {
  const headers = new Headers(options?.headers || {});
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(resolveRequestUrl(path), { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `接口请求失败：${res.status}`);
  }
  return res;
}

function getFilenameFromDisposition(disposition: string | null, fallback = "download") {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const asciiMatch = disposition.match(/filename="?([^";]+)"?/i);
  return asciiMatch?.[1] || fallback;
}

async function fetchProtectedFile(path: string, fallbackName?: string) {
  const response = await requestBinary(path);
  const blob = await response.blob();
  const filename = getFilenameFromDisposition(response.headers.get("Content-Disposition"), fallbackName);
  return {
    blob,
    filename,
    contentType: blob.type || response.headers.get("Content-Type") || "",
    objectUrl: URL.createObjectURL(blob),
  };
}

async function openProtectedFile(path: string, fallbackName?: string) {
  if (typeof window === "undefined") return;
  const { objectUrl } = await fetchProtectedFile(path, fallbackName);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

async function downloadProtectedFile(path: string, fallbackName?: string) {
  if (typeof window === "undefined") return;
  const { objectUrl, filename } = await fetchProtectedFile(path, fallbackName);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename || fallbackName || "download";
  anchor.rel = "noopener noreferrer";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000);
}

export interface AppearanceSetting {
  user_role: string;
  user_id: string;
  mode: string;
  accent: string;
  font: string;
  skin: string;
  language: string;
  updated_at: string;
}

export interface UserProfile {
  real_name: string;
  gender: string;
  college: string;
  major: string;
  grade: string;
  class_name: string;
  student_no: string;
  teacher_no: string;
  department: string;
  teaching_group: string;
  role_title: string;
  birth_date: string;
  email: string;
  phone: string;
  avatar_path: string;
  bio: string;
  research_direction: string;
  interests: string;
  common_courses: string[];
  linked_classes: string[];
  updated_at: string;
}

export interface CurrentUser {
  id: string;
  role: "admin" | "teacher" | "student";
  account: string;
  display_name: string;
  status: string;
  created_at: string;
  profile: UserProfile;
}

export interface AuthLoginResponse {
  token: string;
  user: CurrentUser;
}

export interface Course {
  id: string;
  name: string;
  audience: string;
  class_name: string;
  student_level: string;
  chapter: string;
  objectives: string;
  duration_minutes: number;
  frontier_direction: string;
  owner_user_id: string;
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

export interface AgentConfig {
  course_id: string;
  scope_rules: string;
  answer_style: string;
  enable_homework_support: boolean;
  enable_material_qa: boolean;
  enable_frontier_extension: boolean;
  updated_at: string;
}

export interface ModelOption {
  key: string;
  label: string;
  provider: string;
  model_name: string;
  supports_vision: boolean;
  is_default: boolean;
  description: string;
  availability_note: string;
}

export interface UploadedAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  parse_status: string;
  parse_summary: string;
  created_at: string;
  download_url: string;
}

export interface QuestionRecord {
  id: string;
  session_id: string;
  course_id: string;
  lesson_pack_id: string;
  question_text: string;
  answer_target_type: "ai" | "teacher" | "both";
  selected_model: string;
  anonymous: boolean;
  status: string;
  teacher_reply_status: string;
  ai_answer_content: string;
  ai_answer_time: string;
  ai_answer_sources: string[];
  teacher_answer_content: string;
  teacher_answer_time: string;
  has_attachments: boolean;
  attachment_count: number;
  input_mode: string;
  collected: boolean;
  folder_id: string;
  folder_name: string;
  created_at: string;
  updated_at: string;
  attachment_items: UploadedAttachment[];
  asker_display_name: string;
  asker_class_name: string;
}

export interface ChatSessionSummary {
  id: string;
  course_id: string;
  lesson_pack_id: string;
  title: string;
  selected_model: string;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionDetail extends ChatSessionSummary {
  questions: QuestionRecord[];
}

export interface WeaknessAnalysis {
  course_id: string;
  course_name: string;
  total_questions: number;
  summary: string;
  weak_points: string[];
  suggestions: string[];
  updated_at: string;
}

export interface QuestionFolderItem {
  id: string;
  course_id: string;
  name: string;
  description: string;
  question_count: number;
  created_at: string;
  updated_at: string;
}

export interface AssignmentSummary {
  id: string;
  teacher_id: string;
  course_id: string;
  title: string;
  description: string;
  target_class: string;
  deadline: string;
  attachment_requirements: string;
  submission_format: string;
  grading_notes: string;
  allow_resubmit: boolean;
  enable_ai_feedback: boolean;
  remind_days: number;
  status: string;
  created_at: string;
}

export interface CourseClassItem {
  id: string;
  course_id: string;
  class_name: string;
  discussion_space_id: string;
}

export interface AssignmentReceiptStatus {
  assignment_id: string;
  confirmed: boolean;
  confirmed_at: string;
}

export interface AssignmentSubmissionItem {
  file_name: string;
  file_type: string;
  file_size: number;
  download_url: string;
}

export interface AssignmentSubmissionSummary {
  id: string;
  assignment_id: string;
  student_id: string;
  status: string;
  submitted_at: string;
  resubmitted_count: number;
  files: AssignmentSubmissionItem[];
}

export interface AssignmentFeedbackSummary {
  summary: string;
  structure_feedback: string[];
  logic_feedback: string[];
  writing_feedback: string[];
  rubric_reference: string[];
  teacher_note: string;
  created_at: string;
}

export interface AssignmentStudentView {
  assignment: AssignmentSummary;
  receipt: AssignmentReceiptStatus;
  submission?: AssignmentSubmissionSummary | null;
  feedback?: AssignmentFeedbackSummary | null;
}

export interface AssignmentTeacherRosterItem {
  user_id: string;
  display_name: string;
  class_name: string;
  confirmed: boolean;
  confirmed_at: string;
  submitted: boolean;
  submitted_at: string;
}

export interface AssignmentTeacherDetail {
  assignment: AssignmentSummary;
  submitted_students: AssignmentTeacherRosterItem[];
  unsubmitted_students: AssignmentTeacherRosterItem[];
  confirmed_but_unsubmitted: AssignmentTeacherRosterItem[];
  unconfirmed_students: AssignmentTeacherRosterItem[];
}

export interface MaterialUpdateResult {
  id: string;
  title: string;
  summary: string;
  update_suggestions: string[];
  draft_pages: string[];
  image_suggestions: string[];
  selected_model: string;
  used_model_name: string;
  model_status: string;
  created_at: string;
}

export interface SurveyPendingItem {
  id: string;
  lesson_pack_id: string;
  course_id: string;
  title: string;
  questions: { id: string; type: string; title: string; options?: string[] }[];
  created_at: string;
}

export interface SurveyAnalytics {
  survey_instance_id: string;
  title: string;
  total_target_students: number;
  participation_count: number;
  participation_rate: number;
  rating_breakdown: Record<string, Record<string, number>>;
  choice_breakdown: Record<string, Record<string, number>>;
  text_feedback: string[];
}

export interface AnalyticsReport {
  lesson_pack_id: string;
  total_questions: number;
  anonymous_questions: number;
  identified_questions: number;
  high_freq_topics: string[];
  confused_concepts: string[];
  knowledge_gaps: string[];
  teaching_suggestions: string[];
  recent_questions: { created_at: string; question: string; in_scope: boolean; anonymous: boolean; student_display_name: string; student_grade: string; student_major: string }[];
}

export interface AssignmentReviewResponse {
  summary: string;
  structure_feedback: string[];
  logic_feedback: string[];
  writing_feedback: string[];
  rubric_reference: string[];
  teacher_note: string;
}

export interface TeacherNotification {
  id: string;
  message_type: string;
  related_question_id: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface MaterialItem {
  id: number;
  filename: string;
  file_type: string;
  created_at: string;
  download_url: string;
  size: number;
}

export interface ClassroomShare {
  id: string;
  course_id: string;
  teacher_id: string;
  title: string;
  description: string;
  share_scope: string;
  share_type: string;
  status: string;
  created_at: string;
  materials: MaterialItem[];
}

export interface MaterialRequestItem {
  id: string;
  course_id: string;
  student_id: string;
  student_name: string;
  anonymous: boolean;
  request_text: string;
  status: string;
  created_at: string;
}

export interface DiscussionSpaceSummary {
  id: string;
  course_id: string;
  class_name: string;
  space_name: string;
  ai_assistant_enabled: boolean;
  member_count: number;
  created_at: string;
}

export interface DiscussionMemberItem {
  user_id: string;
  display_name: string;
  role_in_space: string;
  avatar_path: string;
  joined_at: string;
}

export interface DiscussionAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  parse_status: string;
  created_at: string;
  download_url: string;
}

export interface DiscussionMessageItem {
  id: string;
  space_id: string;
  sender_user_id: string;
  sender_type: string;
  sender_display_name: string;
  sender_avatar_path: string;
  is_anonymous: boolean;
  message_type: string;
  content: string;
  reply_to_message_id: string;
  created_at: string;
  has_attachments: boolean;
  attachments: DiscussionAttachment[];
  ai_sources: string[];
  can_locate: boolean;
}

export interface DiscussionSpaceDetail extends DiscussionSpaceSummary {
  course_name: string;
  members: DiscussionMemberItem[];
  recent_materials: MaterialItem[];
}

export interface DiscussionSearchResult {
  items: DiscussionMessageItem[];
  page: number;
  page_size: number;
  total: number;
}

export interface DiscussionContextResponse {
  anchor_message_id: string;
  messages: DiscussionMessageItem[];
}

export interface AdminUserItem {
  id: string;
  role: "admin" | "teacher" | "student";
  account: string;
  display_name: string;
  status: string;
  created_at: string;
  class_name: string;
  college: string;
  major: string;
  email: string;
}

export interface LiveShareRecord {
  id: string;
  material_id: number;
  course_id: string;
  shared_by_teacher_id: string;
  share_target_type: string;
  share_target_id: string;
  is_active: boolean;
  current_page: number;
  started_at: string;
  ended_at: string;
}

export interface AnnotationStroke {
  id: string;
  material_id: number;
  share_record_id: string;
  page_no: number;
  tool_type: string;
  color: string;
  line_width: number;
  points_data: { x: number; y: number }[];
  is_temporary: boolean;
  created_by: string;
  created_at: string;
  expires_at: string;
}

export interface SavedAnnotationVersionItem {
  id: string;
  material_id: number;
  share_record_id: string;
  saved_by: string;
  version_name: string;
  save_mode: string;
  created_at: string;
}

export const api = {
  register: (payload: { role: "teacher" | "student"; account: string; password: string; confirm_password: string; profile: Omit<UserProfile, "updated_at"> }) => request<AuthLoginResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }, false),
  login: (payload: { role: "admin" | "teacher" | "student"; account: string; password: string }) => request<AuthLoginResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }, false),
  me: () => request<CurrentUser>("/api/auth/me"),
  logout: () => request<{ status: string }>("/api/auth/logout", { method: "POST" }),
  changePassword: (payload: { current_password: string; new_password: string; confirm_password: string }) => request<{ status: string; message: string }>("/api/auth/change-password", { method: "POST", body: JSON.stringify(payload) }),

  getProfile: () => request<UserProfile>("/api/profile/me"),
  updateProfile: (payload: Omit<UserProfile, "updated_at">) => request<UserProfile>("/api/profile/me", { method: "PUT", body: JSON.stringify(payload) }),
  uploadAvatar: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ avatar_path: string; updated_at: string }>("/api/profile/avatar", { method: "POST", body: form });
  },

  getMyAppearance: () => request<AppearanceSetting>("/api/settings/me"),
  updateMyAppearance: (payload: { mode: string; accent: string; font: string; skin: string; language: string }) => request<AppearanceSetting>("/api/settings/me", { method: "PUT", body: JSON.stringify(payload) }),

  listCourses: () => request<Course[]>("/api/courses"),
  createCourse: (payload: Omit<Course, "id" | "owner_user_id" | "created_at">) => request<Course>("/api/courses", { method: "POST", body: JSON.stringify(payload) }),
  listLessonPacks: (courseId?: string) => request<LessonPack[]>(`/api/lesson-packs${courseId ? `?course_id=${courseId}` : ""}`),
  generateLessonPack: (courseId: string) => request<LessonPack>(`/api/lesson-packs/generate/${courseId}`, { method: "POST" }),
  getLessonPack: (id: string) => request<LessonPack>(`/api/lesson-packs/${id}`),
  publishLessonPack: (id: string) => request<LessonPack>(`/api/lesson-packs/${id}/publish`, { method: "POST" }),
  uploadMaterial: async (courseId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<MaterialItem & { message: string }>(`/api/materials/upload/${courseId}`, { method: "POST", body: form });
  },
  listMaterials: (courseId: string) => request<MaterialItem[]>(`/api/materials/${courseId}`),
  createClassroomShare: (payload: { course_id: string; material_ids: number[]; title: string; description: string; share_scope?: string; share_type?: string }) => request<ClassroomShare>("/api/materials/share", { method: "POST", body: JSON.stringify(payload) }),
  listCurrentShares: (courseId?: string) => request<ClassroomShare[]>(`/api/materials/shares/current${courseId ? `?course_id=${courseId}` : ""}`),
  listTeacherShares: (courseId?: string) => request<ClassroomShare[]>(`/api/materials/shares/teacher${courseId ? `?course_id=${courseId}` : ""}`),
  requestCourseMaterial: (payload: { course_id: string; request_text: string }) => request<MaterialRequestItem>("/api/materials/requests", { method: "POST", body: JSON.stringify(payload) }),
  listMaterialRequests: (courseId?: string) => request<MaterialRequestItem[]>(`/api/materials/requests/teacher${courseId ? `?course_id=${courseId}` : ""}`),
  handleMaterialRequest: (requestId: string, status: "approved" | "rejected" | "shared") => request<MaterialRequestItem>(`/api/materials/requests/${requestId}/handle?status=${status}`, { method: "POST" }),
  startLiveShare: (payload: { material_id: number; share_target_type?: string; share_target_id?: string }) => request<LiveShareRecord>("/api/materials/live/start", { method: "POST", body: JSON.stringify(payload) }),
  updateLiveSharePage: (shareId: string, currentPage: number) => request<LiveShareRecord>(`/api/materials/live/${shareId}/page`, { method: "POST", body: JSON.stringify({ current_page: currentPage }) }),
  createAnnotationStroke: (shareId: string, payload: { page_no: number; tool_type: string; color: string; line_width: number; points_data: { x: number; y: number }[]; is_temporary: boolean; expires_in_seconds?: number }) => request<AnnotationStroke>(`/api/materials/live/${shareId}/annotations`, { method: "POST", body: JSON.stringify(payload) }),
  getCurrentLiveShare: (courseId: string) => request<LiveShareRecord | null>(`/api/materials/live/current?course_id=${courseId}`),
  listAnnotations: (shareId: string, pageNo?: number) => request<AnnotationStroke[]>(`/api/materials/live/${shareId}/annotations${typeof pageNo === "number" ? `?page_no=${pageNo}` : ""}`),
  endLiveShare: (shareId: string, payload: { save_mode: string; version_name?: string }) => request<LiveShareRecord>(`/api/materials/live/${shareId}/end`, { method: "POST", body: JSON.stringify(payload) }),
  listSavedAnnotationVersions: (shareId: string) => request<SavedAnnotationVersionItem[]>(`/api/materials/live/${shareId}/versions`),
  fetchProtectedFile,
  openProtectedFile,
  downloadProtectedFile,

  listDiscussionSpaces: () => request<DiscussionSpaceSummary[]>("/api/discussions/spaces"),
  getDiscussionSpace: (spaceId: string) => request<DiscussionSpaceDetail>(`/api/discussions/spaces/${spaceId}`),
  listDiscussionMessages: (spaceId: string, page = 1, pageSize = 30) => request<DiscussionSearchResult>(`/api/discussions/spaces/${spaceId}/messages?page=${page}&page_size=${pageSize}`),
  uploadDiscussionAttachments: async (spaceId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    return request<DiscussionAttachment[]>(`/api/discussions/attachments?space_id=${spaceId}`, { method: "POST", body: form });
  },
  sendDiscussionMessage: (payload: { space_id: string; content: string; is_anonymous: boolean; mention_ai: boolean; attachment_ids: string[] }) => request<DiscussionMessageItem[]>("/api/discussions/messages", { method: "POST", body: JSON.stringify(payload) }),
  searchDiscussionMessages: (params: { space_id: string; keyword?: string; sender_name?: string; sender_user_id?: string; sender_type?: string; message_type?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    q.set("space_id", params.space_id);
    if (params.keyword) q.set("keyword", params.keyword);
    if (params.sender_name) q.set("sender_name", params.sender_name);
    if (params.sender_user_id) q.set("sender_user_id", params.sender_user_id);
    if (params.sender_type) q.set("sender_type", params.sender_type);
    if (params.message_type) q.set("message_type", params.message_type);
    q.set("page", String(params.page || 1));
    q.set("page_size", String(params.page_size || 20));
    return request<DiscussionSearchResult>(`/api/discussions/search?${q.toString()}`);
  },
  listMemberDiscussionMessages: (spaceId: string, userId: string, page = 1, pageSize = 20) => request<DiscussionSearchResult>(`/api/discussions/spaces/${spaceId}/members/${userId}/messages?page=${page}&page_size=${pageSize}`),
  getDiscussionMessageContext: (messageId: string) => request<DiscussionContextResponse>(`/api/discussions/messages/${messageId}/context`),

  listAdminUsers: (params?: { role?: string; keyword?: string }) => {
    const q = new URLSearchParams();
    if (params?.role) q.set("role", params.role);
    if (params?.keyword) q.set("keyword", params.keyword);
    return request<AdminUserItem[]>(`/api/admin/users${q.toString() ? `?${q.toString()}` : ""}`);
  },
  createAdminUser: (payload: { role: "admin" | "teacher" | "student"; account: string; password: string; display_name: string; status: string; profile: Omit<UserProfile, "updated_at"> }) => request<AdminUserItem>("/api/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  updateAdminUser: (userId: string, payload: { display_name: string; status: string; profile: Omit<UserProfile, "updated_at"> }) => request<AdminUserItem>(`/api/admin/users/${userId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteAdminUser: (userId: string) => request<{ status: string }>(`/api/admin/users/${userId}`, { method: "DELETE" }),

  getAgentConfig: (courseId: string) => request<AgentConfig>(`/api/agent-config/${courseId}`),
  updateAgentConfig: (courseId: string, payload: Omit<AgentConfig, "course_id" | "updated_at">) => request<AgentConfig>(`/api/agent-config/${courseId}`, { method: "PUT", body: JSON.stringify({ ...payload, course_id: courseId }) }),

  listModels: () => request<ModelOption[]>("/api/qa/models"),
  uploadQuestionAttachments: async (files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    return request<UploadedAttachment[]>("/api/qa/attachments", { method: "POST", body: form });
  },
  createChatSession: (payload: { course_id: string; lesson_pack_id?: string; title?: string; selected_model?: string }) => request<ChatSessionSummary>("/api/qa/sessions", { method: "POST", body: JSON.stringify(payload) }),
  listChatSessions: (courseId?: string) => request<ChatSessionSummary[]>(`/api/qa/sessions${courseId ? `?course_id=${courseId}` : ""}`),
  getChatSession: (sessionId: string) => request<ChatSessionDetail>(`/api/qa/sessions/${sessionId}`),
  askQuestion: (payload: { session_id: string; course_id: string; lesson_pack_id?: string; question: string; answer_target_type: "ai" | "teacher" | "both"; anonymous: boolean; selected_model: string; attachment_ids: string[] }) => request<QuestionRecord>("/api/qa/ask", { method: "POST", body: JSON.stringify(payload) }),
  listQuestionFolders: (courseId?: string) => request<QuestionFolderItem[]>(`/api/qa/folders${courseId ? `?course_id=${courseId}` : ""}`),
  createQuestionFolder: (payload: { course_id: string; name: string; description?: string }) => request<QuestionFolderItem>("/api/qa/folders", { method: "POST", body: JSON.stringify(payload) }),
  updateQuestionFolder: (folderId: string, payload: { name: string; description?: string }) => request<QuestionFolderItem>(`/api/qa/folders/${folderId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteQuestionFolder: (folderId: string) => request<{ status: string }>(`/api/qa/folders/${folderId}`, { method: "DELETE" }),
  listQuestionHistory: (params?: { courseId?: string; folderId?: string; collectedOnly?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.courseId) q.set("course_id", params.courseId);
    if (params?.folderId) q.set("folder_id", params.folderId);
    if (params?.collectedOnly) q.set("collected_only", "true");
    return request<QuestionRecord[]>(`/api/qa/history${q.toString() ? `?${q.toString()}` : ""}`);
  },
  toggleCollect: (questionId: string) => request<{ status: string; collected: boolean }>(`/api/qa/questions/${questionId}/collect`, { method: "POST" }),
  assignQuestionFolder: (questionId: string, folderId: string) => request<QuestionRecord>(`/api/qa/questions/${questionId}/folder`, { method: "PUT", body: JSON.stringify({ folder_id: folderId }) }),
  getWeaknessAnalysis: (courseId?: string) => request<WeaknessAnalysis>(`/api/qa/weakness-analysis${courseId ? `?course_id=${courseId}` : ""}`),
  listTeacherQuestions: (params?: { status?: string; course_id?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.course_id) q.set("course_id", params.course_id);
    return request<QuestionRecord[]>(`/api/qa/teacher/questions${q.toString() ? `?${q.toString()}` : ""}`);
  },
  replyTeacherQuestion: (questionId: string, payload: { reply_content: string; status?: string }) => request<QuestionRecord>(`/api/qa/teacher/questions/${questionId}/reply`, { method: "POST", body: JSON.stringify(payload) }),
  listTeacherNotifications: () => request<TeacherNotification[]>("/api/qa/teacher/notifications"),
  updateTeacherNotificationRead: (id: string, isRead: boolean) => request<{ status: string; is_read: boolean }>(`/api/qa/teacher/notifications/${id}/read?is_read=${isRead ? "true" : "false"}`, { method: "POST" }),

  createAssignment: (payload: { course_id: string; title: string; description: string; target_class: string; deadline: string; attachment_requirements: string; submission_format: string; grading_notes: string; allow_resubmit: boolean; enable_ai_feedback: boolean; remind_days: number }) => request<AssignmentSummary>("/api/assignments", { method: "POST", body: JSON.stringify(payload) }),
  listTeacherAssignments: () => request<AssignmentSummary[]>("/api/assignments/teacher"),
  listTeacherCourseClasses: (courseId?: string) => request<CourseClassItem[]>(`/api/assignments/teacher/class-options${courseId ? `?course_id=${courseId}` : ""}`),
  listStudentAssignments: () => request<AssignmentStudentView[]>("/api/assignments/student"),
  confirmAssignment: (assignmentId: string) => request<AssignmentReceiptStatus>(`/api/assignments/${assignmentId}/confirm`, { method: "POST" }),
  submitAssignment: async (assignmentId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    return request<AssignmentSubmissionSummary>(`/api/assignments/${assignmentId}/submit`, { method: "POST", body: form });
  },
  getTeacherAssignmentDetail: (assignmentId: string) => request<AssignmentTeacherDetail>(`/api/assignments/teacher/${assignmentId}`),

  previewAssignmentReview: (payload: { course_id?: string; assignment_type: string; title: string; requirements?: string; submission_text: string }) => request<AssignmentReviewResponse>("/api/assignment-review/preview", { method: "POST", body: JSON.stringify(payload) }),

  previewMaterialUpdate: (payload: { course_id?: string; title?: string; instructions?: string; material_text?: string; selected_model?: string }) => request<MaterialUpdateResult>("/api/material-update/preview", { method: "POST", body: JSON.stringify(payload) }),
  uploadMaterialUpdate: async (payload: { course_id?: string; title?: string; instructions?: string; selected_model?: string; file: File }) => {
    const form = new FormData();
    if (payload.course_id) form.append("course_id", payload.course_id);
    if (payload.title) form.append("title", payload.title);
    if (payload.instructions) form.append("instructions", payload.instructions);
    if (payload.selected_model) form.append("selected_model", payload.selected_model);
    form.append("file", payload.file);
    return request<MaterialUpdateResult>("/api/material-update/upload", { method: "POST", body: form });
  },
  listMaterialUpdates: () => request<MaterialUpdateResult[]>("/api/material-update"),

  listPendingSurveys: () => request<SurveyPendingItem[]>("/api/feedback/pending"),
  listSurveyTemplates: () => request<{ id: string; name: string; description: string; questions: { id: string; type: string; title: string; options?: string[] }[]; created_at: string }[]>("/api/feedback/templates"),
  createSurveyInstance: (payload: { lesson_pack_id: string; course_id: string; template_id?: string; title?: string; trigger_mode?: string }) => request<{ id: string; lesson_pack_id: string; course_id: string; template_id: string; title: string; status: string; trigger_mode: string; created_at: string }>("/api/feedback/instances", { method: "POST", body: JSON.stringify(payload) }),
  submitSurvey: (surveyId: string, answers: Record<string, unknown>) => request<{ status: string }>(`/api/feedback/instances/${surveyId}/submit`, { method: "POST", body: JSON.stringify({ answers }) }),
  skipSurvey: (surveyId: string) => request<{ status: string }>(`/api/feedback/instances/${surveyId}/skip`, { method: "POST" }),
  getSurveyAnalytics: (surveyId: string) => request<SurveyAnalytics>(`/api/feedback/analytics/${surveyId}`),

  getAnalytics: (lpId: string) => request<AnalyticsReport>(`/api/analytics/${lpId}`),
};
