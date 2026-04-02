"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type LessonPack } from "@/lib/api";

export default function LessonPackDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [pack, setPack] = useState<LessonPack | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLessonPack(id).then(setPack).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500">加载中...</div>;
  if (!pack) return <div className="p-8 text-center text-red-500">课时包不存在</div>;

  const p = pack.payload as Record<string, unknown>;
  const ft = p.frontier_topic as Record<string, string>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">课时包详情</h1>
          <Link href="/teacher" className="text-sm text-gray-500 hover:text-gray-700">返回工作台</Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{ft?.name || "课时包"} (v{pack.version})</h2>
            <span className={`text-sm ${pack.status === "published" ? "text-green-600" : "text-yellow-600"}`}>
              {pack.status === "published" ? "已发布" : "草稿"}
            </span>
          </div>
          <div className="flex gap-3">
            {pack.status !== "published" && (
              <button onClick={async () => {
                const updated = await api.publishLessonPack(pack.id);
                setPack(updated);
              }} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">发布给学生</button>
            )}
            <Link href={`/teacher/review?lp_id=${pack.id}`} className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">查看复盘</Link>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <Field title="教学目标" items={p.teaching_objectives as string[]} />
          <Field title="先修要求" items={p.prerequisites as string[]} />
          <Field title="本节主线" text={p.main_thread as string} />
          <Field title="前沿主题" text={ft ? `${ft.name} | 插入位置: ${ft.insert_position} | 建议时长: ${ft.time_suggestion}` : ""} />
          <Field title="时间分配" items={(p.time_allocation as { segment: string; minutes: number }[])?.map(t => `${t.segment}: ${t.minutes}分钟`)} />
          <Field title="PPT 大纲" items={p.ppt_outline as string[]} ordered />
          <Field title="教师讲授提示" items={p.teacher_tips as string[]} />
          <Field title="案例素材" items={p.case_materials as string[]} />
          <Field title="讨论题" items={p.discussion_questions as string[]} />
          <Field title="课后任务" items={p.after_class_tasks as string[]} />
          <Field title="延伸阅读" items={p.extended_reading as string[]} />
          {p.risk_warning ? <Field title="风险提示" text={p.risk_warning as string} /> : null}
          <Field title="参考依据" items={p.references as string[]} />
        </div>
      </main>
    </div>
  );
}

function Field({ title, text, items, ordered }: { title: string; text?: string; items?: string[]; ordered?: boolean }) {
  if (!text && (!items || items.length === 0)) return null;
  return (
    <div>
      <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
      {text && <p className="text-sm text-gray-600 whitespace-pre-line">{text}</p>}
      {items && (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-gray-600">
              {ordered ? `${i + 1}. ` : "\u2022 "}{item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
