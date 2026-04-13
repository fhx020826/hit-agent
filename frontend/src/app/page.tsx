"use client";

import Link from "next/link";

import { useAuth } from "@/components/auth-provider";
import { ActionTile, SignalStrip, WorkspaceSection } from "@/components/workspace-panels";
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
    <WorkspacePage>
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
            <Link href={loading ? "/" : targetHref} className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90">
              {loading ? "正在识别身份..." : user ? "进入我的工作台" : "登录后按身份进入平台"}
            </Link>
            <Link href="/settings" className="ui-pill rounded-full px-6 py-3 text-sm font-semibold">
              查看设置中心
            </Link>
          </>
        }
        aside={
          <div className="grid gap-4">
            <article className="home-role-card" data-role="teacher">
              <p className="workspace-eyebrow">教师端核心价值</p>
              <div className="home-role-title">教学指挥台</div>
              <p className="home-role-note">围绕课程设计、资料更新、课堂协同和作业反馈组织完整教学闭环。</p>
              <ul className="home-highlight-list">
                {teacherHighlights.map((item) => (
                  <li key={item} className="home-highlight-item">{item}</li>
                ))}
              </ul>
            </article>

            <article className="home-role-card" data-role="student">
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
        footer={
          <SignalStrip
            items={[
              { label: "统一账号入口", value: "同一入口", note: "右上角统一登录 / 注册，登录后按身份自动进入工作台。" },
              { label: "设置入口收纳", value: "同一控制面板", note: "个人资料、外观设置与账号安全统一放在右上角与设置中心。" },
              { label: "真实模型接入", value: "兼容 OpenAI 模型清单", note: "课程问答支持实际大模型接入，并按文本 / 视觉场景切换。" },
            ]}
          />
        }
      />

      <div className="workspace-split">
        <WorkspaceSection
          eyebrow="产品入口"
          title="首屏先回答“这是什么”和“我现在应该去哪”"
          description="首页不再堆叠功能说明卡片，而是直接把角色价值、登录入口和进入工作台的主动作放在第一屏。登录后无需再做角色跳转判断。"
        >
          <div className="workspace-callout soft-grid">
            <strong>当前设计目标：</strong>
            首页像一张教学产品海报，而不是一份功能说明书。真正高频的功能入口全部留给登录后的角色工作台处理。
          </div>
        </WorkspaceSection>

        <WorkspaceSection
          eyebrow="功能结构"
          title="真实能力仍然全部保留"
          description="本轮仅重写表现层与导航逻辑，既不删除任何已实现功能，也不改动任何后端接口与角色权限。"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ActionTile
              href={user ? targetHref : "/"}
              eyebrow="角色工作台"
              title="登录后进入角色工作台"
              description="教师看到教学闭环工作台，学生看到学习任务工作台，管理员进入运营控制台。"
              cta="进入"
            />
            <ActionTile
              href="/settings"
              eyebrow="统一设置"
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
