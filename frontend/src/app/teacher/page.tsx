"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { api, type AssignmentSummary, type Course, type QuestionRecord, type TeacherNotification } from "@/lib/api";
import { pick } from "@/lib/i18n";

export default function TeacherDashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [notifications, setNotifications] = useState<TeacherNotification[]>([]);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) {
      router.push("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || user.role !== "teacher") return;
    Promise.all([
      api.listCourses().catch(() => []),
      api.listTeacherAssignments().catch(() => []),
      api.listTeacherNotifications().catch(() => []),
      api.listTeacherQuestions().catch(() => []),
    ]).then(([courseList, assignmentList, notificationList, questionList]) => {
      setCourses(courseList.filter((item) => !item.owner_user_id || item.owner_user_id === user.id));
      setAssignments(assignmentList);
      setNotifications(notificationList);
      setQuestions(questionList);
    });
  }, [user]);

  const modules = useMemo(
    () => [
      {
        href: "/teacher/course",
        title: pick(language, "智能课程设计助手", "Course Design Assistant"),
        desc: pick(language, "根据课程主题、授课对象和教学目标生成课程设计建议。", "Generate course design suggestions from the course topic, learners and teaching goals."),
      },
      {
        href: "/teacher/material-update",
        title: pick(language, "PPT / 教案更新", "PPT / Lesson Update"),
        desc: pick(language, "上传旧讲义、旧 PPT 或教案，生成前沿内容更新建议。", "Upload old handouts, PPTs or lesson plans and generate frontier-content update suggestions."),
      },
      {
        href: "/teacher/materials",
        title: pick(language, "课堂资料共享", "Classroom Material Sharing"),
        desc: pick(language, "上传 PPT、PDF、图片、视频等资料，并一键共享到学生端同步展示。", "Upload PPTs, PDFs, images and videos, then share them to the student side for synchronized display."),
      },
      {
        href: "/teacher/discussions",
        title: pick(language, "课程讨论空间", "Course Discussion Spaces"),
        desc: pick(language, "进入课程与班级绑定的群聊式讨论空间，统一查看学生交流、附件与 @AI 助教记录。", "Enter course-and-class discussion spaces to review messages, attachments and @AI assistant interactions."),
      },
      {
        href: "/teacher/ai-config",
        title: pick(language, "课程专属 AI 助教配置", "Course AI Assistant Setup"),
        desc: pick(language, "限定学生端 AI 助教知识边界、回答风格与答疑范围。", "Define knowledge boundaries, answer style and response scope for the student-facing AI assistant."),
      },
      {
        href: "/teacher/assignments",
        title: pick(language, "作业任务管理", "Assignment Management"),
        desc: pick(language, "发布作业、查看接收确认、未提交名单和 AI 初步反馈。", "Publish assignments and monitor confirmations, missing submissions and preliminary AI feedback."),
      },
      {
        href: "/teacher/questions",
        title: pick(language, "学生提问反馈中心", "Student Question Center"),
        desc: pick(language, "接收学生提交给教师的问题，查看附件并进行回复。", "Receive student questions for teachers, review attachments and send replies."),
      },
      {
        href: "/teacher/feedback",
        title: pick(language, "匿名问卷分析", "Anonymous Feedback Analytics"),
        desc: pick(language, "查看参与率、评分分布和匿名文本建议。", "Review participation rates, rating distributions and anonymous text suggestions."),
      },
    ],
    [language],
  );

  if (!user || user.role !== "teacher") {
    return <main className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在进入教师工作台...", "Opening teacher workspace...")}</main>;
  }

  return (
    <main className="space-y-5">
      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-semibold text-slate-500">{pick(language, "教师工作台", "Teacher Workspace")}</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">{pick(language, "以教师为核心的教学设计、实施、反馈与优化闭环", "A teacher-centered workflow for design, delivery, feedback and continuous improvement")}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              {pick(language, "当前工作台仅展示教师职责相关功能。学生提问、作业完成、匿名问卷与课程资料更新都会在这里形成汇总，AI 只提供辅助建议，不替代教师的专业判断。", "This workspace only shows teacher responsibilities. Student questions, assignments, anonymous feedback and material updates are summarized here, while AI remains an efficiency tool rather than a replacement for teacher judgment.")}
            </p>
          </div>
          <div className="rounded-[24px] bg-white/70 px-5 py-4 text-sm leading-7 text-slate-600">
            <p><span className="font-semibold text-slate-900">{pick(language, "当前教师：", "Current teacher: ")}</span>{user.display_name}</p>
            <p><span className="font-semibold text-slate-900">{pick(language, "待处理提问：", "Pending questions: ")}</span>{questions.filter((item) => item.teacher_reply_status === "pending").length}</p>
            <p><span className="font-semibold text-slate-900">{pick(language, "已发布作业：", "Published assignments: ")}</span>{assignments.length}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-4">
          <div className="section-card rounded-[28px] p-6"><p className="text-sm text-slate-500">{pick(language, "我的课程", "My Courses")}</p><p className="mt-3 text-4xl font-black text-slate-900">{courses.length}</p></div>
          <div className="section-card rounded-[28px] p-6"><p className="text-sm text-slate-500">{pick(language, "作业任务", "Assignments")}</p><p className="mt-3 text-4xl font-black text-slate-900">{assignments.length}</p></div>
          <div className="section-card rounded-[28px] p-6"><p className="text-sm text-slate-500">{pick(language, "学生提问提醒", "Student Alerts")}</p><p className="mt-3 text-4xl font-black text-slate-900">{notifications.filter((item) => !item.is_read).length}</p></div>
          <div className="section-card rounded-[28px] p-6"><p className="text-sm text-slate-500">{pick(language, "待教师回复问题", "Questions Waiting for Teacher")}</p><p className="mt-3 text-4xl font-black text-slate-900">{questions.filter((item) => item.teacher_reply_status === "pending").length}</p></div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {modules.map((module) => (
          <Link key={module.href} href={module.href} className="section-card rounded-[28px] p-6 transition hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(20,33,61,0.12)]">
            <h3 className="text-2xl font-bold text-slate-900">{module.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{module.desc}</p>
            <p className="mt-6 text-sm font-semibold text-[var(--accent)]">{pick(language, "点击进入", "Open")}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
