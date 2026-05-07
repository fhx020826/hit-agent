"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { api, type AcademicCourseItem, type CourseOfferingItem, type SchoolClassItem } from "@/lib/api";

export default function TeacherCourseManagementPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [offerings, setOfferings] = useState<CourseOfferingItem[]>([]);
  const [courses, setCourses] = useState<AcademicCourseItem[]>([]);
  const [classes, setClasses] = useState<SchoolClassItem[]>([]);
  const [selected, setSelected] = useState("");
  const [students, setStudents] = useState<Array<{ student_user_id: string; student_no: string; display_name: string; class_name: string; source: string; joined_at: string }>>([]);
  const [newCourseName, setNewCourseName] = useState("");
  const [bindCourseId, setBindCourseId] = useState("");
  const [bindClassId, setBindClassId] = useState("");
  const [semester, setSemester] = useState("2025-2026-2");

  const refresh = async () => {
    const [o, c, cls] = await Promise.all([api.teacherListManagedOfferings().catch(() => []), api.adminListAcademicCourses().catch(() => []), api.adminListSchoolClasses().catch(() => [])]);
    setOfferings(o); setCourses(c); setClasses(cls);
  };

  useEffect(() => { if (!loading && (!user || user.role !== "teacher")) router.push("/"); }, [loading, router, user]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (user?.role === "teacher") void refresh(); }, [user]);
  useEffect(() => { if (selected) api.teacherListOfferingStudents(selected).then(setStudents).catch(() => setStudents([])); }, [selected]);

  if (!user || user.role !== "teacher") return <main className="section-card rounded-[24px] p-6">正在进入...</main>;

  return <main className="space-y-4"><section className="section-card rounded-[24px] p-5"><h1 className="text-xl font-bold">课程与班级管理</h1><p className="text-sm text-slate-600 mt-2">这里用于管理课程、授课班级、学期、课程码和学生名单。完成绑定后，作业、答疑、讨论、反馈和资料共享才会对正确学生生效。</p></section><section className="section-card rounded-[24px] p-5 space-y-3"><h2 className="font-semibold">我的授课关系</h2>{offerings.map((o) => <div key={o.id} className="border rounded-xl p-3 flex flex-wrap items-center gap-3"><div className="font-semibold">{o.academic_course_name}</div><div>{o.class_name}</div><div>{o.semester}</div><div>学生 {o.enrolled_count}</div><div>课程码 {o.invite_code}</div><button className="ui-pill px-3 py-1" onClick={() => setSelected(o.id)}>学生名单</button><button className="ui-pill px-3 py-1" onClick={async () => { await api.teacherRefreshOfferingInvite(o.id); await refresh(); }}>刷新课程码</button></div>)}</section><section className="section-card rounded-[24px] p-5 space-y-3"><h2 className="font-semibold">创建课程</h2><div className="flex gap-2"><input className="input" placeholder="课程名称" value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} /><button className="button-primary px-4" onClick={async () => { if (!newCourseName.trim()) return; await api.teacherCreateManagedCourse({ name: newCourseName.trim() }); setNewCourseName(""); await refresh(); }}>创建</button></div></section><section className="section-card rounded-[24px] p-5 space-y-3"><h2 className="font-semibold">绑定班级与学期</h2><div className="flex flex-wrap gap-2"><select className="input" value={bindCourseId} onChange={(e) => setBindCourseId(e.target.value)}><option value="">选择课程</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select className="input" value={bindClassId} onChange={(e) => setBindClassId(e.target.value)}><option value="">选择班级</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input className="input" value={semester} onChange={(e) => setSemester(e.target.value)} /><button className="button-primary px-4" onClick={async () => { if (!bindCourseId || !bindClassId) return; await api.teacherCreateManagedOffering({ academic_course_id: bindCourseId, class_id: bindClassId, semester, join_enabled: true }); await refresh(); }}>绑定</button></div></section><section className="section-card rounded-[24px] p-5"><h2 className="font-semibold">学生名单</h2>{!selected ? <p className="text-sm text-slate-500">请先点击某个授课关系。</p> : students.map((s) => <div key={s.student_user_id} className="py-1 text-sm">{s.student_no} {s.display_name} {s.class_name} {s.source}</div>)}</section></main>;
}
