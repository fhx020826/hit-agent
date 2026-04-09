"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, type LessonPack } from "@/lib/api";

export default function GenerateLessonPackPage() {
  return (
    <Suspense fallback={<div className="px-6 py-24 text-center text-slate-500">正在准备课程包生成页...</div>}>
      <GenerateContent />
    </Suspense>
  );
}

function GenerateContent() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get("course_id");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pack, setPack] = useState<LessonPack | null>(null);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    api.generateLessonPack(courseId)
      .then(setPack)
      .catch((e) => alert(`生成失败：${e.message}`))
      .finally(() => setLoading(false));
  }, [courseId]);

  const handlePublish = async () => {
    if (!pack) return;
    setPublishing(true);
    try {
      const updated = await api.publishLessonPack(pack.id);
      setPack(updated);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="glass-panel mx-auto max-w-6xl rounded-[32px] px-8 py-8 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-8">
          <div>
            <p className="text-sm font-semibold text-slate-400">课程包生成结果</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-900 md:text-4xl">生成课程包</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">这里会调用后端模型生成结构化课程包。如果已经配置了真实模型密钥，就会直接走模型；否则会自动降级到示例数据，方便继续调页面流程。</p>
          </div>
          <Link href="/teacher" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">返回教师工作台</Link>
        </div>

        {loading && <div className="py-20 text-center text-slate-500">模型正在生成课程包，请稍等...</div>}

        {!loading && !pack && !courseId && <div className="section-card mt-8 rounded-[24px] p-10 text-center text-slate-500">请从课程列表中选择一门课程，再进入课程包生成流程。</div>}

        {pack && (
          <div className="mt-8 space-y-6">
            <div className="section-card rounded-[28px] p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-teal-700">已完成生成</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">{((pack.payload?.frontier_topic as Record<string, string>)?.name || "未命名课程包")}（第 {pack.version} 版）</h2>
                  <p className="mt-2 text-sm text-slate-500">当前状态：{pack.status === "published" ? "已发布" : "草稿"}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={handlePublish} disabled={publishing || pack.status === "published"} className="rounded-full bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
                    {pack.status === "published" ? "已发布给学生" : publishing ? "发布中..." : "发布给学生"}
                  </button>
                  <Link href={`/teacher/lesson-pack/${pack.id}`} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">查看详情</Link>
                </div>
              </div>
            </div>

            <PackSummary payload={pack.payload as Record<string, unknown>} />
          </div>
        )}
      </div>
    </main>
  );
}

function PackSummary({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Section title="教学目标" items={toStringArray(payload.teaching_objectives)} />
      <Section title="先修要求" items={toStringArray(payload.prerequisites)} />
      <Section title="本节主线" text={payload.main_thread as string} full />
      <Section title="时间分配" items={formatTimeAllocation(payload.time_allocation)} />
      <Section title="课件大纲" items={toStringArray(payload.ppt_outline)} ordered full />
      <Section title="讨论题" items={toStringArray(payload.discussion_questions)} />
      <Section title="课后任务" items={toStringArray(payload.after_class_tasks)} />
    </div>
  );
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") return JSON.stringify(item);
        return String(item ?? "");
      })
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }
  return [];
}

function formatTimeAllocation(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const segment = typeof record.segment === "string" ? record.segment : "";
          const minutes = record.minutes;
          if (segment && minutes !== undefined && minutes !== null && String(minutes).trim()) {
            return `${segment}：${minutes} 分钟`;
          }
          return JSON.stringify(record);
        }
        return String(item ?? "");
      })
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}：${item}`);
  }
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }
  return [];
}

function Section({ title, text, items, ordered, full }: { title: string; text?: string; items?: string[]; ordered?: boolean; full?: boolean }) {
  if (!text && (!items || items.length === 0)) return null;
  return (
    <div className={`section-card rounded-[24px] p-6 ${full ? "md:col-span-2" : ""}`}>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      {text && <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>}
      {items && (
        <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
          {items.map((item, i) => (
            <li key={i} className="rounded-2xl bg-white/80 px-4 py-3">{ordered ? `${i + 1}. ` : ""}{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
