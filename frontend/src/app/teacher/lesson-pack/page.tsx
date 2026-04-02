"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type LessonPack } from "@/lib/api";

export default function GenerateLessonPackPage() {
  return <Suspense fallback={<div className="p-8 text-center text-gray-500">生成中...</div>}><GenerateContent /></Suspense>;
}

function GenerateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const courseId = searchParams.get("course_id");
  const [loading, setLoading] = useState(false);
  const [pack, setPack] = useState<LessonPack | null>(null);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    api.generateLessonPack(courseId)
      .then(setPack)
      .catch((e) => alert("生成失败: " + e.message))
      .finally(() => setLoading(false));
  }, [courseId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">生成课时包</h1>
          <Link href="/teacher" className="text-sm text-gray-500 hover:text-gray-700">返回工作台</Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        {loading && <p className="text-center text-gray-500 py-12">正在生成课时包...</p>}
        {!loading && !pack && !courseId && (
          <p className="text-center text-gray-400 py-12">请从课程列表中选择"生成课时包"</p>
        )}
        {pack && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {(pack.payload?.frontier_topic as Record<string, string>)?.name || "课时包"} (v{pack.version})
              </h2>
              <div className="flex gap-3">
                <button onClick={async () => {
                  await api.publishLessonPack(pack.id);
                  setPack({ ...pack, status: "published" });
                }} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                  {pack.status === "published" ? "已发布" : "发布给学生"}
                </button>
                <Link href={`/teacher/lesson-pack/${pack.id}`}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  查看详情
                </Link>
              </div>
            </div>
            <PackSummary payload={pack.payload as Record<string, unknown>} />
          </div>
        )}
      </main>
    </div>
  );
}

function PackSummary({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <Section title="教学目标" items={payload.teaching_objectives as string[]} />
      <Section title="先修要求" items={payload.prerequisites as string[]} />
      <Section title="本节主线" text={payload.main_thread as string} />
      <Section title="时间分配" items={(payload.time_allocation as { segment: string; minutes: number }[])?.map(t => `${t.segment}: ${t.minutes}分钟`)} />
      <Section title="PPT 大纲" items={payload.ppt_outline as string[]} ordered />
      <Section title="讨论题" items={payload.discussion_questions as string[]} />
      <Section title="课后任务" items={payload.after_class_tasks as string[]} />
    </div>
  );
}

function Section({ title, text, items, ordered }: { title: string; text?: string; items?: string[]; ordered?: boolean }) {
  if (!text && (!items || items.length === 0)) return null;
  return (
    <div>
      <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
      {text && <p className="text-sm text-gray-600">{text}</p>}
      {items && (
        <ul className="list-disc list-inside space-y-1">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-gray-600">{ordered ? `${i + 1}. ` : ""}{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
