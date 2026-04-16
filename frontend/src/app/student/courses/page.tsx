"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useLanguage } from "@/components/language-provider";
import { WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { api, type Course, type CourseCatalogItem } from "@/lib/api";
import { pick } from "@/lib/i18n";

export default function StudentCoursesPage() {
  const { language } = useLanguage();
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [catalog, setCatalog] = useState<CourseCatalogItem[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [selectedClassName, setSelectedClassName] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    const [courses, catalogItems] = await Promise.all([
      api.listCourses().catch(() => []),
      api.listCourseCatalog().catch(() => []),
    ]);
    setMyCourses(courses);
    setCatalog(catalogItems);
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedCatalog = useMemo(
    () => catalog.find((item) => item.course_id === selectedCatalogId) || null,
    [catalog, selectedCatalogId],
  );

  useEffect(() => {
    if (!selectedCatalog) {
      setSelectedClassName("");
      return;
    }
    setSelectedClassName(selectedCatalog.class_options[0] || "");
  }, [selectedCatalog]);

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      await api.joinCourse({ invite_code: inviteCode, class_name: selectedClassName || undefined });
      setInviteCode("");
      await loadData();
      setMessage(pick(language, "加入课程成功，课程相关问答、作业、反馈和讨论空间已可用。", "Joined successfully. Course Q&A, assignments, feedback, and discussions are now enabled."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "加入课程失败。", "Failed to join course."));
    }
  };

  return (
    <WorkspacePage tone="student">
      <WorkspaceHero
        tone="student"
        eyebrow={pick(language, "我的课程 / 加入课程", "My Courses / Join")}
        title={<h1>{pick(language, "持续可用的课程匹配入口", "Persistent course matching entry")}</h1>}
        description={<p>{pick(language, "这里不是首次进入强制绑定，而是你随时都能回来完成课程加入、查看任课教师、进入讨论空间的入口。", "Use this page any time to join courses, view teachers, and enter discussion spaces.")}</p>}
        actions={
          <>
            <Link href="/student/qa" className="button-primary rounded-full px-5 py-3 text-sm font-semibold">
              {pick(language, "去课程问答", "Go to Course Q&A")}
            </Link>
            <Link href="/student/discussions" className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
              {pick(language, "去讨论空间", "Open Discussions")}
            </Link>
          </>
        }
      />

      <div className="workspace-stack">
        {message ? <div className="section-card rounded-[24px] px-5 py-4 text-sm text-slate-600">{message}</div> : null}

        <WorkspaceSection tone="student" title={pick(language, "输入邀请码加入课程", "Join with Invite Code")} description={pick(language, "教师创建课程后会提供课程码/邀请码。加入成功后，课程相关教学功能才会针对你生效。", "Teachers provide invite codes. Once joined, the course workflow becomes available to you.")}>
          <form className="workspace-form-grid" onSubmit={handleJoin}>
            <Field label={pick(language, "邀请码", "Invite Code")}><input value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} required /></Field>
            <Field label={pick(language, "课程目录", "Course Catalog")}>
              <select value={selectedCatalogId} onChange={(e) => setSelectedCatalogId(e.target.value)}>
                <option value="">{pick(language, "可选：先从课程目录里确认课程与班级", "Optional: confirm via catalog first")}</option>
                {catalog.map((item) => <option key={item.course_id} value={item.course_id}>{item.course_name} / {item.teacher_name}</option>)}
              </select>
            </Field>
            <Field label={pick(language, "班级", "Class")}>
              <select value={selectedClassName} onChange={(e) => setSelectedClassName(e.target.value)}>
                <option value="">{pick(language, "自动匹配或手动选择", "Auto match or select")}</option>
                {(selectedCatalog?.class_options || []).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <div className="workspace-inline-actions items-end">
              <button type="submit" className="button-primary rounded-full px-6 py-3 text-sm font-semibold">
                {pick(language, "加入课程", "Join Course")}
              </button>
            </div>
          </form>
        </WorkspaceSection>

        <WorkspaceSection tone="student" title={pick(language, "我的课程", "My Courses")} description={pick(language, "只有建立教师-课程-班级-学生关系后，提问、作业、反馈、讨论空间、资料共享才会对你准确开放。", "Course Q&A, assignments, feedback, discussions, and materials activate after the relationship is established.")}>
          <div className="grid gap-4">
            {myCourses.length === 0 ? <div className="section-card rounded-[24px] px-5 py-6 text-sm text-slate-500">{pick(language, "你还没有加入任何课程。拿到邀请码后，在上方输入即可。", "You have not joined any course yet. Use the invite code above when you get one.")}</div> : myCourses.map((course) => (
              <article key={course.id} className="section-card rounded-[28px] p-6">
                <h3 className="text-xl font-bold text-slate-900">{course.name}</h3>
                <p className="mt-2 text-sm text-slate-500">{pick(language, "教师：", "Teacher: ")}{course.teacher_name || "-"} · {pick(language, "学期：", "Term: ")}{course.term || "-"}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {course.bound_classes.map((item) => <span key={item.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{item.class_name}</span>)}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={`/student/qa?course_id=${course.id}`} className="button-primary rounded-full px-4 py-2 text-sm font-semibold">{pick(language, "课程提问", "Ask")}</Link>
                  <Link href="/student/discussions" className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">{pick(language, "进入讨论", "Discussion")}</Link>
                  <Link href="/student/assignments" className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">{pick(language, "查看作业", "Assignments")}</Link>
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
