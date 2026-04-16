"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { ActionTile, MetricCard, SignalStrip, WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
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

  const pendingQuestions = questions.filter((item) => item.teacher_reply_status === "pending").length;
  const unreadNotifications = notifications.filter((item) => !item.is_read).length;

  const primaryActions = useMemo(
    () => [
      {
        href: "/teacher/course",
        eyebrow: pick(language, "课程设计", "Design"),
        title: pick(language, "智能课程设计", "Course Design"),
        desc: pick(language, "根据课程目标、授课对象和章节内容生成课程设计建议，并继续衔接课程包生成。", "Generate course design guidance from goals, learners and chapters, then continue into lesson-pack generation."),
      },
      {
        href: "/teacher/lesson-pack",
        eyebrow: pick(language, "课程包", "Lesson Pack"),
        title: pick(language, "课程包生成", "Lesson Pack Generation"),
        desc: pick(language, "将已创建课程继续整理成课次级结构，发布后直接进入学生端的真实学习路径。", "Turn created courses into lesson-pack structures and publish them into the student learning path."),
      },
      {
        href: "/teacher/ai-config",
        eyebrow: pick(language, "边界设定", "Guardrails"),
        title: pick(language, "AI 助教配置", "AI Assistant Setup"),
        desc: pick(language, "限定课程专属 AI 助教的知识边界、语气与答疑方式，让学生端行为始终可控。", "Define knowledge bounds, tone and guidance style so the course assistant remains controllable."),
      },
      {
        href: "/teacher/material-update",
        eyebrow: pick(language, "前沿融入", "Refresh"),
        title: pick(language, "PPT / 教案更新", "PPT / Lesson Update"),
        desc: pick(language, "上传旧材料后生成更新建议，把近年的新知识与案例融入现有授课内容。", "Upload legacy material and generate updates that weave in recent knowledge and examples."),
      },
    ],
    [language],
  );

  const secondaryActions = useMemo(
    () => [
      {
        href: "/teacher/materials",
        eyebrow: pick(language, "课堂同步", "Share"),
        title: pick(language, "教学资料库", "Teaching Materials"),
        desc: pick(language, "上传、共享、直播展示课堂资料，并处理学生发来的资料请求。", "Upload, share and live-present teaching materials while handling student requests."),
      },
      {
        href: "/teacher/assignments",
        eyebrow: pick(language, "任务闭环", "Assignments"),
        title: pick(language, "作业任务管理", "Assignment Management"),
        desc: pick(language, "发布作业、查看确认状态、跟踪提交情况并快速进入辅助批改。", "Publish assignments, track confirmations and submissions, and move quickly into assisted review."),
      },
      {
        href: "/teacher/questions",
        eyebrow: pick(language, "答疑处理中", "Question Center"),
        title: pick(language, "学生提问中心", "Student Questions"),
        desc: pick(language, "把学生提交给教师的问题集中到一个处理队列中，避免信息散落。", "Collect student-to-teacher questions into a single processing queue."),
      },
      {
        href: "/teacher/feedback",
        eyebrow: pick(language, "复盘分析", "Feedback"),
        title: pick(language, "匿名问卷分析", "Feedback Analytics"),
        desc: pick(language, "查看参与率、评分和匿名文本建议，形成更像教学情报板的复盘入口。", "Review participation, ratings and anonymous comments in a teaching-intelligence style recap view."),
      },
    ],
    [language],
  );

  if (!user || user.role !== "teacher") {
    return (
      <main className="section-card rounded-[28px] p-8 text-center text-slate-500">
        {pick(language, "正在进入教师工作台...", "Opening teacher workspace...")}
      </main>
    );
  }

  return (
    <WorkspacePage tone="teacher">
      <WorkspaceHero
        tone="teacher"
        eyebrow={pick(language, "教师工作台", "Teacher Workspace")}
        title={<h2>{pick(language, "教师教学工作台", "Teacher Workspace")}</h2>}
        description={
          <p>
            {pick(
              language,
              "先处理课程、提问、作业和反馈，再进入具体模块。",
              "Handle courses, questions, assignments, and feedback first, then move into the next task.",
            )}
          </p>
        }
        actions={
          <>
            <Link href="/teacher/course-management" className="ui-pill rounded-full px-6 py-3 text-sm font-semibold">
              {pick(language, "课程与班级管理", "Course & Class Management")}
            </Link>
            <Link href="/teacher/course" className="button-primary rounded-full px-6 py-3 text-sm font-semibold">
              {pick(language, "新建课程设计", "New Course Design")}
            </Link>
            <Link href="/teacher/questions" className="ui-pill rounded-full px-6 py-3 text-sm font-semibold">
              {pick(language, "查看学生提问", "Open Questions")}
            </Link>
          </>
        }
        aside={
          <div className="workspace-stack">
            <div className="workspace-callout">
              <p className="workspace-eyebrow">{pick(language, "今日状态", "Today")}</p>
              <p className="mt-2 text-2xl font-bold text-[var(--role-edge)]">{user.display_name}</p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                {pick(
                  language,
                  "从这里进入课程设计、资料、作业和反馈。",
                  "Jump from here into course design, materials, assignments, and feedback.",
                )}
              </p>
            </div>
            <SignalStrip
              tone="teacher"
              items={[
                { label: pick(language, "待处理提问", "Pending Questions"), value: pendingQuestions, note: pick(language, "需要教师直接回复。", "Need a teacher reply.") },
                { label: pick(language, "未读提醒", "Unread Alerts"), value: unreadNotifications, note: pick(language, "来自学生提问或课堂反馈。", "From questions or feedback.") },
              ]}
            />
          </div>
        }
        footer={
          <SignalStrip
            tone="teacher"
            items={[
              { label: pick(language, "我的课程", "My Courses"), value: courses.length, note: pick(language, "当前教师名下课程数。", "Courses owned by this teacher.") },
              { label: pick(language, "作业任务", "Assignments"), value: assignments.length, note: pick(language, "已发布或进行中的任务。", "Published or active tasks.") },
              { label: pick(language, "学生提问提醒", "Question Alerts"), value: unreadNotifications, note: pick(language, "未读通知会直接汇总到左侧入口。", "Unread notifications are aggregated into the navigation.") },
              { label: pick(language, "待教师回复问题", "Awaiting Teacher"), value: pendingQuestions, note: pick(language, "优先处理这部分才能形成完整闭环。", "Handle these first to keep the loop closed.") },
            ]}
          />
        }
      />

      <div className="workspace-split">
        <WorkspaceSection
          tone="teacher"
          eyebrow={pick(language, "主流程", "Primary Flow")}
          title={pick(language, "先完成课程准备", "Start with preparation")}
          description={pick(language, "先把课程设计、课程包、AI 配置和资料更新处理完。", "Finish course design, lesson packs, AI setup, and material refresh first.")}
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {primaryActions.map((item) => (
              <ActionTile
                key={item.href}
                tone="teacher"
                href={item.href}
                eyebrow={item.eyebrow}
                title={item.title}
                description={item.desc}
                cta={pick(language, "点击进入", "Open")}
              />
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection
          tone="teacher"
          eyebrow={pick(language, "课堂运行", "Live Classroom")}
          title={pick(language, "再处理课堂运行", "Then handle delivery")}
          description={pick(language, "把资料共享、作业、提问和反馈集中在这里。", "Keep materials, assignments, questions, and feedback together here.")}
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {secondaryActions.map((item) => (
              <ActionTile
                key={item.href}
                tone="teacher"
                href={item.href}
                eyebrow={item.eyebrow}
                title={item.title}
                description={item.desc}
                cta={pick(language, "点击进入", "Open")}
              />
            ))}
          </div>
        </WorkspaceSection>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard tone="teacher" label={pick(language, "课程准备强度", "Course Prep Intensity")} value={`${Math.max(courses.length, 1)}x`} note={pick(language, "课程越多，越需要提前做统一设计。", "More courses means stronger need for coherent planning.")} />
        <MetricCard tone="teacher" label={pick(language, "作业运行状态", "Assignment Load")} value={assignments.length} note={pick(language, "作业是学生端最直接的任务压力来源。", "Assignments are the clearest source of task pressure on the student side.")} />
        <MetricCard tone="teacher" label={pick(language, "答疑压力", "Q&A Pressure")} value={pendingQuestions} note={pick(language, "未回复问题会直接影响学生体验。", "Unanswered questions directly affect the student experience.")} />
        <MetricCard tone="teacher" label={pick(language, "提醒密度", "Alert Density")} value={unreadNotifications} note={pick(language, "提醒越密集，越适合切到问题中心处理。", "Denser alerts mean it is time to switch into the question center.")} />
      </div>
    </WorkspacePage>
  );
}
