"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { RichAnswer } from "@/components/rich-answer";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, type Course, type QuestionFolderItem, type QuestionRecord, type UploadedAttachment } from "@/lib/api";
import { pick } from "@/lib/i18n";

type ArchiveMode = "all" | "collected" | "folder";

type QuestionSection = {
  key: string;
  title: string;
  hint: string;
  items: QuestionRecord[];
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export default function StudentQuestionHistoryPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [folders, setFolders] = useState<QuestionFolderItem[]>([]);
  const [archiveMode, setArchiveMode] = useState<ArchiveMode>("all");
  const [activeFolderId, setActiveFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/");
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || user.role !== "student") return;
    api.listCourses().then((courseList) => {
      setCourses(courseList);
      setSelectedCourseId(courseList[0]?.id || "");
    }).catch(() => setCourses([]));
  }, [user]);

  const loadArchive = useCallback(async (courseId: string) => {
    if (!courseId) {
      setQuestions([]);
      setFolders([]);
      return;
    }
    const [questionList, folderList] = await Promise.all([
      api.listQuestionHistory({ courseId }).catch(() => []),
      api.listQuestionFolders(courseId).catch(() => []),
    ]);
    setQuestions(questionList);
    setFolders(folderList);
    if (activeFolderId && !folderList.some((item) => item.id === activeFolderId)) {
      setActiveFolderId("");
      setArchiveMode("all");
    }
  }, [activeFolderId]);

  useEffect(() => {
    if (!selectedCourseId) return;
    void loadArchive(selectedCourseId);
  }, [loadArchive, selectedCourseId]);

  const selectedCourse = useMemo(() => courses.find((item) => item.id === selectedCourseId) || null, [courses, selectedCourseId]);

  const searchedQuestions = useMemo(() => {
    const query = normalizeText(keyword);
    if (!query) return questions;
    return questions.filter((item) => {
      const haystacks = [
        item.question_text,
        item.ai_answer_content,
        item.teacher_answer_content,
        item.folder_name,
      ];
      return haystacks.some((field) => normalizeText(field || "").includes(query));
    });
  }, [keyword, questions]);

  const filteredQuestions = useMemo(() => {
    if (archiveMode === "collected") return searchedQuestions.filter((item) => item.collected);
    if (archiveMode === "folder" && activeFolderId) return searchedQuestions.filter((item) => item.folder_id === activeFolderId);
    return searchedQuestions;
  }, [activeFolderId, archiveMode, searchedQuestions]);

  const sections = useMemo<QuestionSection[]>(() => {
    if (archiveMode === "folder") {
      const folder = folders.find((item) => item.id === activeFolderId);
      return folder ? [{
        key: folder.id,
        title: folder.name,
        hint: folder.description || pick(language, "按当前文件夹查看归档问题。", "Showing the questions filed in this folder."),
        items: filteredQuestions,
      }] : [];
    }

    const bucketMap = new Map<string, QuestionRecord[]>();
    const unfiledKey = "__unfiled__";

    filteredQuestions.forEach((item) => {
      const key = item.folder_id || unfiledKey;
      const prev = bucketMap.get(key) || [];
      prev.push(item);
      bucketMap.set(key, prev);
    });

    const result: QuestionSection[] = [];
    folders.forEach((folder) => {
      const items = bucketMap.get(folder.id) || [];
      if (items.length === 0 && archiveMode !== "all") return;
      if (items.length > 0) {
        result.push({
          key: folder.id,
          title: folder.name,
          hint: folder.description || pick(language, "适合按章节、模块或专题沉淀问题。", "Useful for organizing questions by chapter, module or topic."),
          items,
        });
      }
    });

    const unfiledItems = bucketMap.get(unfiledKey) || [];
    if (unfiledItems.length > 0 || archiveMode === "all") {
      result.push({
        key: unfiledKey,
        title: pick(language, "未归档", "Unfiled"),
        hint: pick(language, "这些问题还没有放进任何文件夹，适合后续继续整理。", "These questions are not in any folder yet and can be organized later."),
        items: unfiledItems,
      });
    }

    return result;
  }, [activeFolderId, archiveMode, filteredQuestions, folders, language]);

  const summary = useMemo(() => ({
    total: questions.length,
    collected: questions.filter((item) => item.collected).length,
    filed: questions.filter((item) => item.folder_id).length,
  }), [questions]);

  const openAttachment = async (attachment: UploadedAttachment) => {
    try {
      setMessage("");
      await api.openProtectedFile(attachment.download_url, attachment.file_name);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "附件打开失败", "Failed to open attachment."));
    }
  };

  const handleToggleCollect = async (questionId: string) => {
    try {
      setMessage("");
      await api.toggleCollect(questionId);
      await loadArchive(selectedCourseId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "收藏操作失败", "Failed to update collection status."));
    }
  };

  const handleAssignFolder = async (questionId: string, folderId: string) => {
    try {
      setMessage("");
      await api.assignQuestionFolder(questionId, folderId);
      await loadArchive(selectedCourseId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "归档失败", "Failed to move the question."));
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (deletingQuestionId) return;
    const confirmed = window.confirm(
      pick(language, "确认删除这条问答记录吗？删除后不可恢复。", "Delete this Q&A record? This action cannot be undone."),
    );
    if (!confirmed) return;
    setDeletingQuestionId(questionId);
    try {
      setMessage("");
      await api.deleteQuestion(questionId);
      await loadArchive(selectedCourseId);
      setMessage(pick(language, "问答记录已删除。", "Q&A record deleted."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "删除失败", "Delete failed."));
    } finally {
      setDeletingQuestionId("");
    }
  };

  const handleCreateFolder = async () => {
    if (!selectedCourseId) {
      setMessage(pick(language, "请先选择课程。", "Please select a course first."));
      return;
    }
    if (!newFolderName.trim()) {
      setMessage(pick(language, "文件夹名称不能为空。", "Folder name cannot be empty."));
      return;
    }
    setCreatingFolder(true);
    try {
      setMessage("");
      const folder = await api.createQuestionFolder({
        course_id: selectedCourseId,
        name: newFolderName.trim(),
        description: newFolderDesc.trim(),
      });
      setNewFolderName("");
      setNewFolderDesc("");
      await loadArchive(selectedCourseId);
      setArchiveMode("folder");
      setActiveFolderId(folder.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "创建文件夹失败", "Failed to create folder."));
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      setMessage("");
      await api.deleteQuestionFolder(folderId);
      await loadArchive(selectedCourseId);
      if (activeFolderId === folderId) {
        setActiveFolderId("");
        setArchiveMode("all");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "删除文件夹失败", "Failed to delete folder."));
    }
  };

  if (!user || user.role !== "student") {
    return (
      <WorkspacePage tone="student">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载学习问答记录...", "Loading Q&A archive...")}</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="student" className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <div className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "学习问答记录", "Q&A Archive")}</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900">{pick(language, "按课程与文件夹整理高价值问答", "Organize valuable Q&A by course and folder")}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {pick(language, "这里不再只是简单历史列表，而是你的课程问答知识库。你可以按课程切换、创建自定义文件夹、收藏重点问题，并把问题按章节、模块或专题整理沉淀。", "This page is more than a flat history list. It is your course Q&A knowledge base, where you can switch courses, create folders, collect key questions, and organize items by chapter, module or theme.")}
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="section-card rounded-[24px] p-5">
            <p className="text-sm text-slate-500">{pick(language, "当前课程问答", "Course Questions")}</p>
            <p className="mt-3 text-4xl font-black text-slate-900">{summary.total}</p>
          </div>
          <div className="section-card rounded-[24px] p-5">
            <p className="text-sm text-slate-500">{pick(language, "已收藏", "Collected")}</p>
            <p className="mt-3 text-4xl font-black text-slate-900">{summary.collected}</p>
          </div>
          <div className="section-card rounded-[24px] p-5">
            <p className="text-sm text-slate-500">{pick(language, "已归档", "Filed")}</p>
            <p className="mt-3 text-4xl font-black text-slate-900">{summary.filed}</p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "选择课程", "Select Course")}</span>
            <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3">
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </label>

          <div className="rounded-[28px] border border-slate-200 bg-white/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-slate-900">{pick(language, "整理面板", "Organization Panel")}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {selectedCourse ? `${pick(language, "当前课程：", "Current course: ")}${selectedCourse.name}` : pick(language, "请选择课程后开始整理。", "Select a course to start organizing.")}
                </p>
              </div>
              <Link href="/student/qa" className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
                {pick(language, "去 AI 助教页提问", "Ask in AI Assistant")}
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => { setArchiveMode("all"); setActiveFolderId(""); }} className={`rounded-full px-4 py-2 text-sm font-semibold ${archiveMode === "all" ? "ui-pill-active" : "ui-pill"}`}>
                {pick(language, "全部问答", "All Questions")}
              </button>
              <button onClick={() => { setArchiveMode("collected"); setActiveFolderId(""); }} className={`rounded-full px-4 py-2 text-sm font-semibold ${archiveMode === "collected" ? "ui-pill-active" : "ui-pill"}`}>
                {pick(language, "仅看收藏", "Collected Only")}
              </button>
              {folders.map((folder) => (
                <div key={folder.id} className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm ${archiveMode === "folder" && activeFolderId === folder.id ? "border-[var(--active-border)] bg-[var(--active-surface)]" : "border-slate-200 bg-white"}`}>
                  <button onClick={() => { setArchiveMode("folder"); setActiveFolderId(folder.id); }} className="font-semibold text-slate-800">
                    {folder.name} ({folder.question_count})
                  </button>
                  <button onClick={() => void handleDeleteFolder(folder.id)} className="text-slate-400 transition hover:text-rose-600">×</button>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3">
              <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder={pick(language, "新建文件夹名称，例如：第三章 拥塞控制", "New folder name, e.g. Chapter 3: Congestion Control")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900" />
              <textarea value={newFolderDesc} onChange={(e) => setNewFolderDesc(e.target.value)} rows={2} placeholder={pick(language, "可选说明：这个文件夹主要整理哪些问题", "Optional note: what kind of questions will this folder contain")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900" />
              <button onClick={() => void handleCreateFolder()} disabled={creatingFolder} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                {creatingFolder ? pick(language, "创建中...", "Creating...") : pick(language, "创建文件夹", "Create Folder")}
              </button>
            </div>
          </div>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "搜索问题内容", "Search Questions")}</span>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={pick(language, "搜索问题、AI 回答、教师回复或文件夹名称", "Search question, AI answer, teacher reply or folder name")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          {message ? <p className={`text-sm ${message.includes("失败") || message.toLowerCase().includes("failed") ? "text-rose-700" : "text-slate-500"}`}>{message}</p> : null}
        </div>
      </section>

      <section className="space-y-5">
        {sections.length === 0 || sections.every((section) => section.items.length === 0) ? (
          <div className="glass-panel rounded-[32px] px-6 py-10 text-center md:px-8">
            <p className="text-sm font-semibold text-slate-500">{pick(language, "当前没有可展示的问答", "No questions to show")}</p>
            <h3 className="mt-2 text-2xl font-black text-slate-900">{pick(language, "先提几个问题，再开始整理你的课程知识库", "Ask a few questions first, then start organizing your course knowledge base")}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{pick(language, "你可以去课程专属 AI 助教页面提问，随后再回到这里，把高价值问答加入收藏或放进不同文件夹。", "You can ask questions in the AI Assistant page first, then come back here to collect and file valuable Q&A into different folders.")}</p>
          </div>
        ) : (
          sections.map((section) => (
            <section key={section.key} className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
              <div className="border-b border-slate-200 pb-5">
                <p className="text-sm font-semibold text-slate-500">{pick(language, "整理分组", "Archive Section")}</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">{section.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{section.hint}</p>
              </div>

              <div className="mt-5 space-y-4">
                {section.items.length === 0 ? (
                  <div className="section-card rounded-[24px] p-6 text-sm text-slate-500">{pick(language, "这个分组下暂时还没有问题。", "There are no questions in this section yet.")}</div>
                ) : section.items.map((item) => (
                  <article key={item.id} className="section-card rounded-[26px] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">{item.created_at}</p>
                        <h4 className="mt-2 text-lg font-bold text-slate-900">{item.question_text || pick(language, "附件提问", "Attachment-based question")}</h4>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                          {item.answer_target_type === "ai" ? pick(language, "仅 AI", "AI only") : item.answer_target_type === "teacher" ? pick(language, "仅教师", "Teacher only") : "AI + Teacher"}
                        </span>
                        {item.collected ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">{pick(language, "已收藏", "Collected")}</span> : null}
                        {item.folder_name ? <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[var(--accent-contrast)]">{item.folder_name}</span> : null}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button onClick={() => void handleToggleCollect(item.id)} className="ui-pill rounded-full px-4 py-2 text-xs font-semibold">
                        {item.collected ? pick(language, "取消收藏", "Uncollect") : pick(language, "加入收藏", "Collect")}
                      </button>
                      <button
                        onClick={() => void handleDeleteQuestion(item.id)}
                        disabled={deletingQuestionId === item.id}
                        className="ui-pill rounded-full px-4 py-2 text-xs font-semibold text-rose-600 disabled:opacity-50"
                      >
                        {deletingQuestionId === item.id ? pick(language, "删除中...", "Deleting...") : pick(language, "删除记录", "Delete")}
                      </button>
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <span>{pick(language, "移动到", "Move to")}</span>
                        <select value={item.folder_id || ""} onChange={(e) => void handleAssignFolder(item.id, e.target.value)} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
                          <option value="">{pick(language, "未归档", "No folder")}</option>
                          {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                        </select>
                      </label>
                    </div>

                    {item.attachment_items.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.attachment_items.map((attachment) => (
                          <button key={attachment.id} onClick={() => void openAttachment(attachment)} className="ui-pill rounded-full px-4 py-2 text-xs font-semibold">
                            {pick(language, "附件：", "Attachment: ")}{attachment.file_name}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {item.ai_answer_content ? (
                      <div className="mt-4 rounded-[22px] border border-[var(--active-border)] bg-[var(--active-surface)] px-5 py-4 text-sm leading-7 text-slate-800">
                        <p className="text-xs font-semibold text-[var(--accent-contrast)]">{pick(language, "AI 回答", "AI Answer")}</p>
                        <RichAnswer content={item.ai_answer_content} className="mt-2" />
                      </div>
                    ) : null}

                    <div className="mt-4 rounded-[22px] border border-slate-200 bg-white px-5 py-4 text-sm leading-7 text-slate-700">
                      <p className="text-xs font-semibold text-slate-500">
                        {pick(language, "教师回复状态：", "Teacher status: ")}
                        {item.teacher_reply_status === "pending" ? pick(language, "待回复", "Pending") : item.teacher_reply_status === "replied" ? pick(language, "已回复", "Replied") : item.teacher_reply_status === "closed" ? pick(language, "已关闭", "Closed") : pick(language, "未请求", "Not requested")}
                      </p>
                      <RichAnswer content={item.teacher_answer_content || pick(language, "当前还没有教师补充回复。", "There is no teacher follow-up yet.")} className="mt-2" />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </section>
    </WorkspacePage>
  );
}
