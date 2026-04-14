"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, type LessonPack } from "@/lib/api";
import { pick } from "@/lib/i18n";

export default function LessonPackDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const [pack, setPack] = useState<LessonPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPack = useCallback(() => {
    setLoading(true);
    api.getLessonPack(id)
      .then((p) => {
        setPack(p);
        setError(null);
      })
      .catch((e) => setError(`${pick(language, "加载课程包失败：", "Failed to load lesson pack: ")}${e instanceof Error ? e.message : pick(language, "网络错误", "Network error")}`))
      .finally(() => setLoading(false));
  }, [id, language]);

  useEffect(() => {
    loadPack();
  }, [loadPack]);

  if (loading) {
    return (
      <WorkspacePage tone="teacher">
        <div className="px-6 py-24 text-center text-slate-500">{pick(language, "正在加载课程包详情...", "Loading lesson pack details...")}</div>
      </WorkspacePage>
    );
  }
  if (error) {
    return (
      <WorkspacePage tone="teacher">
        <div className="px-6 py-24 text-center">
          <p className="text-rose-600">{error}</p>
          <button onClick={loadPack} className="mt-4 rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white">{pick(language, "重试", "Retry")}</button>
        </div>
      </WorkspacePage>
    );
  }
  if (!pack) {
    return (
      <WorkspacePage tone="teacher">
        <div className="px-6 py-24 text-center text-slate-400">{pick(language, "课程包不存在。", "Lesson pack not found.")}</div>
      </WorkspacePage>
    );
  }

  const payload = pack.payload as Record<string, unknown>;
  const frontierTopic = payload.frontier_topic as Record<string, string>;

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const updated = await api.publishLessonPack(pack.id);
      setPack(updated);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <WorkspacePage tone="teacher">
      <div className="glass-panel mx-auto max-w-5xl rounded-[32px] px-8 py-8 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-8">
          <div>
            <p className="text-sm font-semibold text-slate-400">{pick(language, "课程包详情页", "Lesson Pack Details")}</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-900 md:text-4xl">{pick(language, "课程包详情", "Lesson Pack Details")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">{pick(language, "查看模型生成内容、确认课程包结构，并决定是否发布给学生端使用。", "Review the generated content, confirm the lesson pack structure, and decide whether to publish it to students.")}</p>
          </div>
          <Link href="/teacher" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{pick(language, "返回教师工作台", "Back to Workspace")}</Link>
        </div>

        <section className="mt-8 section-card rounded-[28px] p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-900">{frontierTopic?.name || pick(language, "未命名课程包", "Untitled lesson pack")} ({pick(language, `第 ${pack.version} 版`, `Version ${pack.version}`)})</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pack.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {pack.status === "published" ? pick(language, "已发布", "Published") : pick(language, "草稿", "Draft")}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{pick(language, "前沿主题：", "Topic: ")}{frontierTopic?.name || pick(language, "暂无", "Not set")} | {pick(language, "插入位置：", "Placement: ")}{frontierTopic?.insert_position || pick(language, "暂无", "Not set")} | {pick(language, "建议时长：", "Suggested time: ")}{frontierTopic?.time_suggestion || pick(language, "暂无", "Not set")}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {pack.status !== "published" && <button onClick={handlePublish} disabled={publishing} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{publishing ? pick(language, "发布中...", "Publishing...") : pick(language, "发布给学生", "Publish to Students")}</button>}
              <Link href={`/teacher/review?lp_id=${pack.id}`} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">{pick(language, "查看复盘", "Open Review")}</Link>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Field title={pick(language, "教学目标", "Teaching Goals")} items={toStringArray(payload.teaching_objectives)} />
          <Field title={pick(language, "先修要求", "Prerequisites")} items={toStringArray(payload.prerequisites)} />
          <Field title={pick(language, "本节主线", "Main Thread")} text={payload.main_thread as string} full />
          <Field title={pick(language, "时间分配", "Time Allocation")} items={formatTimeAllocation(payload.time_allocation, language)} />
          <Field title={pick(language, "课件大纲", "Slides Outline")} items={toStringArray(payload.ppt_outline)} ordered full />
          <Field title={pick(language, "教师提示", "Teacher Tips")} items={toStringArray(payload.teacher_tips)} />
          <Field title={pick(language, "案例素材", "Case Materials")} items={toStringArray(payload.case_materials)} />
          <Field title={pick(language, "讨论题", "Discussion Questions")} items={toStringArray(payload.discussion_questions)} />
          <Field title={pick(language, "课后任务", "After-class Tasks")} items={toStringArray(payload.after_class_tasks)} />
          <Field title={pick(language, "延伸阅读", "Extended Reading")} items={toStringArray(payload.extended_reading)} />
          {payload.risk_warning ? <Field title={pick(language, "风险提示", "Risk Warning")} text={payload.risk_warning as string} full /> : null}
          <Field title={pick(language, "参考资料", "References")} items={toStringArray(payload.references)} full />
        </div>
      </div>
    </WorkspacePage>
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

function formatTimeAllocation(value: unknown, language: "zh-CN" | "en-US"): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const segment = typeof record.segment === "string" ? record.segment : "";
          const minutes = record.minutes;
          if (segment && minutes !== undefined && minutes !== null && String(minutes).trim()) {
            return language === "en-US" ? `${segment}: ${minutes} min` : `${segment}：${minutes} 分钟`;
          }
          return JSON.stringify(record);
        }
        return String(item ?? "");
      })
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => language === "en-US" ? `${key}: ${item}` : `${key}：${item}`);
  }
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }
  return [];
}

function Field({ title, text, items, ordered, full }: { title: string; text?: string; items?: string[]; ordered?: boolean; full?: boolean }) {
  if (!text && (!items || items.length === 0)) return null;
  return (
    <section className={`section-card rounded-[24px] p-6 ${full ? "md:col-span-2" : ""}`}>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      {text && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{text}</p>}
      {items && (
        <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
          {items.map((item, index) => (
            <li key={index} className="rounded-2xl bg-white/85 px-4 py-3">{ordered ? `${index + 1}. ` : ""}{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
