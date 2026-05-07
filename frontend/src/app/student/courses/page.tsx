"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { api, type CourseOfferingItem, type SchoolClassItem } from "@/lib/api";

export default function StudentCoursesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [courses, setCourses] = useState<CourseOfferingItem[]>([]);
  const [classes, setClasses] = useState<SchoolClassItem[]>([]);
  const [code, setCode] = useState("");
  const [classId, setClassId] = useState("");

  const refresh = async () => {
    const [my, cls] = await Promise.all([api.studentMyCourses().catch(() => []), api.studentClasses().catch(() => [])]);
    setCourses(my); setClasses(cls);
  };

  useEffect(() => { if (!loading && (!user || user.role !== "student")) router.push("/"); }, [loading, router, user]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (user?.role === "student") void refresh(); }, [user]);

  if (!user || user.role !== "student") return <main className="section-card rounded-[24px] p-6">正在进入...</main>;

  return <main className="space-y-4"><section className="section-card rounded-[24px] p-5"><h1 className="text-xl font-bold">我的课程</h1><p className="text-sm text-slate-600 mt-2">加入课程后，才能使用课程 AI 助教、向教师提问、提交作业、进入讨论空间、查看共享资料和提交匿名反馈。</p></section><section className="section-card rounded-[24px] p-5"><h2 className="font-semibold mb-2">我的课程</h2>{courses.length === 0 ? <p className="text-sm text-slate-500">你还没有加入课程。请输入教师提供的课程码，或联系任课教师/管理员完成课程绑定。</p> : courses.map((c) => <div key={c.id} className="border rounded-xl p-3 mb-2 text-sm">{c.academic_course_name} | {c.teacher_name} | {c.class_name} | {c.semester}</div>)}</section><section className="section-card rounded-[24px] p-5"><h2 className="font-semibold mb-2">加入课程</h2><div className="flex gap-2"><input className="input" placeholder="课程码/邀请码" value={code} onChange={(e) => setCode(e.target.value)} /><button className="button-primary px-4" onClick={async () => { if (!code.trim()) return; await api.studentJoinCourseByCode(code.trim()); setCode(""); await refresh(); }}>加入</button></div></section><section className="section-card rounded-[24px] p-5"><h2 className="font-semibold mb-2">班级信息</h2><p className="text-xs text-slate-500 mb-2">选择班级不等于加入课程，课程关系以任课教师或课程码为准。</p><div className="flex gap-2"><select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">选择班级</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="ui-pill px-4" onClick={async () => { if (!classId) return; await api.studentSelectClass(classId); }}>保存班级</button></div></section></main>;
}
