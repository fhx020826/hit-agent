"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useLanguage } from "@/components/language-provider";
import { WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { api } from "@/lib/api";
import { pick } from "@/lib/i18n";

export default function CourseCreatePage() {
  const router = useRouter();
  const { language } = useLanguage();
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
      router.push(`/teacher/material-update?course_id=${course.id}&generation_mode=generate_new&target_format=ppt`);
    } catch (err) {
      alert(`${pick(language, "创建失败：", "Creation failed: ")}${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <WorkspacePage tone="teacher">
      <WorkspaceHero
        tone="teacher"
        eyebrow={pick(language, "课程设计", "Course Design")}
        title={<h1>{pick(language, "创建课程画像", "Create Course Profile")}</h1>}
        description={
          <p>
            {pick(language, "填写课程信息、学生背景和前沿方向，再进入内容生成。", "Fill in course details, student context, and frontier topics before entering content generation.")}
          </p>
        }
        actions={
          <Link href="/teacher" className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
            {pick(language, "返回教师工作台", "Back to Workspace")}
          </Link>
        }
      />

      <form id="course-create-form" onSubmit={handleSubmit} className="workspace-stack">
        <WorkspaceSection
          tone="teacher"
          eyebrow={pick(language, "基础信息", "Basics")}
          title={pick(language, "先补齐课程基础信息", "Start with course basics")}
          description={pick(language, "这些信息会影响后续 PPT 生成与材料升级的结构和语境。", "These details shape later PPT generation and material upgrades.")}
        >
          <div className="workspace-form-grid">
            <Field label={pick(language, "课程名称", "Course Name")}>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={pick(language, "例如：计算机网络", "Example: Computer Networks")} />
            </Field>
            <Field label={pick(language, "授课对象", "Audience")}>
              <input type="text" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder={pick(language, "例如：大三本科生", "Example: Third-year undergraduates")} />
            </Field>
            <Field label={pick(language, "授课班级", "Class")}>
              <input type="text" value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} placeholder={pick(language, "例如：计科2301班", "Example: CS2301")} />
            </Field>
            <Field label={pick(language, "学生水平", "Student Level")}>
              <input type="text" value={form.student_level} onChange={(e) => setForm({ ...form, student_level: e.target.value })} placeholder={pick(language, "例如：中等偏上", "Example: Intermediate")} />
            </Field>
            <Field label={pick(language, "当前章节", "Current Chapter")}>
              <input type="text" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} placeholder={pick(language, "例如：第五章 传输层协议", "Example: Chapter 5 Transport Protocols")} />
            </Field>
            <Field label={pick(language, "课程时长（分钟）", "Duration (minutes)")}>
              <input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value, 10) || 90 })} />
            </Field>
          </div>
        </WorkspaceSection>

        <WorkspaceSection
          tone="teacher"
          eyebrow={pick(language, "内容目标", "Goals")}
          title={pick(language, "再补充目标与前沿方向", "Then add goals and frontier topics")}
          description={pick(language, "说明学生要学会什么，以及这节课要引入什么新内容。", "Describe what students should learn and which new topics should be introduced.")}
        >
          <div className="workspace-stack">
            <Field label={pick(language, "课程目标", "Learning Goals")}>
              <textarea value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} rows={5} placeholder={pick(language, "例如：理解传输层协议差异，掌握拥塞控制的核心机制。", "Example: Understand transport protocol differences and congestion control.")} />
            </Field>
            <Field label={pick(language, "拟融入的前沿方向", "Frontier Topic")}>
              <input type="text" required value={form.frontier_direction} onChange={(e) => setForm({ ...form, frontier_direction: e.target.value })} placeholder={pick(language, "例如：新一代传输协议与智能网络优化", "Example: New transport protocols and intelligent network optimization")} />
            </Field>
            <div className="workspace-callout soft-grid text-sm leading-7 text-slate-600">
              {pick(language, "信息越具体，后续生成结果越贴近真实课堂。", "The more specific this is, the closer the generated result will be to your real class.")}
            </div>
          </div>
        </WorkspaceSection>

        <div className="workspace-inline-actions justify-end">
          <Link href="/teacher" className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
            {pick(language, "取消", "Cancel")}
          </Link>
          <button type="submit" disabled={loading} className="button-primary rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-60">
            {loading ? pick(language, "创建中...", "Creating...") : pick(language, "创建并进入内容生成", "Create and Open Generation")}
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
