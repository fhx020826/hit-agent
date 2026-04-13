"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { ActionTile, MetricCard, SignalStrip, WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
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

  const pendingAssignments = assignments.filter((item) => !item.submission).length;

  const cards = useMemo(
    () => [
      {
        href: "/student/qa",
        eyebrow: pick(language, "当前提问", "Ask Now"),
        title: pick(language, "课程专属 AI 助教", "Course AI Assistant"),
        desc: pick(language, "支持 AI / 教师 / 双通道提问，多轮连续追问，图片和文档辅助提问。", "Supports AI, teacher or dual-channel questions, multi-turn follow-ups, and image or document-assisted prompts."),
      },
      {
        href: "/student/materials",
        eyebrow: pick(language, "课堂资料", "Materials"),
        title: pick(language, "课堂共享资料", "Shared Classroom Materials"),
        desc: pick(language, "查看教师课上共享的 PPT、讲义、图片、视频资料，也可以主动请求教师上传。", "View shared PPTs, notes, images and videos, or request more materials from the teacher."),
      },
      {
        href: "/student/assignments",
        eyebrow: pick(language, "当前任务", "Assignments"),
        title: pick(language, "作业任务中心", "Assignment Center"),
        desc: pick(language, "查看任务、确认收到、上传作业并查看 AI 初步反馈。", "Review assignments, confirm receipt, upload work and check preliminary AI feedback."),
      },
      {
        href: "/student/feedback",
        eyebrow: pick(language, "课后反馈", "Feedback"),
        title: pick(language, "匿名课堂反馈", "Anonymous Feedback"),
        desc: pick(language, "课后自愿填写匿名问卷，可稍后忽略，不反复强制打扰。", "Fill out anonymous post-class feedback voluntarily, or skip it without repeated interruption."),
      },
      {
        href: "/student/questions",
        eyebrow: pick(language, "归档记录", "History"),
        title: pick(language, "学习问答记录", "Q&A History"),
        desc: pick(language, "查看历史提问、AI 回答、教师补充回复和收藏内容。", "Review past questions, AI answers, teacher follow-ups and saved items."),
      },
      {
        href: "/student/discussions",
        eyebrow: pick(language, "协作空间", "Discussions"),
        title: pick(language, "课程讨论空间", "Course Discussion Spaces"),
        desc: pick(language, "进入课程班级讨论空间，和同学、教师、AI 助教一起围绕课程内容交流。", "Join class discussion spaces and learn together with classmates, teachers and the AI assistant."),
      },
      {
        href: "/student/weakness",
        eyebrow: pick(language, "学习诊断", "Insights"),
        title: pick(language, "薄弱点分析", "Weakness Analysis"),
        desc: pick(language, "根据连续提问记录，生成温和的学习诊断和复习建议。", "Generate gentle learning diagnostics and review suggestions from your question history."),
      },
    ],
    [language],
  );

  if (!user || user.role !== "student") {
    return (
      <main className="section-card rounded-[28px] p-8 text-center text-slate-500">
        {pick(language, "正在进入学生学习台...", "Opening student workspace...")}
      </main>
    );
  }

  return (
    <WorkspacePage tone="student">
      <WorkspaceHero
        tone="student"
        eyebrow={pick(language, "学生学习台", "Student Workspace")}
        title={<h2>围绕课程学习、作业提交与课后反馈的一站式入口</h2>}
        description={
          <p>
            {pick(
              language,
              "这里不再只是“功能列表”，而是把当前课程、当前任务、当前资料和当前反馈压缩进一个更像学习工作区的界面。匿名发言依然只隐藏展示身份，不脱离本人账号。",
              "This is no longer a loose list of features. It compresses current courses, current tasks, current materials and current feedback into a clearer learning workspace. Anonymous posting still hides display identity only, not account ownership.",
            )}
          </p>
        }
        actions={
          <>
            <Link href="/student/qa" className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white">
              {pick(language, "开始提问", "Ask a Question")}
            </Link>
            <Link href="/student/assignments" className="ui-pill rounded-full px-6 py-3 text-sm font-semibold">
              {pick(language, "查看作业", "View Assignments")}
            </Link>
          </>
        }
        aside={
          <div className="workspace-stack">
            <div className="workspace-callout">
              <p className="workspace-eyebrow">{pick(language, "当前学习状态", "Current State")}</p>
              <p className="mt-2 text-2xl font-bold text-[var(--role-edge)]">{user.display_name}</p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                {pick(
                  language,
                  "如果你现在只想知道“下一步做什么”，优先看待完成作业、待填写反馈和最近共享资料，再决定是否继续提问或进入讨论。",
                  "If you only want to know what to do next, focus first on pending assignments, pending feedback and recent shared materials, then decide whether to continue asking or join the discussion space.",
                )}
              </p>
            </div>
            <SignalStrip
              tone="student"
              items={[
                { label: pick(language, "待完成作业", "Pending Assignments"), value: pendingAssignments, note: pick(language, "优先处理最直接的学习任务。", "Handle your clearest learning task first.") },
                { label: pick(language, "待填写反馈", "Pending Feedback"), value: pendingSurveys.length, note: pick(language, "反馈不会反复强制打扰，但值得尽快完成。", "Feedback is voluntary, but worth finishing early.") },
              ]}
            />
          </div>
        }
        footer={
          <SignalStrip
            tone="student"
            items={[
              { label: pick(language, "已开放课程", "Available Courses"), value: courses.length, note: pick(language, "当前可进入的课程数量。", "Courses currently available to you.") },
              { label: pick(language, "进行中作业", "Active Assignments"), value: assignments.length, note: pick(language, "包括已确认和待提交任务。", "Includes confirmed and pending submission tasks.") },
              { label: pick(language, "匿名反馈提醒", "Feedback Alerts"), value: pendingSurveys.length, note: pick(language, "问卷由教师触发，但不向教师暴露个人身份。", "Surveys are teacher-triggered but remain anonymous.") },
            ]}
          />
        }
      />

      <div className="workspace-split">
        <WorkspaceSection
          tone="student"
          eyebrow={pick(language, "优先入口", "Priority Access")}
          title={pick(language, "先进入“问答 - 资料 - 作业 - 反馈”主链路", "Start with Q&A, materials, assignments and feedback")}
          description={pick(language, "这四个区域组成学生端最核心的连续学习路径，优先级高于其他信息归档型页面。", "These four areas form the student-side primary learning path and take priority over archival pages.")}
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {cards.slice(0, 4).map((card) => (
              <ActionTile
                key={card.href}
                tone="student"
                href={card.href}
                eyebrow={card.eyebrow}
                title={card.title}
                description={card.desc}
                cta={pick(language, "点击进入", "Open")}
              />
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection
          tone="student"
          eyebrow={pick(language, "学习档案", "Learning Archive")}
          title={pick(language, "再进入“记录 - 讨论 - 薄弱点”整理区", "Then move into history, discussions and weakness insights")}
          description={pick(language, "当主学习任务完成后，再查看历史问答、课程讨论与薄弱点诊断，学习节奏会更清晰。", "Once the main task is handled, move into history, discussions and weakness insights for a clearer rhythm.")}
        >
          <div className="grid gap-4">
            {cards.slice(4).map((card) => (
              <ActionTile
                key={card.href}
                tone="student"
                href={card.href}
                eyebrow={card.eyebrow}
                title={card.title}
                description={card.desc}
                cta={pick(language, "点击进入", "Open")}
              />
            ))}
          </div>
        </WorkspaceSection>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard tone="student" label={pick(language, "课程数量", "Course Count")} value={courses.length} note={pick(language, "学习入口按课程组织。", "The learning flow is organized by course.")} />
        <MetricCard tone="student" label={pick(language, "待办作业", "To-do Assignments")} value={pendingAssignments} note={pick(language, "最直接的任务压力来源。", "The clearest source of task pressure.")} />
        <MetricCard tone="student" label={pick(language, "反馈提醒", "Feedback Reminders")} value={pendingSurveys.length} note={pick(language, "课后匿名反馈默认保持低打扰。", "Anonymous feedback stays intentionally low-pressure.")} />
        <MetricCard tone="student" label={pick(language, "学习节奏", "Learning Rhythm")} value={pick(language, "连续", "Continuous")} note={pick(language, "从提问到作业再到反馈形成自然闭环。", "Questions, assignments and feedback form a continuous loop.")} />
      </div>
    </WorkspacePage>
  );
}
