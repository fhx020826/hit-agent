"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { SignalStrip, WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
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
    <WorkspacePage tone="teacher">
      <WorkspaceHero
        tone="teacher"
        eyebrow="课程包生成结果"
        title={<h1>生成课程包</h1>}
        description={
          <p>
            这里会调用后端模型生成结构化课程包。如果已经配置了真实模型密钥，就会直接走模型；否则会自动降级到示例数据，方便继续调页面流程。
          </p>
        }
        actions={
          <Link href="/teacher" className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
            返回教师工作台
          </Link>
        }
      />

      {loading ? (
        <WorkspaceSection tone="teacher" title="模型正在生成课程包，请稍等...">
          <div className="py-12 text-center text-slate-500">模型正在生成课程包，请稍等...</div>
        </WorkspaceSection>
      ) : null}

      {!loading && !pack && !courseId ? (
        <WorkspaceSection tone="teacher" title="请从课程列表中选择一门课程，再进入课程包生成流程。">
          <div className="empty-state">请从课程列表中选择一门课程，再进入课程包生成流程。</div>
        </WorkspaceSection>
      ) : null}

      {pack ? (
        <>
          <WorkspaceSection
            tone="teacher"
            eyebrow="已完成生成"
            title={`${((pack.payload?.frontier_topic as Record<string, string>)?.name || "未命名课程包")}（第 ${pack.version} 版）`}
            description={`当前状态：${pack.status === "published" ? "已发布" : "草稿"}`}
            actions={
              <div className="workspace-inline-actions">
                <button onClick={handlePublish} disabled={publishing || pack.status === "published"} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                  {pack.status === "published" ? "已发布给学生" : publishing ? "发布中..." : "发布给学生"}
                </button>
                <Link href={`/teacher/lesson-pack/${pack.id}`} className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
                  查看详情
                </Link>
              </div>
            }
          >
            <SignalStrip
              tone="teacher"
              items={[
                { label: "版本", value: pack.version, note: "版本号越高，代表后续更新迭代越多。" },
                { label: "状态", value: pack.status === "published" ? "已发布" : "草稿", note: "发布后学生端才会进入真实学习链路。" },
                { label: "课程包详情", value: "结构化输出", note: "下方继续查看教学目标、时间分配与课后任务。" },
              ]}
            />
          </WorkspaceSection>
          <PackSummary payload={pack.payload as Record<string, unknown>} />
        </>
      ) : null}
    </WorkspacePage>
  );
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
