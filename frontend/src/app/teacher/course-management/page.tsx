"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { api, type CourseOfferingItem } from "@/lib/api";

type StudentRow = {
  student_user_id: string;
  student_no: string;
  display_name: string;
  class_name: string;
  source: string;
  joined_at: string;
};

export default function TeacherCourseManagementPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [offerings, setOfferings] = useState<CourseOfferingItem[]>([]);
  const [selected, setSelected] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) router.push("/");
  }, [loading, router, user]);

  useEffect(() => {
    if (user?.role === "teacher") {
      api.teacherListManagedOfferings().then(setOfferings).catch(() => setOfferings([]));
    }
  }, [user]);

  useEffect(() => {
    if (selected) {
      api.teacherListOfferingStudents(selected).then(setStudents).catch(() => setStudents([]));
    }
  }, [selected]);

  if (!user || user.role !== "teacher") return <main className="section-card rounded-[24px] p-6">正在进入...</main>;

  return (
    <main className="space-y-4">
      <section className="section-card rounded-[24px] p-5">
        <h1 className="text-xl font-bold">我的授课课程</h1>
        <p className="mt-2 text-sm text-slate-600">
          课程、授课教师和选课学生关系由后台模拟教务处统一初始化。你登录后只能看到自己负责的课程，作业、答疑、讨论、反馈、资料和 AI 教学辅助都只会作用于这些课程下的学生。
        </p>
      </section>

      <section className="section-card rounded-[24px] p-5">
        <h2 className="mb-3 font-semibold">授课课程列表</h2>
        {offerings.length === 0 ? (
          <p className="text-sm text-slate-500">当前账号尚未分配授课课程，请联系管理员或教务处完成排课。</p>
        ) : (
          <div className="space-y-3">
            {offerings.map((offering) => (
              <div key={offering.id} className="rounded-xl border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="font-semibold">{offering.academic_course_name}</div>
                  <div>学期：{offering.semester || "未设置"}</div>
                  <div>教学班：{offering.class_name || "教务统一安排"}</div>
                  <div>选课学生：{offering.enrolled_count}</div>
                  <button className="ui-pill px-3 py-1" onClick={() => setSelected(offering.id)}>
                    查看学生名单
                  </button>
                </div>
                <div className="mt-2 text-slate-600">讨论空间：{offering.discussion_space_id ? "已创建" : "未创建"} | 课程编号：{offering.course_id || offering.academic_course_id}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section-card rounded-[24px] p-5">
        <h2 className="mb-3 font-semibold">学生名单</h2>
        {!selected ? (
          <p className="text-sm text-slate-500">请选择一门授课课程查看学生名单。</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-slate-500">当前课程暂无学生。</p>
        ) : (
          <div className="space-y-2">
            {students.map((student) => (
              <div key={student.student_user_id} className="rounded-xl border px-3 py-2 text-sm">
                {student.student_no} | {student.display_name} | {student.class_name || "未分班"} | {student.source}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
