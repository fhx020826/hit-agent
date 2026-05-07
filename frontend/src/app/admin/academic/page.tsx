"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { api, type AcademicCourseItem, type CourseOfferingItem, type CurrentUser, type SchoolClassItem } from "@/lib/api";

export default function AdminAcademicPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [classes, setClasses] = useState<SchoolClassItem[]>([]);
  const [courses, setCourses] = useState<AcademicCourseItem[]>([]);
  const [offerings, setOfferings] = useState<CourseOfferingItem[]>([]);
  const [teachers, setTeachers] = useState<CurrentUser[]>([]);
  const [courseId, setCourseId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [classId, setClassId] = useState("");
  const [semester, setSemester] = useState("2025-2026-2");

  const refresh = async () => {
    const [cls, cs, os, ts] = await Promise.all([api.adminListSchoolClasses().catch(() => []), api.adminListAcademicCourses().catch(() => []), api.adminListOfferings().catch(() => []), api.adminListTeachers().catch(() => [])]);
    setClasses(cls); setCourses(cs); setOfferings(os); setTeachers(ts);
  };

  useEffect(() => { if (!loading && (!user || user.role !== "admin")) router.push("/"); }, [loading, router, user]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (user?.role === "admin") void refresh(); }, [user]);

  if (!user || user.role !== "admin") return <main className="section-card rounded-[24px] p-6">正在进入...</main>;

  return <main className="space-y-4"><section className="section-card rounded-[24px] p-5"><h1 className="text-xl font-bold">教务数据管理</h1><div className="mt-3 flex gap-2"><button className="button-primary px-4" onClick={async () => { await api.adminSeedDemoSchool(); await refresh(); }}>补齐模拟全校数据</button></div></section><section className="section-card rounded-[24px] p-5"><h2 className="font-semibold mb-2">排课</h2><div className="flex flex-wrap gap-2"><select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}><option value="">课程</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select className="input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}><option value="">教师</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}</select><select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">班级</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input className="input" value={semester} onChange={(e) => setSemester(e.target.value)} /><button className="button-primary px-4" onClick={async () => { if (!courseId || !teacherId || !classId) return; await api.adminCreateOffering({ academic_course_id: courseId, teacher_user_id: teacherId, class_id: classId, semester }); await refresh(); }}>创建开课关系</button></div></section><section className="section-card rounded-[24px] p-5"><h2 className="font-semibold mb-2">开课关系</h2>{offerings.map((o) => <div key={o.id} className="border rounded-xl p-3 mb-2 text-sm">{o.academic_course_name} | {o.teacher_name} | {o.class_name} | {o.semester} | {o.invite_code}</div>)}</section></main>;
}
