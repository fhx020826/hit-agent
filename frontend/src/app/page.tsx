"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { pick } from "@/lib/i18n";
import { ActionTile, WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";

export default function HomePage() {
  const { user, loading } = useAuth();
  const { language } = useLanguage();

  const targetHref = user?.role === "teacher" ? "/teacher" : user?.role === "admin" ? "/admin/users" : "/student";
  const teacherHighlights = useMemo(() => ([
    pick(language, "课程设计", "Course design"),
    pick(language, "资料更新", "Material updates"),
    pick(language, "AI 助教配置", "AI setup"),
    pick(language, "作业管理", "Assignments"),
    pick(language, "反馈分析", "Feedback review"),
  ]), [language]);
  const studentHighlights = useMemo(() => ([
    pick(language, "课程问答", "Course Q&A"),
    pick(language, "双通道提问", "AI + teacher route"),
    pick(language, "多模态提问", "Multimodal uploads"),
    pick(language, "作业提交", "Assignment submission"),
    pick(language, "学习反馈", "Learning feedback"),
  ]), [language]);

  return (
    <WorkspacePage className="home-page">
      <WorkspaceHero
        className="home-poster"
        eyebrow={pick(language, "教师主导 · 学生使用 · AI 提效", "Teacher-led · Student-facing · AI-assisted")}
        title={
          <h2>
            {pick(language, "把教学设计、", "Bring course planning,")}
            <br />
            {pick(language, "课堂互动、作业闭环与教学反馈", "classroom interaction, assignment loops,")}
            <br />
            {pick(language, "放进同一个智能平台", "and teaching feedback into one workspace")}
          </h2>
        }
        description={
          <p>
            {pick(
              language,
              "教师在这里安排课程、更新资料、跟进作业与反馈；学生在这里提问、提交任务和查看学习建议。",
              "Teachers plan courses, update materials, and track assignments here. Students ask questions, submit work, and review learning guidance here.",
            )}
          </p>
        }
        actions={
          <>
            <Link
              href={loading ? "/" : targetHref}
              data-home-action="primary"
              className="home-hero-action rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {loading
                ? pick(language, "正在识别身份...", "Checking role...")
                : user
                  ? pick(language, "进入我的工作台", "Open Workspace")
                  : pick(language, "登录后进入工作台", "Sign in to Continue")}
            </Link>
            <Link href="/settings" data-home-action="secondary" className="home-hero-action ui-pill rounded-full px-6 py-3 text-sm font-semibold">
              {pick(language, "查看设置中心", "Open Settings")}
            </Link>
          </>
        }
        aside={
          <div className="grid gap-4">
            <article className="home-role-card" data-role="teacher" data-home-block="teacher-card">
              <p className="workspace-eyebrow">{pick(language, "教师端", "Teacher")}</p>
              <div className="home-role-title">{pick(language, "教学指挥台", "Teaching Desk")}</div>
              <p className="home-role-note">{pick(language, "集中处理课程、资料、作业和反馈。", "Handle courses, materials, assignments, and feedback in one place.")}</p>
              <ul className="home-highlight-list">
                {teacherHighlights.map((item) => (
                  <li key={item} className="home-highlight-item">{item}</li>
                ))}
              </ul>
            </article>

            <article className="home-role-card" data-role="student" data-home-block="student-card">
              <p className="workspace-eyebrow">{pick(language, "学生端", "Student")}</p>
              <div className="home-role-title">{pick(language, "学习工作区", "Study Desk")}</div>
              <p className="home-role-note">{pick(language, "围绕当前课程完成提问、任务和反馈。", "Ask, submit, and review feedback around the current course.")}</p>
              <ul className="home-highlight-list">
                {studentHighlights.map((item) => (
                  <li key={item} className="home-highlight-item">{item}</li>
                ))}
              </ul>
            </article>
          </div>
        }
      />

      <div className="workspace-split">
        <WorkspaceSection
          className="home-support-section"
          title={pick(language, "登录后直接进入对应工作台", "Sign in and go straight to the right workspace")}
          description={pick(language, "登录后系统会按身份打开对应模块。", "After login, the platform opens the right module for your role.")}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ActionTile
              className="home-support-tile"
              href={user ? targetHref : "/"}
              eyebrow={<span data-home-block="role-entry-eyebrow">{pick(language, "角色入口", "Role entry")}</span>}
              title={pick(language, "角色工作台", "Workspace")}
              description={pick(language, "按身份进入教师、学生或管理员模块。", "Open the teacher, student, or admin module by role.")}
              cta={pick(language, "查看入口", "Open")}
            />
            <ActionTile
              className="home-support-tile"
              href="/settings"
              eyebrow={<span data-home-block="settings-entry-eyebrow">{pick(language, "统一设置", "Settings")}</span>}
              title={pick(language, "设置中心", "Settings Center")}
              description={pick(language, "管理资料、主题、语言与账号安全。", "Manage profile, theme, language, and account security.")}
              cta={pick(language, "前往设置", "Settings")}
            />
          </div>
        </WorkspaceSection>

        <WorkspaceSection
          className="home-support-section"
          title={pick(language, "教师与学生都围绕完整教学闭环协同", "Teachers and students work in one learning loop")}
          description={pick(language, "每个入口都只保留当前最常用的功能。", "Each entry focuses on the most-used task for that area.")}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ActionTile
              className="home-support-tile"
              href={user ? targetHref : "/"}
              eyebrow={<span data-home-block="workspace-entry-eyebrow">{pick(language, "流程入口", "Flow entry")}</span>}
              title={pick(language, "登录后进入角色工作台", "Open the role workspace")}
              description={pick(language, "进入当前身份对应的任务入口。", "Jump into the task area for the current role.")}
              cta={pick(language, "进入", "Enter")}
            />
            <ActionTile
              className="home-support-tile"
              href="/settings"
              eyebrow={<span data-home-block="profile-entry-eyebrow">{pick(language, "账号与外观", "Account and theme")}</span>}
              title={pick(language, "个人资料、外观与账号安全", "Profile, theme, and account")}
              description={pick(language, "查看并调整账号相关配置。", "Review and adjust account-related settings.")}
              cta={pick(language, "查看", "View")}
            />
          </div>
        </WorkspaceSection>
      </div>
    </WorkspacePage>
  );
}
