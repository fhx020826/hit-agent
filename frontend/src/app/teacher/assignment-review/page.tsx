"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, type AssignmentReviewResponse, type Course } from "@/lib/api";
import { pick } from "@/lib/i18n";

const emptyForm = {
  course_id: "",
  assignment_type: "作业",
  title: "",
  requirements: "",
  submission_text: "",
};

export default function TeacherAssignmentReviewPage() {
  const { language } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssignmentReviewResponse | null>(null);

  useEffect(() => {
    api.listCourses().then((items) => {
      setCourses(items);
      if (items[0]) {
        setForm((prev) => ({ ...prev, course_id: items[0].id }));
      }
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.previewAssignmentReview(form);
      setResult(response);
    } finally {
      setLoading(false);
    }
  };

  return (
    <WorkspacePage tone="teacher">
      <div className="glass-panel mx-auto max-w-6xl rounded-[32px] px-8 py-8 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-8">
          <div>
            <p className="text-sm font-semibold text-slate-400">{pick(language, "作业辅助批改", "Assignment Review Support")}</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-900 md:text-4xl">{pick(language, "作业辅助批改", "Assignment Review Support")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">{pick(language, "输入任务要求和学生提交内容后，系统会输出结构、逻辑和规范方面的参考反馈。", "Enter the assignment requirements and student submission to generate structure, logic, and writing feedback for teacher review.")}</p>
          </div>
          <Link href="/teacher" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{pick(language, "返回教师工作台", "Back to Workspace")}</Link>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1fr]">
          <form onSubmit={submit} className="section-card rounded-[24px] p-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">{pick(language, "关联课程", "Course")}</span>
              <select value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3">
                <option value="">{pick(language, "请选择课程", "Select a course")}</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">{pick(language, "任务类型", "Task Type")}</span>
              <select value={form.assignment_type} onChange={(e) => setForm({ ...form, assignment_type: e.target.value })} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3">
                <option value="作业">{pick(language, "作业", "Assignment")}</option>
                <option value="大报告">{pick(language, "大报告", "Major Report")}</option>
                <option value="课程论文">{pick(language, "课程论文", "Course Paper")}</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">{pick(language, "任务标题", "Task Title")}</span>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" placeholder={pick(language, "例如：前沿网络技术案例分析", "Example: Frontier network technology case analysis")} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">{pick(language, "任务要求", "Requirements")}</span>
              <textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} rows={5} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" placeholder={pick(language, "填写教师对本次作业或大报告的要求", "Describe the assignment or report requirements")} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">{pick(language, "学生提交内容", "Student Submission")}</span>
              <textarea required value={form.submission_text} onChange={(e) => setForm({ ...form, submission_text: e.target.value })} rows={12} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" placeholder={pick(language, "粘贴学生提交的正文内容", "Paste the student's submission here")} />
            </label>
            <button disabled={loading || !form.title || !form.submission_text} className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">{loading ? pick(language, "生成中...", "Generating...") : pick(language, "生成辅助批改参考", "Generate Review Notes")}</button>
          </form>

          <section className="section-card rounded-[24px] p-6">
            {!result ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-5 py-12 text-center text-slate-500">
                {pick(language, "生成后将在这里展示辅助批改结果。", "The review notes will appear here after generation.")}
              </div>
            ) : (
              <div className="space-y-5">
                <Block title={pick(language, "整体评价", "Overall Summary")} items={[result.summary]} />
                <Block title={pick(language, "结构性反馈", "Structure Feedback")} items={result.structure_feedback} />
                <Block title={pick(language, "逻辑性反馈", "Logic Feedback")} items={result.logic_feedback} />
                <Block title={pick(language, "规范性建议", "Writing Suggestions")} items={result.writing_feedback} />
                <Block title={pick(language, "教师复核参考点", "Teacher Review Checklist")} items={result.rubric_reference} />
                <Block title={pick(language, "教师提示", "Teacher Note")} items={[result.teacher_note]} />
              </div>
            )}
          </section>
        </div>
      </div>
    </WorkspacePage>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3">
        {items.map((item, index) => (
          <div key={index} className="rounded-2xl bg-white/85 px-4 py-4 text-sm leading-7 text-slate-700">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
