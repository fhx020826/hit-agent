"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, type Course, type MaterialUpdateResult, type ModelOption, type TaskJobRecord } from "@/lib/api";

export default function MaterialUpdatePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
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
                : `后台任务已完成，本次实际使用模型：${nextResult.used_model_name || nextResult.selected_model}。`,
            );
          } else {
            setMessage("任务已完成，但未解析出结构化结果。");
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
          setMessage(nextJob.error_message || nextJob.message || "生成失败，请稍后重试");
        }
      } catch (error) {
        if (cancelled) return;
        setRunning(false);
        setMessage(error instanceof Error ? error.message : "任务状态刷新失败，请稍后重试");
      }
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeJob]);

  const selectedModelInfo = useMemo(
    () => models.find((item) => item.key === selectedModel) || null,
    [models, selectedModel],
  );
  const canRun = Boolean(selectedModel || selectedModelInfo);
  const activeJobLabel = activeJob?.status === "queued" ? "排队中" : activeJob?.status === "running" ? "执行中" : activeJob?.status === "failed" ? "失败" : "已完成";

  if (!user || user.role !== "teacher") {
    return (
      <WorkspacePage tone="teacher">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">正在加载 PPT / 教案更新页面...</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="teacher" className="grid gap-5 xl:grid-cols-[1.04fr_0.96fr]">
      <section className="glass-panel rounded-[32px] px-5 py-6 md:px-6">
        <div className="sticky-toolbar top-20 z-20 mb-5 rounded-[28px] px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">PPT / 教案更新</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">在旧材料基础上快速补入近年热点、案例和前沿内容</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">该页面已经改为后台异步任务流。提交后会先返回任务编号，再由页面自动轮询结果，减少模型推理时的阻塞感。</p>
            </div>
            <div className="relative w-full max-w-sm">
              <p className="text-sm font-semibold text-slate-500">当前模型</p>
              <button type="button" onClick={() => setModelMenuOpen((prev) => !prev)} className="mt-2 w-full rounded-[22px] border border-[var(--active-border)] bg-[var(--active-surface)] px-4 py-4 text-left shadow-[var(--active-shadow)] transition">
                <span className="block text-sm font-semibold text-slate-900">{selectedModelInfo?.label || "默认回退模式"}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{selectedModelInfo?.description || "当前未拉取到模型清单，但仍可用默认标识触发后端回退诊断与建议生成。"}</span>
                <span className="mt-2 inline-flex rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-600">实际模型：{selectedModelInfo?.model_name || selectedModel || "default"}</span>
              </button>
              {modelMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+10px)] z-40 max-h-80 w-full overflow-y-auto rounded-[24px] border border-slate-200 bg-[var(--surface)] p-3 shadow-2xl">
                  {models.length === 0 ? <div className="rounded-[18px] border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">当前没有已接入模型。请在后端配置 API Key、Base URL 和模型名称。</div> : models.map((model) => (
                    <button key={model.key} type="button" onClick={() => { setSelectedModel(model.key); setModelMenuOpen(false); }} className={`mb-2 w-full rounded-[20px] px-4 py-4 text-left transition last:mb-0 ${selectedModel === model.key ? "ui-card-active" : "ui-pill"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{model.label}</p>
                        <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-500">{model.provider}</span>
                      </div>
                      <p className="mt-2 text-xs leading-6 text-slate-500">{model.description}</p>
                      <p className="mt-1 text-xs text-slate-400">实际模型：{model.model_name} · {model.availability_note || "已接入"}</p>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">所属课程</span>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3">
              <option value="">请选择课程</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">更新任务标题</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：第 6 章协议演进内容更新" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
            <span className="font-semibold">补充说明</span>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} placeholder="例如：想增加最近两年的前沿协议案例，补 1 到 2 页 PPT，并加入课堂讨论问题。" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
            <span className="font-semibold">材料正文（可选）</span>
            <textarea value={materialText} onChange={(e) => setMaterialText(e.target.value)} rows={8} placeholder="如果暂时不上传文件，可以直接粘贴原有讲义或 PPT 文字内容。" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="ui-pill cursor-pointer rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            上传旧材料文件
            <input type="file" accept=".txt,.md,.doc,.docx,.pdf,.ppt,.pptx" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
          </label>
          <span className="text-sm text-slate-500">{selectedFile ? `已选择：${selectedFile.name}` : "可上传 PPT、讲义、教案等历史材料"}</span>
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
                setMessage(nextJob.message || "任务已提交，正在等待后台执行。");
              } catch (error) {
                setRunning(false);
                setMessage(error instanceof Error ? error.message : "生成失败，请稍后重试");
              }
            }}
            disabled={running || !canRun}
            className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? (activeJob?.status === "queued" ? "排队中..." : "生成中...") : "生成更新建议"}
          </button>
        </div>
        <p className={`mt-3 text-sm ${message.includes("不可用") || message.includes("失败") ? "text-rose-700" : "text-slate-600"}`}>{message || (selectedModelInfo ? "建议优先补充文字说明，模型会据此更准确生成前沿更新方案。" : "当前没有模型清单时，会使用默认标识请求后端，并返回明确的诊断或回退建议。")}</p>

        {activeJob ? (
          <div className="mt-5 rounded-[28px] border border-[var(--active-border)] bg-[var(--active-surface)] px-5 py-5 shadow-[var(--active-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">后台任务</p>
                <h3 className="mt-2 text-lg font-bold text-slate-900">{activeJobLabel} · {activeJob.progress}%</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{activeJob.message || "页面会自动刷新后台任务状态。"}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activeJob.status === "failed" ? "bg-rose-100 text-rose-700" : activeJob.status === "succeeded" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                {activeJob.status === "queued" ? "等待执行" : activeJob.status === "running" ? "后台处理中" : activeJob.status === "failed" ? "任务失败" : "任务完成"}
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, activeJob.progress))}%` }} />
            </div>
            <p className="mt-3 text-xs text-slate-500">任务编号：{activeJob.id}</p>
            {activeJob.error_message ? <p className="mt-2 text-sm text-rose-700">{activeJob.error_message}</p> : null}
          </div>
        ) : null}
      </section>

      <section className="glass-panel rounded-[32px] px-5 py-6 md:px-6">
        <div className="border-b border-slate-200 pb-4">
          <p className="text-sm font-semibold text-slate-500">输出结果</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">更新建议与历史记录</h2>
        </div>

        {result ? (
          <div className="mt-5 section-card rounded-[28px] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-xl font-bold text-slate-900">{result.title}</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${result.model_status === "failed" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{result.model_status === "failed" ? "模型调用失败" : `模型：${result.used_model_name || result.selected_model}`}</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">{result.summary}</p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              <div><p className="font-semibold text-slate-900">更新建议</p>{result.update_suggestions.length ? result.update_suggestions.map((item, index) => <p key={`${index}-${item}`}>{index + 1}. {item}</p>) : <p>当前没有可展示的结构化建议。</p>}</div>
              <div><p className="font-semibold text-slate-900">新增 PPT 草稿</p>{result.draft_pages.length ? result.draft_pages.map((item, index) => <p key={`${index}-${item}`}>{index + 1}. {item}</p>) : <p>当前没有生成新增页草稿。</p>}</div>
              <div><p className="font-semibold text-slate-900">配图建议</p>{result.image_suggestions.length ? result.image_suggestions.map((item, index) => <p key={`${index}-${item}`}>{index + 1}. {item}</p>) : <p>当前没有生成配图建议。</p>}</div>
            </div>
          </div>
        ) : <div className="section-card mt-5 rounded-[28px] p-8 text-center text-slate-500">生成后，这里会展示更新摘要、可新增的 PPT 页结构和图片建议。</div>}

        <div className="mt-5 space-y-3">
          {history.map((item) => (
            <div key={item.id} className="section-card rounded-[24px] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-semibold text-slate-900">{item.title}</p>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${item.model_status === "failed" ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"}`}>{item.used_model_name || item.selected_model || "未记录模型"}</span>
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
