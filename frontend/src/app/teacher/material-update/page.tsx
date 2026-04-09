"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { api, type Course, type MaterialUpdateResult, type ModelOption } from "@/lib/api";

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
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  const reload = async () => {
    const [courseList, updateList, modelList] = await Promise.all([api.listCourses(), api.listMaterialUpdates(), api.listModels().catch(() => [])]);
    setCourses(courseList);
    setHistory(updateList);
    setModels(modelList);
    setCourseId((prev) => prev || courseList[0]?.id || "");
    setSelectedModel((prev) => {
      if (modelList.some((item) => item.key === prev)) return prev;
      return modelList[0]?.key || "";
    });
  };

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || user.role !== "teacher") return;
    reload().catch(() => {
      setCourses([]);
      setHistory([]);
      setModels([]);
    });
  }, [user]);

  const selectedModelInfo = useMemo(() => models.find((item) => item.key === selectedModel) || null, [models, selectedModel]);

  if (!user || user.role !== "teacher") return <main className="section-card rounded-[28px] p-8 text-center text-slate-500">正在加载 PPT / 教案更新页面...</main>;

  return (
    <main className="grid gap-5 xl:grid-cols-[1.04fr_0.96fr]">
      <section className="glass-panel rounded-[32px] px-5 py-6 md:px-6">
        <div className="sticky-toolbar top-20 z-20 mb-5 rounded-[28px] px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">PPT / 教案更新</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">在旧材料基础上快速补入近年热点、案例和前沿内容</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">生成前会先读取你当前选择的模型，再把旧材料摘要、教师补充说明和课程上下文一起送入真实模型推理。</p>
            </div>
            <div className="relative w-full max-w-sm">
              <p className="text-sm font-semibold text-slate-500">当前模型</p>
              <button type="button" onClick={() => setModelMenuOpen((prev) => !prev)} className="mt-2 w-full rounded-[22px] border border-[var(--active-border)] bg-[var(--active-surface)] px-4 py-4 text-left shadow-[var(--active-shadow)] transition">
                <span className="block text-sm font-semibold text-slate-900">{selectedModelInfo?.label || "暂无可用模型"}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{selectedModelInfo?.description || "请先在后端配置至少一个可用模型后再生成更新建议。"}</span>
                {selectedModelInfo ? <span className="mt-2 inline-flex rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-600">实际模型：{selectedModelInfo.model_name}</span> : null}
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
                const next = selectedFile
                  ? await api.uploadMaterialUpdate({ course_id: courseId || undefined, title, instructions, selected_model: selectedModel, file: selectedFile })
                  : await api.previewMaterialUpdate({ course_id: courseId || undefined, title, instructions, material_text: materialText, selected_model: selectedModel });
                setResult(next);
                setMessage(next.model_status === "failed" ? next.summary : `已生成更新建议，本次实际使用模型：${next.used_model_name || next.selected_model}。`);
                await reload();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "生成失败，请稍后重试");
              } finally {
                setRunning(false);
              }
            }}
            disabled={running || !selectedModelInfo}
            className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? "生成中..." : "生成更新建议"}
          </button>
        </div>
        <p className={`mt-3 text-sm ${message.includes("不可用") || message.includes("失败") ? "text-rose-700" : "text-slate-600"}`}>{message || (selectedModelInfo ? "建议优先补充文字说明，模型会据此更准确生成前沿更新方案。" : "当前没有可用模型，请先在后端配置后再使用该功能。")}</p>
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
    </main>
  );
}
