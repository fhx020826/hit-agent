"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { api, type AssignmentStudentView, type Course, type SurveyPendingItem } from "@/lib/api";
import { pick } from "@/lib/i18n";

export default function StudentDashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<AssignmentStudentView[]>([]);
  const [pendingSurveys, setPendingSurveys] = useState<SurveyPendingItem[]>([]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) {
      router.push("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || user.role !== "student") return;
    Promise.all([
      api.listCourses().catch(() => []),
      api.listStudentAssignments().catch(() => []),
      api.listPendingSurveys().catch(() => []),
    ]).then(([courseList, assignmentList, surveyList]) => {
      setCourses(courseList);
      setAssignments(assignmentList);
      setPendingSurveys(surveyList);
    });
  }, [user]);

  const cards = useMemo(
    () => [
      { href: "/student/qa", title: pick(language, "课程专属 AI 助教", "Course AI Assistant"), desc: pick(language, "支持 AI / 教师 / 双通道提问，多轮连续追问，图片和文档辅助提问。", "Supports AI, teacher or dual-channel questions, multi-turn follow-ups, and image or document-assisted prompts.") },
      { href: "/student/questions", title: pick(language, "学习问答记录", "Q&A History"), desc: pick(language, "查看历史提问、AI 回答、教师补充回复和收藏内容。", "Review past questions, AI answers, teacher follow-ups and saved items.") },
      { href: "/student/discussions", title: pick(language, "课程讨论空间", "Course Discussion Spaces"), desc: pick(language, "进入课程班级讨论空间，和同学、教师、AI 助教一起围绕课程内容交流。", "Join class discussion spaces and learn together with classmates, teachers and the AI assistant.") },
      { href: "/student/materials", title: pick(language, "课堂共享资料", "Shared Classroom Materials"), desc: pick(language, "查看教师课上共享的 PPT、讲义、图片、视频资料，也可以主动请求教师上传。", "View teacher-shared PPTs, notes, images and videos, or request more materials from the teacher.") },
      { href: "/student/weakness", title: pick(language, "薄弱点分析", "Weakness Analysis"), desc: pick(language, "根据连续提问记录，生成温和的学习诊断和复习建议。", "Generate gentle learning diagnostics and review suggestions from your question history.") },
      { href: "/student/assignments", title: pick(language, "作业任务中心", "Assignment Center"), desc: pick(language, "查看任务、确认收到、上传作业并查看 AI 初步反馈。", "Review assignments, confirm receipt, upload work and check preliminary AI feedback.") },
      { href: "/student/feedback", title: pick(language, "匿名课堂反馈", "Anonymous Feedback"), desc: pick(language, "课后自愿填写匿名问卷，可稍后忽略，不反复强制打扰。", "Fill out anonymous post-class feedback voluntarily, or skip it without repeated interruption.") },
    ],
    [language],
  );

  if (!user || user.role !== "student") {
    return <main className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在进入学生学习台...", "Opening student workspace...")}</main>;
  }

  return (
    <main className="space-y-5">
      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-semibold text-slate-500">{pick(language, "学生学习台", "Student Workspace")}</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">{pick(language, "围绕课程学习、作业提交与课后反馈的一站式入口", "A single entry for course learning, assignment submission and post-class feedback")}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              {pick(language, "你当前使用本人账号登录。若不希望教师在问题展示中看到公开身份，可在提问时勾选匿名发言；匿名发言不会影响作业、记录和权限绑定。", "You are signed in with your own account. If you do not want teachers to see your public identity on a question, enable anonymous posting when asking. Anonymous posting does not affect assignments, records or permission binding.")}
            </p>
          </div>
          <div className="rounded-[24px] bg-white/70 px-5 py-4 text-sm leading-7 text-slate-600">
            <p><span className="font-semibold text-slate-900">{pick(language, "当前用户：", "Current user: ")}</span>{user.display_name}</p>
            <p><span className="font-semibold text-slate-900">{pick(language, "待完成作业：", "Pending assignments: ")}</span>{assignments.filter((item) => !item.submission).length}</p>
            <p><span className="font-semibold text-slate-900">{pick(language, "待填写反馈：", "Pending feedback: ")}</span>{pendingSurveys.length}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <div className="section-card rounded-[28px] p-6"><p className="text-sm text-slate-500">{pick(language, "已开放课程", "Available Courses")}</p><p className="mt-3 text-4xl font-black text-slate-900">{courses.length}</p></div>
          <div className="section-card rounded-[28px] p-6"><p className="text-sm text-slate-500">{pick(language, "进行中作业", "Active Assignments")}</p><p className="mt-3 text-4xl font-black text-slate-900">{assignments.length}</p></div>
          <div className="section-card rounded-[28px] p-6"><p className="text-sm text-slate-500">{pick(language, "匿名反馈提醒", "Anonymous Feedback Alerts")}</p><p className="mt-3 text-4xl font-black text-slate-900">{pendingSurveys.length}</p></div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="section-card rounded-[28px] p-6 transition hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(20,33,61,0.12)]">
            <h3 className="text-2xl font-bold text-slate-900">{card.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{card.desc}</p>
            <p className="mt-6 text-sm font-semibold text-[var(--accent)]">{pick(language, "点击进入", "Open")}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
