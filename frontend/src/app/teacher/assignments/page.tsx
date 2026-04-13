"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, type AssignmentSummary, type AssignmentTeacherDetail, type Course, type CourseClassItem } from "@/lib/api";

const EMPTY_FORM = {
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
  const [courses, setCourses] = useState<Course[]>([]);
  const [classOptions, setClassOptions] = useState<CourseClassItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [detail, setDetail] = useState<AssignmentTeacherDetail | null>(null);
  const [activeAssignmentId, setActiveAssignmentId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(false);

  const teacherCourses = useMemo(() => {
    if (!user) return courses;
    const taughtNames = new Set(user.profile.common_courses || []);
    const filtered = courses.filter((course) => course.owner_user_id === user.id || taughtNames.has(course.name));
    return filtered.length > 0 ? filtered : courses;
  }, [courses, user]);

  const loadClassOptions = useCallback(async (courseId: string, preferredClass = "") => {
    if (!courseId) {
      setClassOptions([]);
      setForm((prev) => ({ ...prev, target_class: "" }));
      return;
    }
    setLoadingClasses(true);
    try {
      const options = await api.listTeacherCourseClasses(courseId);
      setClassOptions(options);
      setForm((prev) => {
        const allowed = options.some((item) => item.class_name === prev.target_class);
        const nextTargetClass = preferredClass || (allowed ? prev.target_class : options[0]?.class_name || "");
        return { ...prev, target_class: nextTargetClass };
      });
    } catch {
      setClassOptions([]);
      setForm((prev) => ({ ...prev, target_class: preferredClass || "" }));
    } finally {
      setLoadingClasses(false);
    }
  }, []);

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

  const reload = useCallback(async (keepActiveId?: string) => {
    const [courseList, assignmentList] = await Promise.all([
      api.listCourses(),
      api.listTeacherAssignments(),
    ]);
    setCourses(courseList);
    setAssignments(assignmentList);

    const teacherOwned = user ? courseList.filter((course) => course.owner_user_id === user.id) : courseList;
    const firstCourseId = (teacherOwned[0] || courseList[0])?.id || "";
    setForm((prev) => {
      const nextCourseId = prev.course_id || firstCourseId;
      return { ...prev, course_id: nextCourseId };
    });
    await loadClassOptions(form.course_id || firstCourseId, courseList.find((course) => course.id === (form.course_id || firstCourseId))?.class_name || "");

    const currentId = keepActiveId || activeAssignmentId || assignmentList[0]?.id || "";
    setActiveAssignmentId(currentId);
    await loadDetail(currentId);
  }, [activeAssignmentId, form.course_id, loadClassOptions, loadDetail, user]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || user.role !== "teacher") return;
    let alive = true;
    const load = async () => {
      try {
        const [courseList, assignmentList] = await Promise.all([
          api.listCourses(),
          api.listTeacherAssignments(),
        ]);
        if (!alive) return;
        setCourses(courseList);
        setAssignments(assignmentList);

        const teacherOwned = courseList.filter((course) => course.owner_user_id === user.id);
        const firstCourseId = (teacherOwned[0] || courseList[0])?.id || "";
        setForm((prev) => ({ ...prev, course_id: prev.course_id || firstCourseId }));
        await loadClassOptions(firstCourseId, courseList.find((course) => course.id === firstCourseId)?.class_name || "");

        const currentId = assignmentList[0]?.id || "";
        setActiveAssignmentId(currentId);
        if (currentId) {
          const nextDetail = await api.getTeacherAssignmentDetail(currentId);
          if (alive) setDetail(nextDetail);
        } else {
          setDetail(null);
        }
      } catch {
        if (!alive) return;
        setCourses([]);
        setAssignments([]);
        setClassOptions([]);
        setDetail(null);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [loadClassOptions, user]);

  useEffect(() => {
    if (!activeAssignmentId) return;
    void loadDetail(activeAssignmentId);
  }, [activeAssignmentId, loadDetail]);

  if (!user || user.role !== "teacher") {
    return (
      <WorkspacePage tone="teacher">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">正在加载作业任务管理...</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="teacher" className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
      <section className="glass-panel rounded-[32px] px-5 py-6 md:px-6">
        <div className="border-b border-slate-200 pb-4">
          <p className="text-sm font-semibold text-slate-500">作业任务管理</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">发布作业，并按授课班级追踪确认与提交情况</h2>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">所属课程</span>
            <select
              value={form.course_id}
              onChange={(e) => {
                const nextCourseId = e.target.value;
                setForm((prev) => ({ ...prev, course_id: nextCourseId, target_class: "" }));
                void loadClassOptions(nextCourseId);
              }}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
            >
              <option value="">请选择课程</option>
              {teacherCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">面向班级</span>
            <select
              value={form.target_class}
              onChange={(e) => setForm((prev) => ({ ...prev, target_class: e.target.value }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
              disabled={!form.course_id || loadingClasses}
            >
              <option value="">{loadingClasses ? "读取班级中..." : "请选择班级"}</option>
              {classOptions.map((item) => (
                <option key={item.id} value={item.class_name}>
                  {item.class_name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
            <span className="font-semibold">作业标题</span>
            <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="请输入作业标题" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
            <span className="font-semibold">作业说明</span>
            <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} rows={4} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">截止日期</span>
            <input type="datetime-local" value={form.deadline} onChange={(e) => setForm((prev) => ({ ...prev, deadline: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">提醒天数</span>
            <input type="number" min={1} max={7} value={form.remind_days} onChange={(e) => setForm((prev) => ({ ...prev, remind_days: Number(e.target.value) }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">附件要求</span>
            <input value={form.attachment_requirements} onChange={(e) => setForm((prev) => ({ ...prev, attachment_requirements: e.target.value }))} placeholder="如：PDF 或 DOCX" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">提交格式要求</span>
            <input value={form.submission_format} onChange={(e) => setForm((prev) => ({ ...prev, submission_format: e.target.value }))} placeholder="如：单文件或多文件压缩包" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
            <span className="font-semibold">评分说明</span>
            <textarea value={form.grading_notes} onChange={(e) => setForm((prev) => ({ ...prev, grading_notes: e.target.value }))} rows={3} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.allow_resubmit} onChange={(e) => setForm((prev) => ({ ...prev, allow_resubmit: e.target.checked }))} />允许补交</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.enable_ai_feedback} onChange={(e) => setForm((prev) => ({ ...prev, enable_ai_feedback: e.target.checked }))} />开启 AI 辅助反馈</label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            面向班级已改为读取当前教师负责的班级名单，避免发布时手动输入出错。
          </p>
          <button
            onClick={async () => {
              try {
                const created = await api.createAssignment(form);
                setMessage("作业已发布。学生端可确认收到并上传提交。");
                setForm((prev) => ({ ...EMPTY_FORM, course_id: prev.course_id, target_class: prev.target_class }));
                await reload(created.id);
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "发布失败，请稍后重试");
              }
            }}
            className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            发布作业
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
      </section>

      <section className="glass-panel rounded-[32px] px-5 py-6 md:px-6">
        <div className="border-b border-slate-200 pb-4">
          <p className="text-sm font-semibold text-slate-500">任务跟踪</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">查看班级确认、提交和未提交情况</h2>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {assignments.length === 0 ? (
            <div className="section-card rounded-[24px] px-4 py-5 text-sm text-slate-500">还没有发布作业任务。</div>
          ) : assignments.map((item) => (
            <button key={item.id} onClick={() => setActiveAssignmentId(item.id)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeAssignmentId === item.id ? "ui-pill-active" : "ui-pill text-slate-700"}`}>
              {item.title}
            </button>
          ))}
        </div>

        {detail ? (
          <div className="mt-5 space-y-4">
            <div className="section-card rounded-[26px] p-5">
              <h3 className="text-lg font-bold text-slate-900">{detail.assignment.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">截止时间：{detail.assignment.deadline} · 面向班级：{detail.assignment.target_class || "全体学生"}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="section-card rounded-[26px] p-5"><p className="font-semibold text-slate-900">已提交学生</p><p className="mt-2 text-3xl font-black text-slate-900">{detail.submitted_students.length}</p><div className="mt-3 space-y-2 text-sm text-slate-600">{detail.submitted_students.map((item) => <p key={item.user_id}>{item.display_name} · {item.class_name || "未填班级"}</p>)}</div></div>
              <div className="section-card rounded-[26px] p-5"><p className="font-semibold text-slate-900">未提交学生</p><p className="mt-2 text-3xl font-black text-slate-900">{detail.unsubmitted_students.length}</p><div className="mt-3 space-y-2 text-sm text-slate-600">{detail.unsubmitted_students.map((item) => <p key={item.user_id}>{item.display_name} · {item.class_name || "未填班级"}</p>)}</div></div>
              <div className="section-card rounded-[26px] p-5"><p className="font-semibold text-slate-900">已确认未提交</p><p className="mt-2 text-3xl font-black text-slate-900">{detail.confirmed_but_unsubmitted.length}</p><div className="mt-3 space-y-2 text-sm text-slate-600">{detail.confirmed_but_unsubmitted.map((item) => <p key={item.user_id}>{item.display_name}</p>)}</div></div>
              <div className="section-card rounded-[26px] p-5"><p className="font-semibold text-slate-900">未确认收到</p><p className="mt-2 text-3xl font-black text-slate-900">{detail.unconfirmed_students.length}</p><div className="mt-3 space-y-2 text-sm text-slate-600">{detail.unconfirmed_students.map((item) => <p key={item.user_id}>{item.display_name}</p>)}</div></div>
            </div>
          </div>
        ) : <div className="section-card mt-5 rounded-[26px] p-8 text-center text-slate-500">请选择一个作业查看提交跟踪情况。</div>}
      </section>
    </WorkspacePage>
  );
}
