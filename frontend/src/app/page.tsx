"use client";

import Link from "next/link";

import { useAuth } from "@/components/auth-provider";
import { ActionTile, WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";

const teacherHighlights = [
  "智能课程设计助手",
  "前沿内容融入与 PPT / 教案更新",
  "课程专属 AI 助教配置",
  "作业任务发布、催交与辅助批改",
  "学生提问反馈中心与匿名问卷分析",
];

const studentHighlights = [
  "课程专属 AI 助教与多轮连续问答",
  "AI / 教师 / 双通道提问",
  "图片、文档、压缩包等多模态提问",
  "作业任务确认、提交与初步反馈",
  "匿名课堂反馈与学习薄弱点分析",
];

export default function HomePage() {
  const { user, loading } = useAuth();

  const targetHref = user?.role === "teacher" ? "/teacher" : user?.role === "admin" ? "/admin/users" : "/student";

  return (
    <WorkspacePage className="home-page">
      <WorkspaceHero
        className="home-poster"
        eyebrow="教师为核心 · 学生为辅助 · AI 提效不替代教师"
        title={
          <h2>
            把教学设计、
            <br />
            课堂互动、作业闭环与教学反馈
            <br />
            放进同一个智能平台
          </h2>
        }
        description={
          <p>
            平台面向前沿学科教学场景，围绕“设计 - 实施 - 反馈 - 优化”形成闭环。教师可完成课程设计、前沿内容融入、PPT / 教案更新、作业管理、问题回复和教学分析；学生在教师配置范围内使用课程专属 AI 助教、提交作业、填写匿名反馈并查看学习建议。
          </p>
        }
        actions={
          <>
            <Link
              href={loading ? "/" : targetHref}
              data-home-action="primary"
              className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {loading ? "正在识别身份..." : user ? "进入我的工作台" : "登录后按身份进入平台"}
            </Link>
            <Link href="/settings" data-home-action="secondary" className="ui-pill rounded-full px-6 py-3 text-sm font-semibold">
              查看设置中心
            </Link>
          </>
        }
        aside={
          <div className="grid gap-4">
            <article className="home-role-card" data-role="teacher" data-home-block="teacher-card">
              <p className="workspace-eyebrow">教师端核心价值</p>
              <div className="home-role-title">教学指挥台</div>
              <p className="home-role-note">围绕课程设计、资料更新、课堂协同和作业反馈组织完整教学闭环。</p>
              <ul className="home-highlight-list">
                {teacherHighlights.map((item) => (
                  <li key={item} className="home-highlight-item">{item}</li>
                ))}
              </ul>
            </article>

            <article className="home-role-card" data-role="student" data-home-block="student-card">
              <p className="workspace-eyebrow">学生端核心体验</p>
              <div className="home-role-title">学习工作区</div>
              <p className="home-role-note">把当前课程、当前任务和当前反馈压缩成一条自然的学习路径。</p>
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
          title="登录后直接进入对应工作台"
          description="统一登录或注册后，教师、学生和管理员都会自动进入各自的工作区，不需要再手动寻找功能入口。"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ActionTile
              className="home-support-tile"
              href={user ? targetHref : "/"}
              eyebrow={<span data-home-block="role-entry-eyebrow">角色入口</span>}
              title="角色工作台"
              description="课程设计、问答互动、作业管理、资料共享和教学反馈都会按身份集中到工作台中。"
              cta="查看入口"
            />
            <ActionTile
              className="home-support-tile"
              href="/settings"
              eyebrow={<span data-home-block="settings-entry-eyebrow">统一设置</span>}
              title="设置中心"
              description="个人资料、外观模式、语言与账号安全都可以在同一个设置中心内完成管理。"
              cta="前往设置"
            />
          </div>
        </WorkspaceSection>

        <WorkspaceSection
          className="home-support-section"
          title="教师与学生都围绕完整教学闭环协同"
          description="教师负责课程设计、资料更新、作业与反馈分析，学生则围绕问答、作业、资料和匿名反馈完成学习流程。"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ActionTile
              className="home-support-tile"
              href={user ? targetHref : "/"}
              eyebrow={<span data-home-block="workspace-entry-eyebrow">流程入口</span>}
              title="登录后进入角色工作台"
              description="教师看到教学闭环工作台，学生看到学习任务工作台，管理员进入运营控制台。"
              cta="进入"
            />
            <ActionTile
              className="home-support-tile"
              href="/settings"
              eyebrow={<span data-home-block="profile-entry-eyebrow">账号与外观</span>}
              title="个人资料、外观与账号安全"
              description="所有账号相关配置都集中在统一设置中心，不再分散在首页模块里。"
              cta="查看"
            />
          </div>
        </WorkspaceSection>
      </div>
    </WorkspacePage>
  );
}
