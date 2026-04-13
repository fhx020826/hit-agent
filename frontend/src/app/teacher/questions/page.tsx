"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { RichAnswer } from "@/components/rich-answer";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, type Course, type QuestionRecord, type TeacherNotification } from "@/lib/api";
import { pick } from "@/lib/i18n";

type QuestionFilterStatus = "all" | "pending" | "replied" | "closed";

function getVisibleTeacherReply(question: QuestionRecord | null | undefined) {
  if (!question || question.teacher_reply_status === "pending") return "";
  return question.teacher_answer_content || "";
}

export default function TeacherQuestionsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [notifications, setNotifications] = useState<TeacherNotification[]>([]);
  const [allQuestions, setAllQuestions] = useState<QuestionRecord[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<QuestionFilterStatus>("all");
  const [activeQuestionId, setActiveQuestionId] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [message, setMessage] = useState("");

  const teacherCourses = useMemo(() => {
    if (!user) return courses;
    const taughtNames = new Set(user.profile.common_courses || []);
    const filtered = courses.filter((course) => course.owner_user_id === user.id || taughtNames.has(course.name));
    return filtered.length > 0 ? filtered : courses;
  }, [courses, user]);

  const courseNameMap = useMemo(
    () => Object.fromEntries(teacherCourses.map((course) => [course.id, course.name])),
    [teacherCourses],
  );

  const loadNotifications = useCallback(async () => {
    const items = await api.listTeacherNotifications();
    setNotifications(items);
  }, []);

  const loadAllQuestions = useCallback(async () => {
    const items = await api.listTeacherQuestions();
    setAllQuestions(items);
    const nextActive = items.find((item) => item.id === activeQuestionId) || items[0] || null;
    setActiveQuestionId(nextActive?.id || "");
    setReplyDraft(getVisibleTeacherReply(nextActive));
    return items;
  }, [activeQuestionId]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) router.push("/");
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || user.role !== "teacher") return;
    let alive = true;
    const load = async () => {
      try {
        const [courseList, notificationList, questionList] = await Promise.all([
          api.listCourses(),
          api.listTeacherNotifications(),
          api.listTeacherQuestions(),
        ]);
        if (!alive) return;
        setCourses(courseList);
        setNotifications(notificationList);
        setAllQuestions(questionList);
        const firstId = questionList[0]?.id || "";
        setActiveQuestionId(firstId);
        setReplyDraft(getVisibleTeacherReply(questionList[0] || null));
      } catch {
        if (!alive) return;
        setCourses([]);
        setNotifications([]);
        setAllQuestions([]);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [user]);

  const filteredQuestions = useMemo(() => {
    return allQuestions.filter((item) => {
      const matchCourse = selectedCourseId === "all" || item.course_id === selectedCourseId;
      const matchStatus = statusFilter === "all" || item.teacher_reply_status === statusFilter;
      return matchCourse && matchStatus;
    });
  }, [allQuestions, selectedCourseId, statusFilter]);

  const activeQuestion = useMemo(() => {
    return filteredQuestions.find((item) => item.id === activeQuestionId) || filteredQuestions[0] || null;
  }, [activeQuestionId, filteredQuestions]);

  const groupedQuestions = useMemo(() => {
    const groups = new Map<string, QuestionRecord[]>();
    filteredQuestions.forEach((item) => {
      const key = item.course_id || "unassigned";
      const prev = groups.get(key) || [];
      prev.push(item);
      groups.set(key, prev);
    });
    return Array.from(groups.entries()).map(([courseId, items]) => ({
      courseId,
      title: courseNameMap[courseId] || pick(language, "未关联课程", "Unassigned Course"),
      items,
    }));
  }, [courseNameMap, filteredQuestions, language]);

  const unreadNotificationCount = notifications.filter((item) => !item.is_read).length;

  const activeStatusMeta = useMemo(() => {
    if (!activeQuestion) {
      return {
        label: pick(language, "未选择问题", "No Question Selected"),
        note: "",
      };
    }
    if (activeQuestion.teacher_reply_status === "pending") {
      return {
        label: pick(language, "待处理", "Pending"),
        note: pick(language, "当前仍处于待处理状态，学生端不会显示教师回复内容。", "This question is still pending, and the student side will not show any teacher reply yet."),
      };
    }
    if (activeQuestion.teacher_reply_status === "replied") {
      return {
        label: pick(language, "已回复", "Replied"),
        note: pick(language, "当前已处理，学生端会显示教师回复内容。", "This question has been handled, and the student side will display the teacher reply."),
      };
    }
    if (activeQuestion.teacher_reply_status === "closed") {
      return {
        label: pick(language, "已关闭", "Closed"),
        note: pick(language, "当前已关闭，学生端会看到最终处理状态。", "This question is closed, and the student side will see the final handling state."),
      };
    }
    return {
      label: pick(language, "未请求", "Not Requested"),
      note: pick(language, "当前还没有进入教师处理流程。", "This question has not entered the teacher-handling workflow yet."),
    };
  }, [activeQuestion, language]);

  const refreshData = useCallback(async () => {
    await Promise.all([loadNotifications(), loadAllQuestions()]);
  }, [loadAllQuestions, loadNotifications]);

  const openQuestionAttachment = async (question: QuestionRecord) => {
    for (const attachment of question.attachment_items) {
      await api.openProtectedFile(attachment.download_url, attachment.file_name);
    }
  };

  const setNotificationReadState = async (notificationId: string, isRead: boolean) => {
    await api.updateTeacherNotificationRead(notificationId, isRead);
    const refreshed = await api.listTeacherNotifications();
    setNotifications(refreshed);
  };

  const locateQuestionFromNotification = async (questionId: string) => {
    let pool = allQuestions;
    if (!pool.some((item) => item.id === questionId)) {
      pool = await loadAllQuestions();
    }
    const target = pool.find((item) => item.id === questionId);
    if (!target) return;
    setSelectedCourseId(target.course_id || "all");
    setStatusFilter("all");
    setActiveQuestionId(target.id);
    setReplyDraft(getVisibleTeacherReply(target));
    setMessage("");
  };

  const applyFilters = (courseId: string, status: QuestionFilterStatus) => {
    const nextList = allQuestions.filter((item) => {
      const matchCourse = courseId === "all" || item.course_id === courseId;
      const matchStatus = status === "all" || item.teacher_reply_status === status;
      return matchCourse && matchStatus;
    });
    const nextActive = nextList.find((item) => item.id === activeQuestionId) || nextList[0] || null;
    setSelectedCourseId(courseId);
    setStatusFilter(status);
    setActiveQuestionId(nextActive?.id || "");
    setReplyDraft(getVisibleTeacherReply(nextActive));
    setMessage("");
  };

  const submitReply = async (status: "replied" | "closed" | "pending") => {
    if (!activeQuestion) return;
    await api.replyTeacherQuestion(activeQuestion.id, {
      reply_content: status === "pending" ? "" : replyDraft,
      status,
    });
    setMessage(
      status === "replied"
        ? pick(language, "教师回复已更新。", "Teacher reply updated.")
        : status === "closed"
          ? pick(language, "该问题已关闭。", "This question has been closed.")
          : pick(language, "该问题已重新设为待处理。", "This question has been set back to pending."),
    );
    await refreshData();
  };

  if (!user || user.role !== "teacher") {
    return (
      <WorkspacePage tone="teacher">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载学生提问反馈中心...", "Loading student question center...")}</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="teacher" className="grid gap-5 xl:grid-cols-[0.96fr_1.04fr]">
      <section className="glass-panel rounded-[32px] px-5 py-6 md:px-6">
        <div className="border-b border-slate-200 pb-4">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "学生提问反馈中心", "Student Question Center")}</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">{pick(language, "按课程分类查看学生提问、通知和回复状态", "Review student questions, alerts, and reply states by course")}</h2>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-white/75 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">{pick(language, "提问提醒", "Question Alerts")}</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {pick(language, "未读", "Unread")} {unreadNotificationCount}
            </span>
          </div>
          <div className="mt-3 space-y-3">
            {notifications.length === 0 ? (
              <div className="text-sm text-slate-500">{pick(language, "当前没有提醒。", "There are no alerts right now.")}</div>
            ) : notifications.map((item) => (
              <div key={item.id} className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.is_read ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"}`}>
                    {item.is_read ? pick(language, "已读", "Read") : pick(language, "未读", "Unread")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.created_at}</p>
                <p className="mt-2">{item.content}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => void setNotificationReadState(item.id, !item.is_read)} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                    {item.is_read ? pick(language, "撤回已读", "Mark as Unread") : pick(language, "标记已读", "Mark as Read")}
                  </button>
                  <button onClick={() => void locateQuestionFromNotification(item.related_question_id)} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                    {pick(language, "定位问题", "Open Question")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-white/75 p-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => applyFilters("all", statusFilter)} className={`rounded-full px-4 py-2 text-sm font-semibold ${selectedCourseId === "all" ? "ui-pill-active" : "ui-pill"}`}>
              {pick(language, "全部课程", "All Courses")}
            </button>
            {teacherCourses.map((course) => (
              <button key={course.id} onClick={() => applyFilters(course.id, statusFilter)} className={`rounded-full px-4 py-2 text-sm font-semibold ${selectedCourseId === course.id ? "ui-pill-active" : "ui-pill"}`}>
                {course.name}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["all", "pending", "replied", "closed"] as QuestionFilterStatus[]).map((item) => (
              <button key={item} onClick={() => applyFilters(selectedCourseId, item)} className={`rounded-full px-4 py-2 text-sm font-semibold ${statusFilter === item ? "ui-pill-active" : "ui-pill"}`}>
                {item === "all" ? pick(language, "全部状态", "All Statuses") : item === "pending" ? pick(language, "待处理", "Pending") : item === "replied" ? pick(language, "已回复", "Replied") : pick(language, "已关闭", "Closed")}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {groupedQuestions.length === 0 ? (
            <div className="section-card rounded-[24px] p-6 text-center text-slate-500">{pick(language, "当前筛选条件下没有问题。", "There are no questions under the current filters.")}</div>
          ) : groupedQuestions.map((group) => (
            <div key={group.courseId} className="rounded-[24px] border border-slate-200 bg-white/75 p-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <p className="font-semibold text-slate-900">{group.title}</p>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{group.items.length}</span>
              </div>
              <div className="mt-3 space-y-3">
                {group.items.map((item) => (
                  <button key={item.id} onClick={() => { setActiveQuestionId(item.id); setReplyDraft(getVisibleTeacherReply(item)); setMessage(""); }} className={`w-full rounded-[22px] px-4 py-4 text-left transition ${activeQuestion?.id === item.id ? "ui-tab-active" : "ui-pill text-slate-700"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{item.question_text || pick(language, "附件提问", "Attachment-based question")}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activeQuestion?.id === item.id ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}>
                        {item.teacher_reply_status === "pending" ? pick(language, "待处理", "Pending") : item.teacher_reply_status === "replied" ? pick(language, "已回复", "Replied") : item.teacher_reply_status === "closed" ? pick(language, "已关闭", "Closed") : pick(language, "未请求", "Not Requested")}
                      </span>
                    </div>
                    <p className={`mt-2 text-xs ${activeQuestion?.id === item.id ? "text-slate-300" : "text-slate-500"}`}>
                      {item.created_at} · {item.anonymous ? pick(language, "匿名学生", "Anonymous Student") : item.asker_display_name}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel rounded-[32px] px-5 py-6 md:px-6">
        {activeQuestion ? (
          <>
            <div className="border-b border-slate-200 pb-4">
              <p className="text-sm font-semibold text-slate-500">{pick(language, "问题详情", "Question Details")}</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">{activeQuestion.question_text || pick(language, "附件提问", "Attachment-based question")}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {pick(language, "所属学生：", "Student: ")}
                {activeQuestion.anonymous ? pick(language, "匿名学生", "Anonymous Student") : `${activeQuestion.asker_display_name}${activeQuestion.asker_class_name ? ` · ${activeQuestion.asker_class_name}` : ""}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                  {pick(language, "课程：", "Course: ")}
                  {courseNameMap[activeQuestion.course_id] || pick(language, "未关联课程", "Unassigned")}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                  {pick(language, "路由：", "Route: ")}
                  {activeQuestion.answer_target_type === "both" ? "AI + Teacher" : activeQuestion.answer_target_type === "teacher" ? pick(language, "仅教师", "Teacher only") : pick(language, "仅 AI", "AI only")}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                  {pick(language, "当前状态：", "Current Status: ")}
                  {activeQuestion.teacher_reply_status === "pending" ? pick(language, "待处理", "Pending") : activeQuestion.teacher_reply_status === "replied" ? pick(language, "已回复", "Replied") : activeQuestion.teacher_reply_status === "closed" ? pick(language, "已关闭", "Closed") : pick(language, "未请求", "Not Requested")}
                </span>
              </div>
            </div>

            {activeQuestion.attachment_items.length > 0 ? (
              <div className="mt-5 section-card rounded-[26px] p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-slate-900">{pick(language, "学生上传附件", "Student Attachments")}</h3>
                  <button onClick={() => void openQuestionAttachment(activeQuestion)} className="ui-pill rounded-full px-4 py-2 text-xs font-semibold">
                    {pick(language, "逐个打开附件", "Open Attachments")}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {activeQuestion.attachment_items.map((attachment) => (
                    <button key={attachment.id} onClick={() => void api.openProtectedFile(attachment.download_url, attachment.file_name)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                      {attachment.file_name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {activeQuestion.ai_answer_content ? (
              <div className="mt-5 rounded-[26px] bg-slate-900 px-5 py-5 text-sm leading-7 text-white">
                <p className="text-xs font-semibold text-slate-300">{pick(language, "AI 回答", "AI Answer")}</p>
                <RichAnswer content={activeQuestion.ai_answer_content} className="mt-2" />
              </div>
            ) : null}

            <div className="mt-5 section-card rounded-[26px] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-900">{pick(language, "教师回复", "Teacher Reply")}</h3>
                <span className="text-xs font-semibold text-slate-500">
                  {pick(language, "上次更新时间：", "Last updated: ")}
                  {activeQuestion.teacher_answer_time || activeQuestion.updated_at}
                </span>
              </div>
              <div className="mt-3 rounded-[20px] border border-slate-200 bg-white/75 px-4 py-3 text-sm leading-7 text-slate-600">
                <p className="font-semibold text-slate-900">
                  {pick(language, "当前处理标签：", "Current Status: ")}
                  {activeStatusMeta.label}
                </p>
                <p className="mt-1">{activeStatusMeta.note}</p>
              </div>
              <textarea value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} rows={7} placeholder={pick(language, "请输入教师回复内容，可用于补充、纠正或延伸说明。", "Enter the teacher reply here to supplement, correct, or extend the explanation.")} className="mt-4 w-full rounded-[24px] border border-slate-300 bg-white px-4 py-4 text-sm leading-7 text-slate-900" />
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => void submitReply("replied")} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90">
                  {pick(language, "提交回复", "Submit Reply")}
                </button>
                <button onClick={() => void submitReply("pending")} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white">
                  {pick(language, "重新设为待处理", "Set Back to Pending")}
                </button>
                <button onClick={() => void submitReply("closed")} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white">
                  {pick(language, "关闭问题", "Close Question")}
                </button>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                {pick(language, "说明：提交回复后标签会变为“已回复”；重新设为待处理时会清空学生端可见的教师回复内容。", "Note: submitting a reply changes the label to Replied; setting it back to Pending clears the teacher reply shown on the student side.")}
              </p>
              {message ? <p className="mt-2 text-sm text-slate-600">{message}</p> : null}
            </div>
          </>
        ) : (
          <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "请从左侧选择一个学生问题进行查看与回复。", "Choose a student question from the left to review and reply.")}</div>
        )}
      </section>
    </WorkspacePage>
  );
}
