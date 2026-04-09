"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

export default function CourseCreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    audience: "",
    class_name: "",
    student_level: "",
    chapter: "",
    objectives: "",
    duration_minutes: 90,
    frontier_direction: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const course = await api.createCourse(form);
      router.push(`/teacher/lesson-pack?course_id=${course.id}`);
    } catch (err) {
      alert(`创建失败：${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="glass-panel mx-auto max-w-4xl rounded-[32px] px-8 py-8 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-8">
          <div>
            <p className="text-sm font-semibold text-slate-400">课程画像填写</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-900 md:text-4xl">创建课程画像</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              把课程基本信息、学生背景和希望融入的前沿方向填完整，后续课程包就会更聚焦、更贴近真实教学语境。
            </p>
          </div>
          <Link href="/teacher" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">返回教师工作台</Link>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <Field label="课程名称">
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-[20px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" placeholder="例如：计算机网络" />
          </Field>

          <div className="grid gap-6 md:grid-cols-2">
            <Field label="授课对象">
              <input type="text" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} className="w-full rounded-[20px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" placeholder="例如：大三本科生" />
            </Field>
            <Field label="授课班级">
              <input type="text" value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} className="w-full rounded-[20px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" placeholder="例如：计科2301班" />
            </Field>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Field label="学生水平">
              <input type="text" value={form.student_level} onChange={(e) => setForm({ ...form, student_level: e.target.value })} className="w-full rounded-[20px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" placeholder="例如：中等偏上" />
            </Field>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Field label="当前章节">
              <input type="text" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} className="w-full rounded-[20px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" placeholder="例如：第五章 传输层协议" />
            </Field>
            <Field label="课程时长（分钟）">
              <input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value, 10) || 90 })} className="w-full rounded-[20px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" />
            </Field>
          </div>

          <Field label="课程目标">
            <textarea value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} rows={4} className="w-full rounded-[20px] border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" placeholder="例如：理解传输层协议差异，掌握拥塞控制的核心机制。" />
          </Field>

          <Field label="拟融入的前沿方向">
            <input type="text" required value={form.frontier_direction} onChange={(e) => setForm({ ...form, frontier_direction: e.target.value })} className="w-full rounded-[20px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" placeholder="例如：新一代传输协议与智能网络优化" />
          </Field>

          <div className="section-card rounded-[24px] p-5 text-sm leading-7 text-slate-600">建议填写得尽量具体一些。课程目标、当前章节、前沿方向越清晰，生成的课程包就越容易贴近你的真实教学语境。</div>

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Link href="/teacher" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">取消</Link>
            <button type="submit" disabled={loading} className="rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "创建中..." : "创建并生成课程包"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
