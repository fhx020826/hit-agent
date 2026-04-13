"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
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
    <WorkspacePage tone="teacher">
      <WorkspaceHero
        tone="teacher"
        eyebrow="课程画像填写"
        title={<h1>创建课程画像</h1>}
        description={
          <p>
            把课程基本信息、学生背景和希望融入的前沿方向填完整，后续课程包就会更聚焦、更贴近真实教学语境。
          </p>
        }
        actions={
          <Link href="/teacher" className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
            返回教师工作台
          </Link>
        }
      />

      <form id="course-create-form" onSubmit={handleSubmit} className="workspace-stack">
        <WorkspaceSection
          tone="teacher"
          eyebrow="基础信息"
          title="先把课程对象和章节位置说清楚"
          description="这些字段决定课程包的语境。内容越具体，后续生成出的讲授节奏与讨论问题越贴近真实课堂。"
        >
          <div className="workspace-form-grid">
            <Field label="课程名称">
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：计算机网络" />
            </Field>
            <Field label="授课对象">
              <input type="text" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="例如：大三本科生" />
            </Field>
            <Field label="授课班级">
              <input type="text" value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} placeholder="例如：计科2301班" />
            </Field>
            <Field label="学生水平">
              <input type="text" value={form.student_level} onChange={(e) => setForm({ ...form, student_level: e.target.value })} placeholder="例如：中等偏上" />
            </Field>
            <Field label="当前章节">
              <input type="text" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} placeholder="例如：第五章 传输层协议" />
            </Field>
            <Field label="课程时长（分钟）">
              <input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value, 10) || 90 })} />
            </Field>
          </div>
        </WorkspaceSection>

        <WorkspaceSection
          tone="teacher"
          eyebrow="内容目标"
          title="再补充课程目标与前沿融入方向"
          description="教师端真正有价值的不是空泛主题，而是你希望学生本节课学会什么，以及你想把哪些新内容带进课堂。"
        >
          <div className="workspace-stack">
            <Field label="课程目标">
              <textarea value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} rows={5} placeholder="例如：理解传输层协议差异，掌握拥塞控制的核心机制。" />
            </Field>
            <Field label="拟融入的前沿方向">
              <input type="text" required value={form.frontier_direction} onChange={(e) => setForm({ ...form, frontier_direction: e.target.value })} placeholder="例如：新一代传输协议与智能网络优化" />
            </Field>
            <div className="workspace-callout soft-grid text-sm leading-7 text-slate-600">
              建议填写得尽量具体一些。课程目标、当前章节、前沿方向越清晰，生成的课程包就越容易贴近你的真实教学语境。
            </div>
          </div>
        </WorkspaceSection>

        <div className="workspace-inline-actions justify-end">
          <Link href="/teacher" className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
            取消
          </Link>
          <button type="submit" disabled={loading} className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {loading ? "创建中..." : "创建并生成课程包"}
          </button>
        </div>
      </form>
    </WorkspacePage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2 text-sm text-slate-700">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  );
}
