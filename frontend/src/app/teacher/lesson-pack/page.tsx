"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import { SignalStrip, WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { api, type LessonPack, type TaskJobRecord } from "@/lib/api";
import { pick } from "@/lib/i18n";

export default function GenerateLessonPackPage() {
  return (
    <Suspense fallback={<LessonPackFallback />}>
      <GenerateContent />
    </Suspense>
  );
}

function LessonPackFallback() {
  const { language } = useLanguage();
  return <div className="px-6 py-24 text-center text-slate-500">{pick(language, "正在准备课程包生成页...", "Preparing the lesson pack page...")}</div>;
}

function GenerateContent() {
  const { language } = useLanguage();
  const searchParams = useSearchParams();
  const courseId = searchParams.get("course_id");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pack, setPack] = useState<LessonPack | null>(null);
  const [job, setJob] = useState<TaskJobRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    setLoading(true);
    setPack(null);
    setJob(null);
    setErrorMessage("");
    api.createLessonPackJob(courseId)
      .then((submittedJob) => {
        if (cancelled) return;
        setJob(submittedJob);
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : pick(language, "课程包生成失败，请稍后重试。", "Lesson pack generation failed. Please try again."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, language]);

  useEffect(() => {
    if (!job) return;
    if (job.status === "succeeded") {
      const nextPack = getLessonPackFromJob(job);
      if (nextPack) {
        setPack(nextPack);
        setErrorMessage("");
      }
      return;
    }
    if (job.status === "failed") {
      setErrorMessage(job.error_message || job.message || pick(language, "课程包生成失败，请稍后重试。", "Lesson pack generation failed. Please try again."));
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const nextJob = await api.getTaskJob(job.id);
        setJob(nextJob);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : pick(language, "课程包任务状态刷新失败。", "Failed to refresh the lesson pack task."));
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [job, language]);

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
    <WorkspacePage tone="teacher">
      <WorkspaceHero
        tone="teacher"
        eyebrow={pick(language, "课程包生成结果", "Lesson Pack Generation")}
        title={<h1>{pick(language, "生成课程包", "Generate Lesson Pack")}</h1>}
        description={
          <p>
            {pick(language, "课程包生成已切换为后台异步任务。页面会自动轮询进度，完成后再继续发布。", "Lesson pack generation now runs as a background job. The page polls progress automatically and lets you continue when the result is ready.")}
          </p>
        }
        actions={
          <Link href="/teacher" className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
            {pick(language, "返回教师工作台", "Back to Workspace")}
          </Link>
        }
      />

      {loading ? (
        <WorkspaceSection tone="teacher" title={pick(language, "模型正在提交课程包任务，请稍等...", "Submitting the lesson pack task...")}>
          <div className="py-12 text-center text-slate-500">{pick(language, "模型正在提交课程包任务，请稍等...", "Submitting the lesson pack task...")}</div>
        </WorkspaceSection>
      ) : null}

      {job && !pack ? (
        <WorkspaceSection tone="teacher" title={job.status === "queued" ? pick(language, "课程包任务已入队，正在等待后台执行...", "The lesson pack task is queued...") : pick(language, "模型正在后台生成课程包...", "The lesson pack is being generated in the background...")}>
          <SignalStrip
            tone="teacher"
            items={[
              { label: pick(language, "任务状态", "Task Status"), value: job.status === "queued" ? pick(language, "排队中", "Queued") : job.status === "running" ? pick(language, "执行中", "Running") : job.status, note: job.message || pick(language, "后台任务会自动继续推进。", "The job will continue in the background.") },
              { label: pick(language, "进度", "Progress"), value: `${job.progress}%`, note: pick(language, "当前页面会自动轮询任务状态，无需手动刷新。", "This page polls the task automatically.") },
              { label: pick(language, "任务编号", "Job ID"), value: job.id, note: pick(language, "这为后续扩展统一后台任务中心预留了基础。", "This also lays the groundwork for a broader task center.") },
            ]}
          />
        </WorkspaceSection>
      ) : null}

      {!loading && !pack && !courseId ? (
        <WorkspaceSection tone="teacher" title={pick(language, "请从课程列表中选择一门课程，再进入课程包生成流程。", "Choose a course before starting lesson pack generation.")}>
          <div className="empty-state">{pick(language, "请从课程列表中选择一门课程，再进入课程包生成流程。", "Choose a course before starting lesson pack generation.")}</div>
        </WorkspaceSection>
      ) : null}

      {errorMessage ? (
        <WorkspaceSection tone="teacher" title={pick(language, "课程包生成失败", "Lesson Pack Generation Failed")}>
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-7 text-rose-700">{errorMessage}</div>
        </WorkspaceSection>
      ) : null}

      {pack ? (
        <>
          <WorkspaceSection
            tone="teacher"
            eyebrow={pick(language, "已完成生成", "Generated")}
            title={`${((pack.payload?.frontier_topic as Record<string, string>)?.name || pick(language, "未命名课程包", "Untitled lesson pack"))} (${pick(language, `第 ${pack.version} 版`, `Version ${pack.version}`)})`}
            description={`${pick(language, "当前状态：", "Status: ")}${pack.status === "published" ? pick(language, "已发布", "Published") : pick(language, "草稿", "Draft")}`}
            actions={
              <div className="workspace-inline-actions">
                <button onClick={handlePublish} disabled={publishing || pack.status === "published"} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                  {pack.status === "published" ? pick(language, "已发布给学生", "Published to Students") : publishing ? pick(language, "发布中...", "Publishing...") : pick(language, "发布给学生", "Publish to Students")}
                </button>
                <Link href={`/teacher/lesson-pack/${pack.id}`} className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
                  {pick(language, "查看详情", "View Details")}
                </Link>
              </div>
            }
          >
            <SignalStrip
              tone="teacher"
              items={[
                { label: pick(language, "版本", "Version"), value: pack.version, note: pick(language, "版本号越高，代表后续更新迭代越多。", "Higher versions mean more iterations.") },
                { label: pick(language, "状态", "Status"), value: pack.status === "published" ? pick(language, "已发布", "Published") : pick(language, "草稿", "Draft"), note: pick(language, "发布后学生端才会进入真实学习链路。", "Students only see the real learning flow after publication.") },
                { label: pick(language, "课程包详情", "Pack Output"), value: pick(language, "结构化输出", "Structured Output"), note: pick(language, "下方继续查看教学目标、时间分配与课后任务。", "Review goals, timing, and after-class tasks below.") },
              ]}
            />
          </WorkspaceSection>
          <PackSummary payload={pack.payload as Record<string, unknown>} />
        </>
      ) : null}
    </WorkspacePage>
  );
}

function getLessonPackFromJob(job: TaskJobRecord): LessonPack | null {
  const candidate = job.result.lesson_pack;
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as LessonPack;
}

function PackSummary({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
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
    <WorkspaceSection tone="teacher" className={full ? "md:col-span-2" : ""} title={title}>
      {text ? <p className="text-sm leading-7 text-slate-600">{text}</p> : null}
      {items ? (
        <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
          {items.map((item, index) => (
            <li key={`${index}-${item}`} className="rounded-2xl bg-white/80 px-4 py-3">
              {ordered ? `${index + 1}. ` : ""}
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </WorkspaceSection>
  );
}
