"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { api, type CourseOfferingItem } from "@/lib/api";

export default function StudentCoursesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [courses, setCourses] = useState<CourseOfferingItem[]>([]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/");
  }, [loading, router, user]);

  useEffect(() => {
    if (user?.role === "student") {
      api.studentMyCourses().then(setCourses).catch(() => setCourses([]));
    }
  }, [user]);

  if (!user || user.role !== "student") return <main className="section-card rounded-[24px] p-6">正在进入...</main>;

  return (
    <main className="space-y-4">
      <section className="section-card rounded-[24px] p-5">
        <h1 className="text-xl font-bold">我的课程</h1>
        <p className="mt-2 text-sm text-slate-600">
          课程、任课教师和选课关系由后台模拟教务处统一初始化。你登录后只能看到自己已经选修的课程，AI 助教、作业、讨论、资料和匿名反馈都围绕这些课程关系运行。
        </p>
      </section>

      <section className="section-card rounded-[24px] p-5">
        <h2 className="mb-3 font-semibold">已选课程</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-slate-500">当前账号尚未生成选课关系，请联系管理员或教务处完成选课数据初始化。</p>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => (
              <div key={course.id} className="rounded-xl border p-3 text-sm">
                <div className="font-semibold">{course.academic_course_name}</div>
                <div className="mt-1 text-slate-600">
                  任课教师：{course.teacher_name || "未分配"} | 学期：{course.semester || "未设置"} | 讨论空间：{course.discussion_space_id ? "已创建" : "未创建"}
                </div>
                <div className="mt-1 text-slate-600">课程编号：{course.course_id || course.academic_course_id} | 教学班：{course.class_name || "教务统一安排"}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
