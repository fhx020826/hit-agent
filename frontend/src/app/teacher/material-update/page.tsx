"use client";

import { Suspense, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, type Course, type MaterialUpdateResult, type ModelOption, type TaskJobRecord } from "@/lib/api";
import { pick } from "@/lib/i18n";

type ResultSection = {
  key: string;
  title: string;
  items: string[];
  emptyLabel: string;
};

type WorkPreset = {
  id: string;
  generationMode: "update_existing" | "generate_new";
  targetFormat: "ppt";
  label: string;
  hint: string;
};

export default function MaterialUpdatePage() {
  return (
    <Suspense fallback={<MaterialUpdateFallback />}>
      <MaterialUpdatePageContent />
    </Suspense>
  );
}

function MaterialUpdateFallback() {
  const { language } = useLanguage();
  return (
    <WorkspacePage tone="teacher">
      <div className="section-card rounded-[28px] p-8 text-center text-slate-500">
        {pick(language, "正在加载 PPT 生成与材料升级页面...", "Loading the PPT generation and material upgrade workspace...")}
      </div>
    </WorkspacePage>
  );
}

function MaterialUpdatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const searchCourseId = searchParams.get("course_id") || "";
  const searchGenerationMode = searchParams.get("generation_mode") || "";

  const [courses, setCourses] = useState<Course[]>([]);
  const [history, setHistory] = useState<MaterialUpdateResult[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [courseId, setCourseId] = useState(searchCourseId);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [materialText, setMaterialText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedModel, setSelectedModel] = useState("default");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [generationMode, setGenerationMode] = useState<"update_existing" | "generate_new">(normalizeGenerationMode(searchGenerationMode));
  const [targetFormat, setTargetFormat] = useState<"ppt">("ppt");
  const [result, setResult] = useState<MaterialUpdateResult | null>(null);
  const [activeJob, setActiveJob] = useState<TaskJobRecord | null>(null);
  const [running, setRunning] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [message, setMessage] = useState("");

  const loadPageData = async () => {
    const [courseList, updateList, modelList] = await Promise.all([
      api.listCourses(),
      api.listMaterialUpdates(),
      api.listModels().catch(() => []),
    ]);

    return {
      courseList,
      updateList: updateList.map((item) => ({
        ...item,
        generation_mode: normalizeGenerationMode(item.generation_mode),
        target_format: "ppt",
      })),
      modelList,
    };
  };

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) router.push("/");
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || user.role !== "teacher") return;
    let cancelled = false;

    void loadPageData()
      .then((data) => {
        if (cancelled) return;
        applyMaterialUpdatePageData(data, searchCourseId, setCourses, setHistory, setCourseId, setModels, setSelectedModel);
      })
      .catch(() => {
        if (cancelled) return;
        setCourses([]);
        setHistory([]);
        setModels([]);
      });

    return () => {
      cancelled = true;
    };
  }, [searchCourseId, user]);

  useEffect(() => {
    if (!activeJob || !["queued", "running"].includes(activeJob.status)) return;
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const nextJob = await api.getTaskJob(activeJob.id);
        if (cancelled) return;

        setActiveJob(nextJob);

        if (nextJob.status === "succeeded") {
          const nextResult = getMaterialUpdateFromJob(nextJob);
          if (nextResult) {
            const normalized = {
              ...nextResult,
              generation_mode: normalizeGenerationMode(nextResult.generation_mode),
              target_format: "ppt" as const,
            };
            setResult(normalized);
            setGenerationMode(normalized.generation_mode);
            setTargetFormat("ppt");
            setMessage(
              normalized.model_status === "failed"
                ? normalized.summary
                : pick(language, "任务已完成。", "The generation task has completed."),
            );
          } else {
            setMessage(pick(language, "任务已完成，但未解析出结构化结果。", "The job finished, but no structured result was parsed."));
          }

          setRunning(false);
          void loadPageData()
            .then((data) => {
              if (!cancelled) {
                applyMaterialUpdatePageData(data, searchCourseId, setCourses, setHistory, setCourseId, setModels, setSelectedModel);
              }
            })
            .catch(() => undefined);
        }

        if (nextJob.status === "failed") {
          setRunning(false);
          setMessage(nextJob.error_message || nextJob.message || pick(language, "生成失败，请稍后重试。", "Generation failed. Please try again."));
        }
      } catch (error) {
        if (cancelled) return;
        setRunning(false);
        setMessage(error instanceof Error ? error.message : pick(language, "任务状态刷新失败，请稍后重试。", "Failed to refresh task status. Please try again."));
      }
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeJob, language, searchCourseId]);

  const selectedModelInfo = useMemo(
    () => models.find((item) => item.key === selectedModel) || null,
    [models, selectedModel],
  );
  const activeCourse = useMemo(() => courses.find((item) => item.id === courseId) || null, [courseId, courses]);
  const filteredHistory = useMemo(() => history.filter((item) => !courseId || item.course_id === courseId), [courseId, history]);
  const historyToShow = courseId ? filteredHistory : history;
  const courseNameById = useMemo(() => new Map(courses.map((item) => [item.id, item.name])), [courses]);

  const workPresets = useMemo<WorkPreset[]>(
    () => [
      {
        id: "update_existing",
        generationMode: "update_existing",
        targetFormat: "ppt",
        label: pick(language, "升级现有材料", "Upgrade Existing Material"),
        hint: pick(language, "保留现有资料基础，输出补页、重构和授课优化建议。", "Keep the existing material and output upgrade suggestions."),
      },
      {
        id: "generate_ppt",
        generationMode: "generate_new",
        targetFormat: "ppt",
        label: pick(language, "直接生成 PPT", "Generate PPT"),
        hint: pick(language, "直接生成一份可下载的 PPT 文件，同时附带页级结构草案。", "Generate a downloadable PPT file with slide-level structure."),
      },
    ],
    [language],
  );

  const quickPrompts = useMemo(
    () =>
      generationMode === "generate_new"
        ? [
            pick(language, "面向 90 分钟课堂，生成一份概念清晰、互动完整的 PPT。", "Generate a 90-minute PPT with a clear concept flow and complete interaction."),
            pick(language, "加入 1 个真实案例、1 个课堂讨论题和 1 个过程性检测点。", "Add one real case, one discussion prompt, and one assessment checkpoint."),
            pick(language, "突出本章与前沿方向的联系，并给出教师讲解重点。", "Highlight the link between this chapter and frontier topics, with speaker notes."),
          ]
        : [
            pick(language, "补充近两年的真实案例，并设计 1 个课堂讨论问题。", "Add recent real-world cases and design one discussion prompt."),
            pick(language, "把旧 PPT 重构成“概念-案例-互动-总结”的课堂结构。", "Restructure the old PPT into a concept-case-interaction-summary flow."),
            pick(language, "补 2 到 3 页前沿内容，并明确每页的教师讲解重点。", "Add 2-3 frontier slides and specify the speaking focus for each page."),
          ],
    [generationMode, language],
  );

  const modeGuide = useMemo(
    () =>
      generationMode === "generate_new"
        ? {
            title: pick(language, "生成依据", "Generation Basis"),
            body: pick(
              language,
              "直接生成 PPT 会综合当前课程信息、你的补充说明，以及可选上传资料或粘贴文本，输出一份新的 PPT 文件和结构预览。",
              "Generate PPT uses the selected course, your instructions, and any optional reference material to create a new PPT file.",
            ),
          }
        : {
            title: pick(language, "升级依据", "Upgrade Basis"),
            body: pick(
              language,
              "升级现有材料是基于旧 PPT、教案、讲义、PDF 或粘贴的旧材料文本来输出升级方案；课程信息会作为补充上下文，但不能替代旧材料本身。",
              "Upgrade Existing Material works from your old PPT, lesson plan, notes, PDF, or pasted legacy text. Course context supports the upgrade, but does not replace the original material.",
            ),
          },
    [generationMode, language],
  );

  const resultSections = useMemo<ResultSection[]>(() => {
    if (!result) return [];
    if (result.generation_mode === "generate_new") {
      return [
        {
          key: "slides",
          title: pick(language, "页面草案", "Slide Drafts"),
          items: result.draft_pages,
          emptyLabel: pick(language, "当前没有生成页面草案。", "No slide drafts were generated."),
        },
        {
          key: "notes",
          title: pick(language, "教师讲解提示", "Speaker Notes"),
          items: result.speaker_notes,
          emptyLabel: pick(language, "当前没有生成讲解提示。", "No speaker notes were generated."),
        },
        {
          key: "flow",
          title: pick(language, "教学流程", "Teaching Flow"),
          items: result.teaching_flow,
          emptyLabel: pick(language, "当前没有生成教学流程。", "No teaching flow was generated."),
        },
        {
          key: "interaction",
          title: pick(language, "课堂互动设计", "Classroom Interactions"),
          items: result.classroom_interactions,
          emptyLabel: pick(language, "当前没有生成课堂互动设计。", "No classroom interaction ideas were generated."),
        },
        {
          key: "assessment",
          title: pick(language, "过程性检测点", "Assessment Checkpoints"),
          items: result.assessment_checkpoints,
          emptyLabel: pick(language, "当前没有生成检测点。", "No assessment checkpoints were generated."),
        },
        {
          key: "images",
          title: pick(language, "配图建议", "Image Suggestions"),
          items: result.image_suggestions,
          emptyLabel: pick(language, "当前没有生成配图建议。", "No image suggestions were generated."),
        },
      ];
    }
    return [
      {
        key: "update",
        title: pick(language, "更新建议", "Update Suggestions"),
        items: result.update_suggestions,
        emptyLabel: pick(language, "当前没有生成更新建议。", "No update suggestions were generated."),
      },
      {
        key: "slides",
        title: pick(language, "页面草案", "Slide Drafts"),
        items: result.draft_pages,
        emptyLabel: pick(language, "当前没有生成页面草案。", "No slide drafts were generated."),
      },
      {
        key: "flow",
        title: pick(language, "教学流程", "Teaching Flow"),
        items: result.teaching_flow,
        emptyLabel: pick(language, "当前没有生成教学流程。", "No teaching flow was generated."),
      },
      {
        key: "notes",
        title: pick(language, "教师讲解提示", "Speaker Notes"),
        items: result.speaker_notes,
        emptyLabel: pick(language, "当前没有生成讲解提示。", "No speaker notes were generated."),
      },
      {
        key: "interaction",
        title: pick(language, "课堂互动设计", "Classroom Interactions"),
        items: result.classroom_interactions,
        emptyLabel: pick(language, "当前没有生成课堂互动设计。", "No classroom interaction ideas were generated."),
      },
      {
        key: "assessment",
        title: pick(language, "过程性检测点", "Assessment Checkpoints"),
        items: result.assessment_checkpoints,
        emptyLabel: pick(language, "当前没有生成检测点。", "No assessment checkpoints were generated."),
      },
      {
        key: "images",
        title: pick(language, "配图建议", "Image Suggestions"),
        items: result.image_suggestions,
        emptyLabel: pick(language, "当前没有生成配图建议。", "No image suggestions were generated."),
      },
      {
        key: "delivery",
        title: pick(language, "授课执行清单", "Delivery Checklist"),
        items: result.delivery_checklist,
        emptyLabel: pick(language, "当前没有生成执行清单。", "No delivery checklist was generated."),
      },
    ];
  }, [language, result]);

  const canRun = Boolean(selectedModel || selectedModelInfo);
  const activeJobLabel =
    activeJob?.status === "queued"
      ? pick(language, "排队中", "Queued")
      : activeJob?.status === "running"
        ? pick(language, "执行中", "Running")
        : activeJob?.status === "failed"
          ? pick(language, "失败", "Failed")
          : pick(language, "已完成", "Completed");

  const applyQuickPrompt = (prompt: string) => {
    setInstructions((prev) => {
      if (!prev.trim()) return prompt;
      if (prev.includes(prompt)) return prev;
      return `${prev.trim()}\n${prompt}`;
    });
  };

  const defaultPptTitle = pick(language, "PPT 生成", "PPT Generation");
  const defaultUpgradeTitle = pick(language, "材料升级", "Material Upgrade");

  const applyPreset = (preset: WorkPreset) => {
    setGenerationMode(preset.generationMode);
    setTargetFormat("ppt");
    const trimmedTitle = title.trim();
    const canReplaceDefaultTitle =
      !trimmedTitle ||
      [
        "PPT 生成",
        "PPT Generation",
        "材料升级",
        "Material Upgrade",
      ].includes(trimmedTitle);

    if (canReplaceDefaultTitle) {
      setTitle(
        preset.id === "generate_ppt"
          ? defaultPptTitle
          : defaultUpgradeTitle,
      );
    }
  };

  const loadHistoryItem = (item: MaterialUpdateResult) => {
    const normalized = {
      ...item,
      generation_mode: normalizeGenerationMode(item.generation_mode),
      target_format: "ppt" as const,
    };
    setResult(normalized);
    if (item.course_id) setCourseId(item.course_id);
    setTitle(item.title);
    setGenerationMode(normalized.generation_mode);
    setTargetFormat("ppt");
    setMessage(pick(language, "已加载历史结果。", "Loaded the historical result."));
  };

  const removeHistoryItem = async (item: MaterialUpdateResult) => {
    if (!window.confirm(pick(language, `确认删除“${item.title}”这条记录吗？`, `Delete "${item.title}"?`))) return;
    try {
      setDeletingId(item.id);
      const response = await api.deleteMaterialUpdate(item.id);
      setHistory((prev) => prev.filter((entry) => entry.id !== item.id));
      if (result?.id === item.id) {
        setResult(null);
      }
      setMessage(response.message || pick(language, "记录已删除。", "Record deleted."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "删除失败，请稍后重试。", "Delete failed. Please try again."));
    } finally {
      setDeletingId("");
    }
  };

  if (!user || user.role !== "teacher") {
    return (
      <WorkspacePage tone="teacher">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">
          {pick(language, "正在加载 PPT 生成与材料升级页面...", "Loading the PPT generation and material upgrade workspace...")}
        </div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="teacher" className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
      <section className="glass-panel rounded-[32px] px-5 py-6 md:px-6">
        <div className="sticky-toolbar top-20 z-20 mb-5 rounded-[28px] px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">{pick(language, "PPT 生成与材料升级", "PPT Generation and Material Upgrade")}</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">
                {pick(language, "在这里直接生成 PPT，或升级已有材料。", "Generate PPT directly or upgrade existing material here.")}
              </h2>
            </div>
            <div className="relative w-full max-w-sm">
              <p className="text-sm font-semibold text-slate-500">{pick(language, "当前模型", "Model")}</p>
              <button
                type="button"
                onClick={() => setModelMenuOpen((prev) => !prev)}
                className="mt-2 w-full rounded-[22px] border border-[var(--active-border)] bg-[var(--active-surface)] px-4 py-4 text-left shadow-[var(--active-shadow)] transition"
              >
                <span className="block text-sm font-semibold text-slate-900">{selectedModelInfo?.label || pick(language, "默认模型", "Default Model")}</span>
                <span className="mt-2 inline-flex rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-600">
                  {selectedModelInfo?.model_name || selectedModel || "default"}
                </span>
              </button>
              {modelMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+10px)] z-40 max-h-80 w-full overflow-y-auto rounded-[24px] border border-slate-200 bg-[var(--surface)] p-3 shadow-2xl">
                  {models.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                      {pick(language, "当前没有可选模型。", "No models are available right now.")}
                    </div>
                  ) : (
                    models.map((model) => (
                      <button
                        key={model.key}
                        type="button"
                        onClick={() => {
                          setSelectedModel(model.key);
                          setModelMenuOpen(false);
                        }}
                        className={`mb-2 w-full rounded-[20px] px-4 py-4 text-left transition last:mb-0 ${selectedModel === model.key ? "ui-card-active" : "ui-pill"}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">{model.label}</p>
                          <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-500">{model.provider}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{model.model_name}</p>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-500">{pick(language, "功能模式", "Mode")}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {workPresets.map((preset) => {
              const active = generationMode === preset.generationMode;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`rounded-[24px] border px-4 py-4 text-left transition ${active ? "border-[var(--role-edge)] bg-[var(--active-surface)] shadow-[var(--active-shadow)]" : "border-slate-200 bg-white"}`}
                >
                  <p className="text-sm font-semibold text-slate-900">{preset.label}</p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">{preset.hint}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">{modeGuide.title}</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">{modeGuide.body}</p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "所属课程", "Course")}</span>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3">
              <option value="">{pick(language, "请选择课程", "Select a course")}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "任务标题", "Title")}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={pick(language, "例如：第一章绪论", "Example: Chapter 1 Introduction")}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
            <span className="font-semibold">{pick(language, "补充说明", "Instructions")}</span>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder={
                generationMode === "generate_new"
                  ? pick(language, "例如：面向 90 分钟课堂，生成一份突出核心概念、案例分析和课堂互动的 PPT。", "Example: generate a 90-minute PPT with core concepts, case analysis and interaction.")
                  : pick(language, "例如：补充近两年的案例，优化结构，并加入课堂讨论。", "Example: add recent cases, improve the structure, and include discussion.")
              }
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
            <span className="font-semibold">
              {generationMode === "generate_new"
                ? pick(language, "参考文本（可选）", "Reference Text (Optional)")
                : pick(language, "旧材料正文（可选）", "Legacy Material Text (Optional)")}
            </span>
            <textarea
              value={materialText}
              onChange={(e) => setMaterialText(e.target.value)}
              rows={8}
              placeholder={
                generationMode === "generate_new"
                  ? pick(language, "可粘贴已有讲义、章节摘要或教师笔记，帮助系统更贴近你的授课风格。", "Paste notes, chapter summaries, or prior material to guide the generation.")
                  : pick(language, "可粘贴旧 PPT、教案、讲义或 PDF 提取出的正文，作为升级依据。", "Paste the text from old PPTs, lesson plans, notes, or PDFs as the basis for the upgrade.")
              }
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
            />
          </label>
        </div>

        {activeCourse ? (
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-full bg-white/80 px-3 py-1">{activeCourse.name}</span>
            <span className="rounded-full bg-white/80 px-3 py-1">{activeCourse.chapter || pick(language, "未设置章节", "No chapter")}</span>
            <span className="rounded-full bg-white/80 px-3 py-1">
              {activeCourse.duration_minutes || 90} {pick(language, "分钟", "minutes")}
            </span>
            <span className="rounded-full bg-white/80 px-3 py-1">{activeCourse.frontier_direction || pick(language, "未设置前沿方向", "No frontier topic")}</span>
          </div>
        ) : null}

        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "快捷模板", "Quick Templates")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => applyQuickPrompt(prompt)}
                className="ui-pill rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="ui-pill cursor-pointer rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            {generationMode === "generate_new"
              ? pick(language, "上传参考资料", "Upload Reference File")
              : pick(language, "上传旧PPT/教案/讲义", "Upload Legacy Material")}
            <input
              type="file"
              accept=".txt,.md,.doc,.docx,.pdf,.ppt,.pptx"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          </label>
          <span className="text-sm text-slate-500">
            {selectedFile
              ? pick(language, `已选择：${selectedFile.name}`, `Selected: ${selectedFile.name}`)
              : generationMode === "generate_new"
                ? pick(language, "可上传讲义、章节摘要、教案或参考 PPT，帮助系统生成新文件。", "You can upload notes, chapter summaries, lesson plans, or reference slides.")
                : pick(language, "可上传旧 PPT、教案、讲义、PDF 或说明文档，作为升级依据。", "Upload old slides, lesson plans, notes, PDFs, or documents as the upgrade basis.")}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={async () => {
              try {
                if (generationMode === "update_existing" && !selectedFile && !materialText.trim()) {
                  setMessage(pick(language, "升级现有材料时，请至少上传一份旧资料，或粘贴旧材料正文。", "For upgrades, upload a legacy file or paste the legacy material text first."));
                  return;
                }
                setRunning(true);
                setMessage("");
                setResult(null);
                const basePayload = {
                  course_id: courseId || undefined,
                  title,
                  generation_mode: generationMode,
                  target_format: targetFormat,
                  instructions,
                  selected_model: selectedModel || "default",
                };
                const nextJob = selectedFile
                  ? await api.createMaterialUpdateUploadJob({
                      ...basePayload,
                      file: selectedFile,
                    })
                  : await api.createMaterialUpdatePreviewJob({
                      ...basePayload,
                      material_text: materialText,
                    });
                setActiveJob(nextJob);
                setMessage(nextJob.message || pick(language, "任务已提交。", "Task submitted."));
              } catch (error) {
                setRunning(false);
                setMessage(error instanceof Error ? error.message : pick(language, "生成失败，请稍后重试。", "Generation failed. Please try again."));
              }
            }}
            disabled={running || !canRun}
            className="button-primary rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running
              ? activeJob?.status === "queued"
                ? pick(language, "排队中...", "Queued...")
                : pick(language, "生成中...", "Generating...")
              : generationMode === "generate_new"
                ? pick(language, "生成 PPT 文件", "Generate PPT File")
                : pick(language, "生成升级方案", "Generate Update Plan")}
          </button>
        </div>

        {message ? <p className={`mt-3 text-sm ${message.includes("失败") || message.toLowerCase().includes("fail") ? "text-rose-700" : "text-slate-600"}`}>{message}</p> : null}

        {activeJob ? (
          <div className="mt-5 rounded-[28px] border border-[var(--active-border)] bg-[var(--active-surface)] px-5 py-5 shadow-[var(--active-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">{pick(language, "后台任务", "Background Task")}</p>
                <h3 className="mt-2 text-lg font-bold text-slate-900">{activeJobLabel} 路 {activeJob.progress}%</h3>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activeJob.status === "failed" ? "bg-rose-100 text-rose-700" : activeJob.status === "succeeded" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                {activeJob.status === "queued"
                  ? pick(language, "等待执行", "Waiting")
                  : activeJob.status === "running"
                    ? pick(language, "处理中", "Running")
                    : activeJob.status === "failed"
                      ? pick(language, "任务失败", "Failed")
                      : pick(language, "任务完成", "Completed")}
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, activeJob.progress))}%` }} />
            </div>
          </div>
        ) : null}
      </section>

      <section className="glass-panel rounded-[32px] px-5 py-6 md:px-6">
        <div className="border-b border-slate-200 pb-4">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "输出结果", "Results")}</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">{pick(language, "生成结果与历史记录", "Results and History")}</h2>
        </div>

        {result ? (
          <div className="mt-5 section-card rounded-[28px] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{result.title}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                  <span className="rounded-full bg-slate-100 px-3 py-1">{courseNameById.get(result.course_id) || pick(language, "未关联课程", "No linked course")}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{formatModeTag(result, language)}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{result.created_at}</span>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${result.model_status === "failed" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                {result.model_status === "failed"
                  ? pick(language, "模型回退", "Fallback")
                  : pick(language, `模型：${result.used_model_name || result.selected_model}`, `Model: ${result.used_model_name || result.selected_model}`)}
              </span>
            </div>

            <div className="mt-4 rounded-[24px] bg-[var(--active-surface)] px-4 py-4">
              <p className="text-sm font-semibold text-slate-500">{pick(language, "摘要", "Summary")}</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{result.summary}</p>
            </div>

            {result.generation_mode === "update_existing" ? (
              <div className="mt-4 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                <p className="text-sm font-semibold text-slate-700">{pick(language, "本次升级依据", "Upgrade Basis Used")}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                  <span className="rounded-full bg-slate-100 px-3 py-1">{result.source_filename || pick(language, "未上传文件，基于粘贴文本与课程信息", "No file uploaded; based on pasted text and course context")}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{pick(language, "输出目标：PPT 升级方案", "Output: PPT upgrade plan")}</span>
                </div>
              </div>
            ) : null}

            {result.generation_mode === "generate_new" ? (
              <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50/80 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">{pick(language, "PPT 成品", "Generated PPT")}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">
                      {result.generated_download_url
                        ? pick(language, "这次结果已经生成了可下载的 PPT 文件，下面的页面草案和讲解提示是它的结构预览。", "A downloadable PPT file is ready. The sections below are its structural preview.")
                        : pick(language, "当前只生成了结构草案，还没有拿到可下载的 PPT 文件。", "Only the structured draft is available right now; no downloadable PPT file was produced.")}
                    </p>
                  </div>
                  {result.generated_download_url ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => api.downloadProtectedFile(result.generated_download_url, result.generated_file_name || `${result.title}.pptx`)}
                        className="button-primary rounded-full px-5 py-3 text-sm font-semibold"
                      >
                        {pick(language, "下载 PPT", "Download PPT")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeHistoryItem(result)}
                        disabled={deletingId === result.id}
                        className="rounded-full border border-rose-200 px-5 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === result.id ? pick(language, "删除中...", "Deleting...") : pick(language, "删除记录", "Delete Record")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void removeHistoryItem(result)}
                      disabled={deletingId === result.id}
                      className="rounded-full border border-rose-200 px-5 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === result.id ? pick(language, "删除中...", "Deleting...") : pick(language, "删除记录", "Delete Record")}
                    </button>
                  )}
                </div>
                {result.generated_file_name ? (
                  <p className="mt-3 text-xs font-semibold text-emerald-700/80">{result.generated_file_name}</p>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{pick(language, "升级定位", "Upgrade Focus")}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {pick(language, "这一模式不会直接产出 PPT 文件，而是基于旧资料给出补页、重构和课堂执行建议，默认面向 PPT 课件升级。", "This mode does not output a PPT file directly. It produces upgrade guidance for existing courseware, primarily for PPT refinement.")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeHistoryItem(result)}
                    disabled={deletingId === result.id}
                    className="rounded-full border border-rose-200 px-5 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === result.id ? pick(language, "删除中...", "Deleting...") : pick(language, "删除记录", "Delete Record")}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {resultSections.map((section) => (
                <ResultGroup key={section.key} title={section.title} items={section.items} emptyLabel={section.emptyLabel} />
              ))}
            </div>
          </div>
        ) : (
          <div className="section-card mt-5 rounded-[28px] p-8 text-center text-slate-500">
            {pick(language, "生成完成后可在这里查看结果。", "Generated results will appear here.")}
          </div>
        )}

        <div className="mt-6">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "历史记录", "History")}</p>
        </div>

        <div className="mt-4 space-y-3">
          {historyToShow.length ? (
            historyToShow.map((item) => (
              <div
                key={item.id}
                className="section-card rounded-[24px] p-4 transition hover:border-[var(--active-border)] hover:shadow-[var(--active-shadow)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-2 text-xs text-slate-500">{courseNameById.get(item.course_id) || pick(language, "未关联课程", "No linked course")}</p>
                    {item.source_filename ? <p className="mt-2 text-xs text-slate-500">{pick(language, `依据文件：${item.source_filename}`, `Source: ${item.source_filename}`)}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">{formatModeTag(item, language)}</span>
                    {item.generated_download_url ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                        {pick(language, "含 PPT 文件", "PPT attached")}
                      </span>
                    ) : null}
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${item.model_status === "failed" ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"}`}>
                      {item.used_model_name || item.selected_model || pick(language, "未记录模型", "No model recorded")}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.summary}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">{item.created_at}</span>
                  <div className="flex flex-wrap gap-2">
                    {item.generated_download_url ? (
                      <button
                        type="button"
                        onClick={() => api.downloadProtectedFile(item.generated_download_url, item.generated_file_name || `${item.title}.pptx`)}
                        className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                      >
                        {pick(language, "下载PPT", "Download PPT")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => loadHistoryItem(item)}
                      className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {pick(language, "加载查看", "Load")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeHistoryItem(item)}
                      disabled={deletingId === item.id}
                      className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === item.id ? pick(language, "删除中...", "Deleting...") : pick(language, "删除", "Delete")}
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="section-card rounded-[24px] p-6 text-sm text-slate-500">
              {pick(language, "当前筛选条件下还没有历史记录。", "There is no history under the current filter.")}
            </div>
          )}
        </div>
      </section>
    </WorkspacePage>
  );
}

function formatModeTag(item: MaterialUpdateResult, language: "zh-CN" | "en-US") {
  if (item.generation_mode === "generate_new") {
    return pick(language, "直接生成 PPT", "Generated PPT");
  }
  return pick(language, "升级现有材料", "Updated Existing Material");
}

function ResultGroup({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
        {items.length ? items.map((item, index) => <p key={`${title}-${index}-${item}`}>{index + 1}. {item}</p>) : <p>{emptyLabel}</p>}
      </div>
    </div>
  );
}

function getMaterialUpdateFromJob(job: TaskJobRecord): MaterialUpdateResult | null {
  const candidate = job.result.material_update;
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as MaterialUpdateResult;
}

function applyMaterialUpdatePageData(
  data: { courseList: Course[]; updateList: MaterialUpdateResult[]; modelList: ModelOption[] },
  searchCourseId: string,
  setCourses: Dispatch<SetStateAction<Course[]>>,
  setHistory: Dispatch<SetStateAction<MaterialUpdateResult[]>>,
  setCourseId: Dispatch<SetStateAction<string>>,
  setModels: Dispatch<SetStateAction<ModelOption[]>>,
  setSelectedModel: Dispatch<SetStateAction<string>>,
) {
  const { courseList, updateList, modelList } = data;
  setCourses(courseList);
  setHistory(updateList);
  setCourseId((prev) => prev || searchCourseId || courseList[0]?.id || "");
  setModels(modelList);
  setSelectedModel((prev) => {
    if (modelList.some((item) => item.key === prev)) return prev;
    return modelList[0]?.key || prev || "default";
  });
}

function normalizeGenerationMode(value?: string): "update_existing" | "generate_new" {
  return value === "generate_new" ? "generate_new" : "update_existing";
}
