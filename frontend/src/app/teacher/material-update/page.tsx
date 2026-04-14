"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, type Course, type MaterialUpdateResult, type ModelOption, type TaskJobRecord } from "@/lib/api";
import { pick } from "@/lib/i18n";

export default function MaterialUpdatePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [history, setHistory] = useState<MaterialUpdateResult[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [materialText, setMaterialText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedModel, setSelectedModel] = useState("default");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [result, setResult] = useState<MaterialUpdateResult | null>(null);
  const [activeJob, setActiveJob] = useState<TaskJobRecord | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  const loadPageData = async () => {
    const [courseList, updateList, modelList] = await Promise.all([
      api.listCourses(),
      api.listMaterialUpdates(),
      api.listModels().catch(() => []),
    ]);
    return { courseList, updateList, modelList };
  };

  const applyPageData = (data: { courseList: Course[]; updateList: MaterialUpdateResult[]; modelList: ModelOption[] }) => {
    const { courseList, updateList, modelList } = data;
    setCourses(courseList);
    setHistory(updateList);
    setModels(modelList);
    setCourseId((prev) => prev || courseList[0]?.id || "");
    setSelectedModel((prev) => {
      if (modelList.some((item) => item.key === prev)) return prev;
      return modelList[0]?.key || prev || "default";
    });
  };

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || user.role !== "teacher") return;
    let cancelled = false;
    void loadPageData()
      .then((data) => {
        if (cancelled) return;
        applyPageData(data);
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
  }, [user]);

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
            setResult(nextResult);
            setMessage(
              nextResult.model_status === "failed"
                ? nextResult.summary
                : pick(language, `后台任务已完成，本次实际使用模型：${nextResult.used_model_name || nextResult.selected_model}。`, `Background job finished. Model used: ${nextResult.used_model_name || nextResult.selected_model}.`),
            );
          } else {
            setMessage(pick(language, "任务已完成，但未解析出结构化结果。", "The job finished, but no structured result was parsed."));
          }
          setRunning(false);
          void loadPageData()
            .then((data) => {
              if (!cancelled) applyPageData(data);
            })
            .catch(() => undefined);
        }
        if (nextJob.status === "failed") {
          setRunning(false);
          setMessage(nextJob.error_message || nextJob.message || pick(language, "生成失败，请稍后重试", "Generation failed. Please try again."));
        }
      } catch (error) {
        if (cancelled) return;
        setRunning(false);
        setMessage(error instanceof Error ? error.message : pick(language, "任务状态刷新失败，请稍后重试", "Failed to refresh task status. Please try again."));
      }
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeJob, language]);

  const selectedModelInfo = useMemo(
    () => models.find((item) => item.key === selectedModel) || null,
    [models, selectedModel],
  );
  const canRun = Boolean(selectedModel || selectedModelInfo);
  const activeJobLabel = activeJob?.status === "queued" ? pick(language, "排队中", "Queued") : activeJob?.status === "running" ? pick(language, "执行中", "Running") : activeJob?.status === "failed" ? pick(language, "失败", "Failed") : pick(language, "已完成", "Completed");

  if (!user || user.role !== "teacher") {
    return (
      <WorkspacePage tone="teacher">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载 PPT / 教案更新页面...", "Loading the PPT / lesson update page...")}</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="teacher" className="grid gap-5 xl:grid-cols-[1.04fr_0.96fr]">
      <section className="glass-panel rounded-[32px] px-5 py-6 md:px-6">
        <div className="sticky-toolbar top-20 z-20 mb-5 rounded-[28px] px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">{pick(language, "PPT / 教案更新", "PPT / Lesson Update")}</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">{pick(language, "在旧材料基础上快速补入近年热点、案例和前沿内容", "Refresh older materials with recent cases and frontier topics")}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{pick(language, "提交后会先返回任务编号，再由页面自动轮询结果。", "The page now submits a background task first and polls the result automatically.")}</p>
            </div>
            <div className="relative w-full max-w-sm">
              <p className="text-sm font-semibold text-slate-500">{pick(language, "当前模型", "Current Model")}</p>
              <button type="button" onClick={() => setModelMenuOpen((prev) => !prev)} className="mt-2 w-full rounded-[22px] border border-[var(--active-border)] bg-[var(--active-surface)] px-4 py-4 text-left shadow-[var(--active-shadow)] transition">
                <span className="block text-sm font-semibold text-slate-900">{selectedModelInfo?.label || pick(language, "默认回退模式", "Fallback mode")}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{selectedModelInfo?.description || pick(language, "当前未拉取到模型清单，但仍可用默认标识触发后端回退诊断与建议生成。", "No model list is available right now, but the fallback identifier can still trigger backend diagnostics and suggestions.")}</span>
                <span className="mt-2 inline-flex rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-600">{pick(language, "实际模型：", "Model: ")}{selectedModelInfo?.model_name || selectedModel || "default"}</span>
              </button>
              {modelMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+10px)] z-40 max-h-80 w-full overflow-y-auto rounded-[24px] border border-slate-200 bg-[var(--surface)] p-3 shadow-2xl">
                  {models.length === 0 ? <div className="rounded-[18px] border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">{pick(language, "当前没有已接入模型。请在后端配置 API Key、Base URL 和模型名称。", "No models are connected yet. Configure the API key, base URL, and model name on the backend.")}</div> : models.map((model) => (
                    <button key={model.key} type="button" onClick={() => { setSelectedModel(model.key); setModelMenuOpen(false); }} className={`mb-2 w-full rounded-[20px] px-4 py-4 text-left transition last:mb-0 ${selectedModel === model.key ? "ui-card-active" : "ui-pill"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{model.label}</p>
                        <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-500">{model.provider}</span>
                      </div>
                      <p className="mt-2 text-xs leading-6 text-slate-500">{model.description}</p>
                      <p className="mt-1 text-xs text-slate-400">{pick(language, "实际模型：", "Model: ")}{model.model_name} · {model.availability_note || pick(language, "已接入", "Available")}</p>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "所属课程", "Course")}</span>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3">
              <option value="">{pick(language, "请选择课程", "Select a course")}</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "更新任务标题", "Task Title")}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={pick(language, "如：第 6 章协议演进内容更新", "Example: Chapter 6 protocol evolution refresh")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
            <span className="font-semibold">{pick(language, "补充说明", "Instructions")}</span>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} placeholder={pick(language, "例如：想增加最近两年的前沿协议案例，补 1 到 2 页 PPT，并加入课堂讨论问题。", "Example: add recent protocol cases, create 1-2 extra slides, and include discussion prompts.")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
            <span className="font-semibold">{pick(language, "材料正文（可选）", "Material Text (Optional)")}</span>
            <textarea value={materialText} onChange={(e) => setMaterialText(e.target.value)} rows={8} placeholder={pick(language, "如果暂时不上传文件，可以直接粘贴原有讲义或 PPT 文字内容。", "Paste the original slide or lesson text here if you do not want to upload a file yet.")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="ui-pill cursor-pointer rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            {pick(language, "上传旧材料文件", "Upload Existing Material")}
            <input type="file" accept=".txt,.md,.doc,.docx,.pdf,.ppt,.pptx" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
          </label>
          <span className="text-sm text-slate-500">{selectedFile ? pick(language, `已选择：${selectedFile.name}`, `Selected: ${selectedFile.name}`) : pick(language, "可上传 PPT、讲义、教案等历史材料", "Upload slides, notes, or older lesson material.")}</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={async () => {
              try {
                setRunning(true);
                setMessage("");
                setResult(null);
                const nextJob = selectedFile
                  ? await api.createMaterialUpdateUploadJob({ course_id: courseId || undefined, title, instructions, selected_model: selectedModel || "default", file: selectedFile })
                  : await api.createMaterialUpdatePreviewJob({ course_id: courseId || undefined, title, instructions, material_text: materialText, selected_model: selectedModel || "default" });
                setActiveJob(nextJob);
                setMessage(nextJob.message || pick(language, "任务已提交，正在等待后台执行。", "Task submitted and waiting for the background runner."));
              } catch (error) {
                setRunning(false);
                setMessage(error instanceof Error ? error.message : pick(language, "生成失败，请稍后重试", "Generation failed. Please try again."));
              }
            }}
            disabled={running || !canRun}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? (activeJob?.status === "queued" ? pick(language, "排队中...", "Queued...") : pick(language, "生成中...", "Generating...")) : pick(language, "生成更新建议", "Generate Update Plan")}
          </button>
        </div>
        <p className={`mt-3 text-sm ${message.includes("不可用") || message.includes("失败") || message.toLowerCase().includes("fail") ? "text-rose-700" : "text-slate-600"}`}>{message || (selectedModelInfo ? pick(language, "建议优先补充文字说明，模型会据此更准确生成前沿更新方案。", "A short written brief improves the quality of the generated update plan.") : pick(language, "当前没有模型清单时，会使用默认标识请求后端，并返回明确的诊断或回退建议。", "When no model list is available, the page still uses the default identifier and returns clear diagnostics or fallback guidance."))}</p>

        {activeJob ? (
          <div className="mt-5 rounded-[28px] border border-[var(--active-border)] bg-[var(--active-surface)] px-5 py-5 shadow-[var(--active-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">{pick(language, "后台任务", "Background Task")}</p>
                <h3 className="mt-2 text-lg font-bold text-slate-900">{activeJobLabel} · {activeJob.progress}%</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{activeJob.message || pick(language, "页面会自动刷新后台任务状态。", "The page refreshes the task status automatically.")}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activeJob.status === "failed" ? "bg-rose-100 text-rose-700" : activeJob.status === "succeeded" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                {activeJob.status === "queued" ? pick(language, "等待执行", "Waiting") : activeJob.status === "running" ? pick(language, "后台处理中", "Running") : activeJob.status === "failed" ? pick(language, "任务失败", "Failed") : pick(language, "任务完成", "Completed")}
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, activeJob.progress))}%` }} />
            </div>
            <p className="mt-3 text-xs text-slate-500">{pick(language, "任务编号：", "Job ID: ")}{activeJob.id}</p>
            {activeJob.error_message ? <p className="mt-2 text-sm text-rose-700">{activeJob.error_message}</p> : null}
          </div>
        ) : null}
      </section>

      <section className="glass-panel rounded-[32px] px-5 py-6 md:px-6">
        <div className="border-b border-slate-200 pb-4">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "输出结果", "Results")}</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">{pick(language, "更新建议与历史记录", "Update Plan and History")}</h2>
        </div>

        {result ? (
          <div className="mt-5 section-card rounded-[28px] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-xl font-bold text-slate-900">{result.title}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${result.model_status === "failed" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{result.model_status === "failed" ? pick(language, "模型调用失败", "Model call failed") : pick(language, `模型：${result.used_model_name || result.selected_model}`, `Model: ${result.used_model_name || result.selected_model}`)}</span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{result.summary}</p>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                <div><p className="font-semibold text-slate-900">{pick(language, "更新建议", "Update Suggestions")}</p>{result.update_suggestions.length ? result.update_suggestions.map((item, index) => <p key={`${index}-${item}`}>{index + 1}. {item}</p>) : <p>{pick(language, "当前没有可展示的结构化建议。", "There are no structured suggestions to display yet.")}</p>}</div>
                <div><p className="font-semibold text-slate-900">{pick(language, "新增 PPT 草稿", "New Slide Drafts")}</p>{result.draft_pages.length ? result.draft_pages.map((item, index) => <p key={`${index}-${item}`}>{index + 1}. {item}</p>) : <p>{pick(language, "当前没有生成新增页草稿。", "No new slide drafts were generated.")}</p>}</div>
                <div><p className="font-semibold text-slate-900">{pick(language, "配图建议", "Image Suggestions")}</p>{result.image_suggestions.length ? result.image_suggestions.map((item, index) => <p key={`${index}-${item}`}>{index + 1}. {item}</p>) : <p>{pick(language, "当前没有生成配图建议。", "No image suggestions were generated.")}</p>}</div>
              </div>
            </div>
        ) : <div className="section-card mt-5 rounded-[28px] p-8 text-center text-slate-500">{pick(language, "生成后，这里会展示更新摘要、可新增的 PPT 页结构和图片建议。", "After generation, this area shows the summary, proposed new slide structure, and image suggestions.")}</div>}

        <div className="mt-5 space-y-3">
          {history.map((item) => (
            <div key={item.id} className="section-card rounded-[24px] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-semibold text-slate-900">{item.title}</p>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${item.model_status === "failed" ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"}`}>{item.used_model_name || item.selected_model || pick(language, "未记录模型", "No model recorded")}</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-600">{item.summary}</p>
              <p className="mt-2 text-xs text-slate-500">{item.created_at}</p>
            </div>
          ))}
        </div>
      </section>
    </WorkspacePage>
  );
}

function getMaterialUpdateFromJob(job: TaskJobRecord): MaterialUpdateResult | null {
  const candidate = job.result.material_update;
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as MaterialUpdateResult;
}
