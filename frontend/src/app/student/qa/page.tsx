"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { RichAnswer } from "@/components/rich-answer";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, type ChatSessionDetail, type Course, type LessonPack, type ModelOption, type UploadedAttachment } from "@/lib/api";
import { pick } from "@/lib/i18n";

function getModelBadge(model: ModelOption, language: string) {
  const fingerprint = `${model.key} ${model.model_name} ${model.label} ${model.description}`.toLowerCase();
  const key = (model.key || "").toLowerCase();
  const modelName = (model.model_name || "").toLowerCase();

  if (model.supports_vision) return pick(language, "适合图文理解", "Good for vision tasks");
  if (/(smart|default$|pro|max|quality|reason|高质量|推理|结构化)/.test(key) || /\bsmart\b/.test(fingerprint)) {
    return pick(language, "适合综合解释", "Good for balanced explanation");
  }
  if (/(fast|default-fast)/.test(key) || /(fast|mini|air|turbo|flash|speed)/.test(modelName)) {
    return pick(language, "适合快速问答", "Good for fast Q&A");
  }
  if (/(pro|max|quality|reason|高质量|推理|结构化)/.test(fingerprint)) {
    return pick(language, "适合综合解释", "Good for balanced explanation");
  }
  if (model.provider === "qwen") return pick(language, "适合快速问答", "Good for fast Q&A");
  if (model.provider === "doubao") return pick(language, "适合综合解释", "Good for balanced explanation");
  return pick(language, "适合综合解释", "Good for balanced explanation");
}

function buildConversationTitle(courseName: string | undefined, language: string) {
  const stamp = new Date().toLocaleString(language === "zh-CN" ? "zh-CN" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return courseName
    ? pick(language, `${courseName} 问答 ${stamp}`, `${courseName} Chat ${stamp}`)
    : pick(language, `课程问答 ${stamp}`, `Course Chat ${stamp}`);
}

export default function StudentQAPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [packs, setPacks] = useState<LessonPack[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedPackId, setSelectedPackId] = useState("");
  const [selectedModel, setSelectedModel] = useState("default");
  const [selectedMode, setSelectedMode] = useState<"ai" | "teacher" | "both">("both");
  const [anonymous, setAnonymous] = useState(false);
  const [question, setQuestion] = useState("");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [activeSession, setActiveSession] = useState<ChatSessionDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [requestingMaterials, setRequestingMaterials] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [message, setMessage] = useState("");

  const answerModes = useMemo(() => [
    {
      value: "ai",
      label: pick(language, "由 AI 回答", "Answered by AI"),
      desc: pick(language, "系统会先检索课程资料，再调用当前模型即时回答。", "The system retrieves course materials first, then uses the current model for an instant answer."),
    },
    {
      value: "teacher",
      label: pick(language, "由教师回答", "Answered by Teacher"),
      desc: pick(language, "问题进入教师待处理列表，适合需要教师针对性解释的情况。", "The question goes into the teacher queue and is suitable for cases that need teacher judgment."),
    },
    {
      value: "both",
      label: pick(language, "同时发送给 AI 和教师", "Send to AI and Teacher"),
      desc: pick(language, "AI 先给出即时回答，教师后续可以补充说明。", "AI answers first, and the teacher can follow up later."),
    },
  ] as const, [language]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/");
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || user.role !== "student") return;
    Promise.all([
      api.listCourses().catch(() => []),
      api.listLessonPacks().catch(() => []),
      api.listModels().catch(() => []),
      api.listChatSessions().catch(() => []),
    ]).then(([courseList, packList, modelList, sessionList]) => {
      const firstCourseId = courseList[0]?.id || "";
      const defaultModel = modelList.find((item) => item.is_default)?.key || modelList[0]?.key || "";
      const latestSession = sessionList.find((item) => item.course_id === firstCourseId) || sessionList[0] || null;

      setCourses(courseList);
      setPacks(packList.filter((item) => item.status === "published"));
      setModels(modelList);
      setSelectedCourseId(firstCourseId);
      setSelectedModel(defaultModel);
      setActiveSessionId(latestSession?.id || "");
    });
  }, [user]);

  useEffect(() => {
    if (!selectedCourseId) return;
    const nextPackId = packs.find((item) => item.course_id === selectedCourseId)?.id || "";
    api.listChatSessions(selectedCourseId).then((sessionList) => {
      setSelectedPackId((prev) => (prev && packs.some((item) => item.id === prev && item.course_id === selectedCourseId) ? prev : nextPackId));
      const latestSession = sessionList[0] || null;
      if (!activeSessionId || !sessionList.some((item) => item.id === activeSessionId)) {
        setActiveSessionId(latestSession?.id || "");
      }
    }).catch(() => {
      setSelectedPackId(nextPackId);
      setActiveSessionId("");
    });
  }, [activeSessionId, packs, selectedCourseId]);

  useEffect(() => {
    if (!activeSessionId) {
      setActiveSession(null);
      return;
    }
    api.getChatSession(activeSessionId).then(setActiveSession).catch(() => setActiveSession(null));
  }, [activeSessionId]);

  const activeCourse = useMemo(() => courses.find((item) => item.id === selectedCourseId) || null, [courses, selectedCourseId]);
  const selectedModelInfo = useMemo(() => models.find((item) => item.key === selectedModel) || null, [models, selectedModel]);
  const filteredPacks = useMemo(() => packs.filter((item) => !selectedCourseId || item.course_id === selectedCourseId), [packs, selectedCourseId]);
  const questionCount = activeSession?.questions.length || 0;
  const latestQuestionTime = activeSession?.questions[activeSession.questions.length - 1]?.created_at || "";

  const refreshLatestSession = async (courseId: string, preferredSessionId?: string) => {
    const sessions = await api.listChatSessions(courseId).catch(() => []);
    const targetSessionId = preferredSessionId || sessions[0]?.id || "";
    setActiveSessionId(targetSessionId);
    if (!targetSessionId) {
      setActiveSession(null);
      return;
    }
    const detail = await api.getChatSession(targetSessionId).catch(() => null);
    setActiveSession(detail);
  };

  const ensureSession = async () => {
    if (activeSessionId) return activeSessionId;
    const courseId = selectedCourseId || courses[0]?.id || "";
    if (!courseId) throw new Error(pick(language, "当前没有可用课程。", "No course is available."));
    const courseName = courses.find((item) => item.id === courseId)?.name;
    const created = await api.createChatSession({
      course_id: courseId,
      lesson_pack_id: selectedPackId || undefined,
      title: buildConversationTitle(courseName, language),
      selected_model: selectedModel,
    });
    setActiveSessionId(created.id);
    return created.id;
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setMessage("");
    try {
      const result = await api.uploadQuestionAttachments(Array.from(files));
      setAttachments((prev) => [...prev, ...result]);
      setMessage(pick(language, "附件上传完成，系统会在提问时一起参考。", "Attachments uploaded. They will be used when answering your question."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "附件上传失败。", "Attachment upload failed."));
    } finally {
      setUploading(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim() && attachments.length === 0) {
      setMessage(pick(language, "请至少输入问题或上传附件。", "Please enter a question or upload an attachment."));
      return;
    }
    if (!selectedModel && selectedMode !== "teacher") {
      setMessage(pick(language, "当前没有可用模型，请先配置模型服务。", "No model is available yet. Please configure a model service first."));
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const sessionId = await ensureSession();
      await api.askQuestion({
        session_id: sessionId,
        course_id: selectedCourseId || courses[0]?.id || "",
        lesson_pack_id: selectedPackId || undefined,
        question: question.trim(),
        answer_target_type: selectedMode,
        anonymous,
        selected_model: selectedModel,
        attachment_ids: attachments.map((item) => item.id),
      });
      setQuestion("");
      setAttachments([]);
      await refreshLatestSession(selectedCourseId || courses[0]?.id || "", sessionId);
      setMessage(
        selectedMode === "teacher"
          ? pick(language, "问题已发送给教师。", "Your question has been sent to the teacher.")
          : selectedMode === "both"
            ? pick(language, "AI 已即时回答，同时教师端已收到提醒。", "AI has answered and the teacher has been notified.")
            : pick(language, "问题已提交，AI 已给出回答。", "Your question has been submitted and answered by AI."),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "提问失败，请稍后重试。", "Question submission failed. Please try again later."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestMaterials = async () => {
    const courseId = selectedCourseId || courses[0]?.id || "";
    if (!courseId) return;
    setRequestingMaterials(true);
    try {
      await api.requestCourseMaterial({
        course_id: courseId,
        request_text: question.trim() || pick(language, "希望教师共享本节课相关讲义、PPT 或补充资料。", "Please share lecture notes, PPTs or supplementary materials related to this class."),
      });
      setMessage(pick(language, "资料请求已发送给教师。", "The material request has been sent to the teacher."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "资料请求发送失败。", "Material request failed."));
    } finally {
      setRequestingMaterials(false);
    }
  };

  const openAttachment = async (attachment: UploadedAttachment) => {
    try {
      setMessage("");
      await api.openProtectedFile(attachment.download_url, attachment.file_name);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "附件打开失败。", "Failed to open attachment."));
    }
  };

  if (!user || user.role !== "student") {
    return (
      <WorkspacePage tone="student">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载课程问答...", "Loading course Q&A...")}</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="student" className="grid gap-5 xl:grid-cols-[0.94fr_1.56fr]">
      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <div className="border-b border-slate-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">{pick(language, "课程专属 AI 助教", "Course AI Assistant")}</p>
              <h2 className="mt-2 text-3xl font-black text-slate-900">{pick(language, "围绕当前课程即时提问", "Ask instantly around the current course")}</h2>
            </div>
            <button onClick={() => { setActiveSessionId(""); setActiveSession(null); setQuestion(""); setAttachments([]); setMessage(""); }} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
              {pick(language, "开始新一轮问答", "Start New Round")}
            </button>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {pick(language, "这个页面只负责提问和查看当前对话，不再承担文件夹整理和历史归档功能。所有分类、收藏、沉淀整理请统一放到“学习问答记录”页面完成。", "This page is now only for asking questions and reviewing the current conversation. Folder organization, collection, and long-term archiving are handled in the Q&A Archive page.")}
          </p>
        </div>

        <div className="mt-6 space-y-5">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "所属课程", "Course")}</span>
            <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3">
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "关联课程包", "Lesson Pack")}</span>
            <select value={selectedPackId} onChange={(e) => setSelectedPackId(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3">
              <option value="">{pick(language, "未指定课程包", "No lesson pack")}</option>
              {filteredPacks.map((pack) => <option key={pack.id} value={pack.id}>{pack.id}</option>)}
            </select>
          </label>

          <div>
            <p className="mb-2 font-semibold text-slate-700">{pick(language, "回答对象", "Answer Route")}</p>
            <div className="space-y-3">
              {answerModes.map((item) => (
                <button key={item.value} onClick={() => setSelectedMode(item.value)} className={`w-full rounded-[22px] px-4 py-4 text-left transition ${selectedMode === item.value ? "ui-card-active" : "section-card"}`}>
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs leading-6" data-ui-muted>{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-white/70 px-4 py-4">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-1" />
            <span className="text-sm leading-7 text-slate-600">{pick(language, "可选择匿名发言。匿名只影响展示身份，不影响账号内的记录留存。", "You can choose to ask anonymously. This only changes the displayed identity and does not affect the records bound to your account.")}</span>
          </label>

          <div className="rounded-[24px] border border-slate-200 bg-white/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">{pick(language, "当前模型", "Current Model")}</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{selectedModelInfo?.label || pick(language, "暂无可用模型", "No available model")}</p>
              </div>
              <button onClick={() => setModelMenuOpen((prev) => !prev)} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
                {pick(language, "切换模型", "Switch Model")}
              </button>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">{selectedModelInfo?.description || pick(language, "请先在后端配置模型服务。", "Please configure a model service in the backend first.")}</p>
            {selectedModelInfo ? <p className="mt-2 text-xs font-semibold text-slate-500">{getModelBadge(selectedModelInfo, language)}</p> : null}

            {modelMenuOpen ? (
              <div className="mt-4 space-y-2 rounded-[22px] border border-slate-200 bg-white p-3">
                {models.map((model) => (
                  <button key={model.key} onClick={() => { setSelectedModel(model.key); setModelMenuOpen(false); }} className={`w-full rounded-[18px] px-4 py-3 text-left transition ${selectedModel === model.key ? "ui-card-active" : "ui-pill"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{model.label}</span>
                      <span className="text-xs" data-ui-muted>{getModelBadge(model, language)}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-slate-900">{pick(language, "提问区", "Question Area")}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{pick(language, "支持文本、图片、文档与压缩包附件。", "Supports text, image, document and archive attachments.")}</p>
              </div>
              <Link href="/student/questions" className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
                {pick(language, "去整理问答记录", "Open Q&A Archive")}
              </Link>
            </div>

            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={5} placeholder={pick(language, "例如：请结合课程资料解释 QUIC 与 TCP 的差异。", "Example: Please explain the difference between QUIC and TCP using the course materials.")} className="mt-4 w-full rounded-[24px] border border-slate-300 bg-white px-4 py-4 text-sm leading-7 text-slate-900" />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
                {pick(language, "上传附件", "Upload Attachments")}
                <input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.txt,.md,.pdf,.doc,.docx,.ppt,.pptx,.zip,.rar" className="hidden" onChange={(e) => void handleUpload(e.target.files)} />
              </label>
              <button onClick={() => void handleRequestMaterials()} disabled={requestingMaterials} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
                {requestingMaterials ? pick(language, "发送中...", "Sending...") : pick(language, "请求教师共享资料", "Request Materials")}
              </button>
              <button onClick={() => void handleAsk()} disabled={uploading || submitting} className="button-primary rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60">
                {uploading ? pick(language, "上传中...", "Uploading...") : submitting ? pick(language, "提交中...", "Submitting...") : pick(language, "提交问题", "Submit")}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {attachments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
                  {pick(language, "当前还没有附件。你可以上传 PPT 截图、题目文档或资料压缩包。", "No attachments yet. You can upload PPT screenshots, question documents or zipped materials.")}
                </div>
              ) : attachments.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{item.file_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.parse_status} · {(item.file_size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={() => setAttachments((prev) => prev.filter((attachment) => attachment.id !== item.id))} className="ui-pill rounded-full px-3 py-1.5 text-xs font-semibold">
                    {pick(language, "删除", "Remove")}
                  </button>
                </div>
              ))}
            </div>

            <p className={`mt-4 text-sm ${message.includes("失败") || message.toLowerCase().includes("failed") ? "text-rose-700" : "text-slate-500"}`}>{message}</p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white/70 p-4">
            <p className="text-sm font-semibold text-slate-500">{pick(language, "使用说明", "How This Page Works")}</p>
            <div className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
              <p>{pick(language, "这里现在只保留当前课程正在进行中的问答流，页面结构会比以前更简单。", "This page now focuses only on the active Q&A flow for the current course, with a simpler structure than before.")}</p>
              <p>{pick(language, "如果你想重新开始，就点击上方“开始新一轮问答”，下方区域会清空并等待新的提问。", "If you want to start over, click “Start New Round” above. The conversation area will clear and wait for a new question.")}</p>
              <p>{pick(language, "如果你想回看、收藏、归档或分类整理历史问题，请去“学习问答记录”页面。", "If you want to review, collect, file, or categorize historical questions, use the Q&A Archive page.")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "当前问答流", "Current Q&A Flow")}</p>
          <h3 className="mt-2 text-3xl font-black text-slate-900">{pick(language, "正在进行中的提问与回答", "Questions and Answers in Progress")}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">{pick(language, "这里直接按问答顺序展示当前课程的连续交流内容，只保留对理解当前问题有帮助的信息。", "This area shows the ongoing course exchange directly in Q&A order and keeps only the information that helps you follow the current discussion.")}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">{pick(language, "当前课程：", "Course: ")}{activeCourse?.name || pick(language, "未选择", "Not selected")}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">{pick(language, "当前提问数：", "Questions shown: ")}{questionCount}</span>
            {latestQuestionTime ? <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">{pick(language, "最新一条时间：", "Latest item: ")}{latestQuestionTime}</span> : null}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {activeSession?.questions.length ? activeSession.questions.map((item) => (
            <article key={item.id} className="space-y-3 rounded-[28px] border border-slate-200 bg-white/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-500">{item.created_at}</p>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                    {item.answer_target_type === "ai" ? pick(language, "仅 AI", "AI only") : item.answer_target_type === "teacher" ? pick(language, "仅教师", "Teacher only") : "AI + Teacher"}
                  </span>
                  {item.anonymous ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{pick(language, "匿名发言", "Anonymous")}</span> : null}
                </div>
              </div>

              <div className="ml-auto max-w-[92%] rounded-[26px] bg-slate-900 px-5 py-4 text-sm leading-7 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{pick(language, "我的问题", "My Question")}</p>
                <p className="mt-2">{item.question_text || pick(language, "请结合我上传的附件理解这个问题。", "Please understand this question together with my uploaded attachments.")}</p>
                {item.attachment_items.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.attachment_items.map((attachment) => (
                      <button key={attachment.id} onClick={() => void openAttachment(attachment)} className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                        {pick(language, "附件：", "Attachment: ")}{attachment.file_name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {item.ai_answer_content ? (
                <div className="max-w-[96%] rounded-[26px] border px-5 py-4 text-sm leading-7" style={{ borderColor: "var(--interactive-selected-border)", background: "var(--interactive-selected-panel-bg)", color: "var(--interactive-selected-fg)" }}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--interactive-selected-fg)" }}>{pick(language, "AI 回答", "AI Answer")}</p>
                  <RichAnswer content={item.ai_answer_content} className="mt-2" />
                  {item.ai_answer_sources?.length ? (
                    <div className="mt-4 rounded-[18px] border border-slate-200/70 bg-white/70 px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {pick(language, "参考依据", "Sources")}
                      </p>
                      <ul className="mt-2 space-y-1 text-xs leading-6 text-slate-600">
                        {item.ai_answer_sources.slice(0, 8).map((source, idx) => (
                          <li key={`${item.id}-source-${idx}`} className="rounded-[12px] border border-slate-200 bg-white px-2.5 py-1.5">
                            {source}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="max-w-[96%] rounded-[26px] border border-slate-200 bg-white px-5 py-4 text-sm leading-7 text-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{pick(language, "教师补充", "Teacher Follow-up")}</p>
                  <span className="text-xs font-semibold text-slate-500">
                    {item.teacher_reply_status === "pending" ? pick(language, "待回复", "Pending") : item.teacher_reply_status === "replied" ? pick(language, "已回复", "Replied") : item.teacher_reply_status === "closed" ? pick(language, "已关闭", "Closed") : pick(language, "未请求", "Not requested")}
                  </span>
                </div>
                <RichAnswer content={item.teacher_answer_content || pick(language, "当前还没有教师补充回复。", "There is no teacher follow-up yet.")} className="mt-2" />
              </div>
            </article>
          )) : (
            <div className="section-card rounded-[26px] p-10 text-center text-slate-500">
              {pick(language, "这一轮问答还没有内容。你可以在左侧直接发起问题，系统会自动把它接到当前课程的最新对话里。", "This round has no content yet. Ask a question on the left and it will automatically continue in the latest conversation for the current course.")}
            </div>
          )}
        </div>
      </section>
    </WorkspacePage>
  );
}
