"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, type AssignmentSummary, type AssignmentTeacherDetail, type CourseOfferingItem } from "@/lib/api";
import { pick } from "@/lib/i18n";

const EMPTY_FORM = {
  offering_id: "",
  course_id: "",
  title: "",
  description: "",
  target_class: "",
  deadline: "",
  attachment_requirements: "",
  submission_format: "",
  grading_notes: "",
  allow_resubmit: true,
  enable_ai_feedback: true,
  remind_days: 2,
};

export default function TeacherAssignmentsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const [offerings, setOfferings] = useState<CourseOfferingItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [detail, setDetail] = useState<AssignmentTeacherDetail | null>(null);
  const [activeAssignmentId, setActiveAssignmentId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState("");

  const loadDetail = useCallback(async (assignmentId: string) => {
    if (!assignmentId) {
      setDetail(null);
      return;
    }
    try {
      setDetail(await api.getTeacherAssignmentDetail(assignmentId));
    } catch {
      setDetail(null);
    }
  }, []);

  const reload = useCallback(async (keepAssignmentId = "") => {
    const [offeringList, assignmentList] = await Promise.all([
      api.teacherListManagedOfferings().catch(() => []),
      api.listTeacherAssignments().catch(() => []),
    ]);
    setOfferings(offeringList);
    setAssignments(assignmentList);
    const selectedOffering = offeringList.find((item) => item.id === form.offering_id) || offeringList[0] || null;
    setForm((prev) => ({
      ...prev,
      offering_id: selectedOffering?.id || "",
      course_id: selectedOffering?.course_id || "",
      target_class: selectedOffering?.class_name || "",
    }));
    const nextAssignmentId = keepAssignmentId || activeAssignmentId || assignmentList[0]?.id || "";
    setActiveAssignmentId(nextAssignmentId);
    await loadDetail(nextAssignmentId);
  }, [activeAssignmentId, form.offering_id, loadDetail]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) router.push("/");
  }, [loading, router, user]);

  useEffect(() => {
    if (user?.role !== "teacher") return;
    void (async () => {
      await reload();
    })();
  }, [reload, user]);

  useEffect(() => {
    if (!activeAssignmentId) return;
    void (async () => {
      await loadDetail(activeAssignmentId);
    })();
  }, [activeAssignmentId, loadDetail]);

  if (!user || user.role !== "teacher") {
    return (
      <WorkspacePage tone="teacher">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载作业管理...", "Loading assignment management...")}</div>
      </WorkspacePage>
    );
  }

  if (offerings.length === 0) {
    return (
      <WorkspacePage tone="teacher">
        <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "作业任务管理", "Assignment Management")}</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900">{pick(language, "先建立课程关系，再发布作业", "Create a course relation before publishing assignments")}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{pick(language, "当前还没有授课关系。先去课程与班级管理绑定课程、班级和学期，作业才会对正确学生生效。", "There are no teaching offerings yet. Bind a course, class, and semester first so assignments reach the right students.")}</p>
          <Link href="/teacher/course-management" className="button-primary mt-5 inline-flex rounded-full px-5 py-3 text-sm font-semibold">
            {pick(language, "前往课程与班级管理", "Open Course Management")}
          </Link>
        </section>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="teacher" className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
      <section className="glass-panel rounded-[32px] px-5 py-6 md:px-6">
        <div className="border-b border-slate-200 pb-4">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "作业任务管理", "Assignment Management")}</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">{pick(language, "按授课关系发布作业", "Publish assignments by teaching offering")}</h2>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
            <span className="font-semibold">{pick(language, "授课关系", "Teaching Offering")}</span>
            <select
              value={form.offering_id}
              onChange={(e) => {
                const offering = offerings.find((item) => item.id === e.target.value);
                setForm((prev) => ({
                  ...prev,
                  offering_id: e.target.value,
                  course_id: offering?.course_id || "",
                  target_class: offering?.class_name || "",
                }));
              }}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
            >
              {offerings.map((offering) => (
                <option key={offering.id} value={offering.id}>
                  {offering.academic_course_name} / {offering.class_name} / {offering.semester}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "面向班级", "Target Class")}</span>
            <input value={form.target_class} readOnly className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3" />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "作业标题", "Assignment Title")}</span>
            <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
            <span className="font-semibold">{pick(language, "作业说明", "Description")}</span>
            <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} rows={4} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "截止日期", "Deadline")}</span>
            <input type="datetime-local" value={form.deadline} onChange={(e) => setForm((prev) => ({ ...prev, deadline: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "提醒天数", "Reminder Days")}</span>
            <input type="number" min={1} max={7} value={form.remind_days} onChange={(e) => setForm((prev) => ({ ...prev, remind_days: Number(e.target.value) }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "附件要求", "Attachment Requirements")}</span>
            <input value={form.attachment_requirements} onChange={(e) => setForm((prev) => ({ ...prev, attachment_requirements: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "提交格式", "Submission Format")}</span>
            <input value={form.submission_format} onChange={(e) => setForm((prev) => ({ ...prev, submission_format: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
            <span className="font-semibold">{pick(language, "评分说明", "Grading Notes")}</span>
            <textarea value={form.grading_notes} onChange={(e) => setForm((prev) => ({ ...prev, grading_notes: e.target.value }))} rows={3} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.allow_resubmit} onChange={(e) => setForm((prev) => ({ ...prev, allow_resubmit: e.target.checked }))} />{pick(language, "允许补交", "Allow Resubmission")}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.enable_ai_feedback} onChange={(e) => setForm((prev) => ({ ...prev, enable_ai_feedback: e.target.checked }))} />{pick(language, "启用 AI 反馈", "Enable AI Feedback")}</label>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">{pick(language, "作业将只对当前授课关系下的学生可见。", "Only students in the selected offering will receive this assignment.")}</p>
          <button
            onClick={async () => {
              try {
                const created = await api.createAssignment(form);
                setMessage(pick(language, "作业已发布。", "Assignment published."));
                setForm((prev) => ({ ...EMPTY_FORM, offering_id: prev.offering_id, course_id: prev.course_id, target_class: prev.target_class }));
                await reload(created.id);
              } catch (error) {
                setMessage(error instanceof Error ? error.message : pick(language, "发布失败", "Publish failed"));
              }
            }}
            className="button-primary rounded-full px-5 py-3 text-sm font-semibold"
          >
            {pick(language, "发布作业", "Publish")}
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
      </section>

      <section className="glass-panel rounded-[32px] px-5 py-6 md:px-6">
        <div className="border-b border-slate-200 pb-4">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "任务跟踪", "Tracking")}</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">{pick(language, "查看提交与未提交", "Review submissions and missing work")}</h2>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {assignments.length === 0 ? (
            <div className="section-card rounded-[24px] px-4 py-5 text-sm text-slate-500">{pick(language, "还没有发布作业。", "No assignments yet.")}</div>
          ) : assignments.map((item) => (
            <button key={item.id} onClick={() => setActiveAssignmentId(item.id)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeAssignmentId === item.id ? "ui-pill-active" : "ui-pill text-slate-700"}`}>
              {item.title}
            </button>
          ))}
        </div>

        {detail ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="section-card rounded-[26px] p-5"><p className="font-semibold text-slate-900">{pick(language, "已提交学生", "Submitted")}</p><p className="mt-2 text-3xl font-black text-slate-900">{detail.submitted_students.length}</p></div>
            <div className="section-card rounded-[26px] p-5"><p className="font-semibold text-slate-900">{pick(language, "未提交学生", "Missing")}</p><p className="mt-2 text-3xl font-black text-slate-900">{detail.unsubmitted_students.length}</p></div>
            <div className="section-card rounded-[26px] p-5 md:col-span-2">
              <h3 className="text-lg font-bold text-slate-900">{detail.assignment.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{detail.assignment.target_class}</p>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                {detail.unsubmitted_students.map((item) => <p key={item.user_id}>{item.display_name} / {item.class_name}</p>)}
              </div>
            </div>
          </div>
        ) : <div className="section-card mt-5 rounded-[26px] p-8 text-center text-slate-500">{pick(language, "请选择一个作业。", "Choose an assignment.")}</div>}
      </section>
    </WorkspacePage>
  );
}
