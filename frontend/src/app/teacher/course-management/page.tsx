"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useLanguage } from "@/components/language-provider";
import { WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { api, type TeacherCourseManagementDetail } from "@/lib/api";
import { pick } from "@/lib/i18n";

export default function TeacherCourseManagementPage() {
  const { language } = useLanguage();
  const [courses, setCourses] = useState<TeacherCourseManagementDetail[]>([]);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [bindingCourseId, setBindingCourseId] = useState("");
  const [courseForm, setCourseForm] = useState({
    name: "",
    class_name: "",
    audience: "",
    term: "",
    student_level: "",
    chapter: "",
    objectives: "",
    duration_minutes: 90,
    frontier_direction: "",
  });
  const [classForm, setClassForm] = useState({ class_name: "", term: "" });

  const loadCourses = async () => {
    const list = await api.listTeacherCourseManagement().catch(() => []);
    setCourses(list);
    if (!bindingCourseId && list[0]?.id) setBindingCourseId(list[0].id);
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    try {
      await api.createCourse(courseForm);
      setCourseForm({
        name: "",
        class_name: "",
        audience: "",
        term: "",
        student_level: "",
        chapter: "",
        objectives: "",
        duration_minutes: 90,
        frontier_direction: "",
      });
      await loadCourses();
      setMessage(pick(language, "课程已创建，并已准备课程码与班级绑定。", "Course created and ready for enrollment."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "创建课程失败。", "Failed to create course."));
    } finally {
      setCreating(false);
    }
  };

  const handleAddClass = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bindingCourseId) return;
    setMessage("");
    try {
      await api.addCourseClass(bindingCourseId, classForm);
      setClassForm({ class_name: "", term: "" });
      await loadCourses();
      setMessage(pick(language, "班级已绑定，讨论空间会自动补齐。", "Class bound and discussion space synced."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "绑定班级失败。", "Failed to bind class."));
    }
  };

  const handleRegenerateCode = async (courseId: string) => {
    setMessage("");
    try {
      await api.regenerateCourseInviteCode(courseId);
      await loadCourses();
      setMessage(pick(language, "课程邀请码已刷新。", "Invite code regenerated."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "刷新邀请码失败。", "Failed to regenerate invite code."));
    }
  };

  return (
    <WorkspacePage tone="teacher">
      <WorkspaceHero
        tone="teacher"
        eyebrow={pick(language, "课程与班级管理", "Course & Class Management")}
        title={<h1>{pick(language, "持续维护教师-课程-班级-学生关系", "Maintain teacher-course-class-student links")}</h1>}
        description={<p>{pick(language, "这里不是首次强制绑定，而是一个长期可用的课程关系入口。创建课程、绑定班级、查看学生、分发邀请码，都从这里完成。", "Use this persistent entry to create courses, bind classes, review members, and distribute invite codes.")}</p>}
        actions={
          <>
            <Link href="/teacher/course" className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
              {pick(language, "去课程设计", "Go to Course Design")}
            </Link>
            <Link href="/teacher/discussions" className="button-primary rounded-full px-5 py-3 text-sm font-semibold">
              {pick(language, "查看讨论空间", "Open Discussions")}
            </Link>
          </>
        }
      />

      <div className="workspace-stack">
        {message ? <div className="section-card rounded-[24px] px-5 py-4 text-sm text-slate-600">{message}</div> : null}

        <WorkspaceSection tone="teacher" title={pick(language, "新建课程", "Create Course")} description={pick(language, "课程建好后才能继续绑定班级、生成邀请码并连接后续教学功能。", "Create the course first, then bind classes and unlock the teaching workflow.")}>
          <form className="workspace-stack" onSubmit={handleCreate}>
            <div className="workspace-form-grid">
              <Field label={pick(language, "课程名称", "Course Name")}><input value={courseForm.name} required onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} /></Field>
              <Field label={pick(language, "默认班级", "Default Class")}><input value={courseForm.class_name} onChange={(e) => setCourseForm({ ...courseForm, class_name: e.target.value })} /></Field>
              <Field label={pick(language, "学期", "Term")}><input value={courseForm.term} onChange={(e) => setCourseForm({ ...courseForm, term: e.target.value })} placeholder="2026春" /></Field>
              <Field label={pick(language, "授课对象", "Audience")}><input value={courseForm.audience} onChange={(e) => setCourseForm({ ...courseForm, audience: e.target.value })} /></Field>
              <Field label={pick(language, "学生水平", "Student Level")}><input value={courseForm.student_level} onChange={(e) => setCourseForm({ ...courseForm, student_level: e.target.value })} /></Field>
              <Field label={pick(language, "当前章节", "Chapter")}><input value={courseForm.chapter} onChange={(e) => setCourseForm({ ...courseForm, chapter: e.target.value })} /></Field>
            </div>
            <Field label={pick(language, "课程目标", "Objectives")}><textarea rows={4} value={courseForm.objectives} onChange={(e) => setCourseForm({ ...courseForm, objectives: e.target.value })} /></Field>
            <Field label={pick(language, "前沿方向", "Frontier Topic")}><input value={courseForm.frontier_direction} onChange={(e) => setCourseForm({ ...courseForm, frontier_direction: e.target.value })} /></Field>
            <div className="workspace-inline-actions justify-end">
              <button type="submit" disabled={creating} className="button-primary rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-60">
                {creating ? pick(language, "创建中...", "Creating...") : pick(language, "创建课程", "Create Course")}
              </button>
            </div>
          </form>
        </WorkspaceSection>

        <WorkspaceSection tone="teacher" title={pick(language, "绑定更多班级", "Bind More Classes")} description={pick(language, "一个课程可以绑定多个授课班级，每个班级都能形成自己的成员关系和讨论空间。", "A course can bind multiple classes with their own member lists and discussion spaces.")}>
          <form className="workspace-form-grid" onSubmit={handleAddClass}>
            <Field label={pick(language, "所属课程", "Course")}>
              <select value={bindingCourseId} onChange={(e) => setBindingCourseId(e.target.value)}>
                <option value="">{pick(language, "请选择课程", "Select a course")}</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </Field>
            <Field label={pick(language, "班级名称", "Class Name")}><input value={classForm.class_name} required onChange={(e) => setClassForm({ ...classForm, class_name: e.target.value })} /></Field>
            <Field label={pick(language, "学期", "Term")}><input value={classForm.term} onChange={(e) => setClassForm({ ...classForm, term: e.target.value })} /></Field>
            <div className="workspace-inline-actions items-end">
              <button type="submit" className="ui-pill rounded-full px-6 py-3 text-sm font-semibold">
                {pick(language, "绑定班级", "Bind Class")}
              </button>
            </div>
          </form>
        </WorkspaceSection>

        <WorkspaceSection tone="teacher" title={pick(language, "课程关系总览", "Course Relationship Overview")} description={pick(language, "这里可以直接查看班级、邀请码、已绑定学生和后续讨论空间/评价对象的落点。", "Review classes, invite codes, bound students, and downstream teaching targets here.")}>
          <div className="grid gap-4">
            {courses.length === 0 ? <div className="section-card rounded-[24px] px-5 py-6 text-sm text-slate-500">{pick(language, "当前还没有课程，请先创建一门课程。", "No courses yet. Create one first.")}</div> : courses.map((course) => (
              <article key={course.id} className="section-card rounded-[28px] p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{course.name}</h3>
                    <p className="mt-2 text-sm text-slate-500">{pick(language, "学期：", "Term: ")}{course.term || "-"} · {pick(language, "学生数：", "Students: ")}{course.student_count} · {pick(language, "讨论空间：", "Spaces: ")}{course.discussion_space_count}</p>
                  </div>
                  <button type="button" onClick={() => handleRegenerateCode(course.id)} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
                    {pick(language, "刷新邀请码", "Regenerate Code")}
                  </button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <div className="font-semibold">{pick(language, "课程邀请码", "Course Invite Code")}</div>
                    <div className="mt-2 text-lg font-black text-slate-900">{course.invite_code || "-"}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <div className="font-semibold">{pick(language, "已绑定班级", "Bound Classes")}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {course.bound_classes.map((item) => <span key={item.id} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{item.class_name} / {item.invite_code}</span>)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="text-sm font-semibold text-slate-700">{pick(language, "已绑定成员", "Bound Members")}</div>
                  <div className="mt-3 grid gap-2">
                    {course.members.length === 0 ? <p className="text-sm text-slate-500">{pick(language, "当前还没有学生加入，发放邀请码后会在这里看到成员。", "No students yet. Members will appear here after joining.")}</p> : course.members.map((member) => (
                      <div key={`${course.id}-${member.user_id}-${member.role}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
                        <span>{member.display_name}</span>
                        <span>{member.role} · {member.class_name || "-"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </WorkspaceSection>
      </div>
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
