"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

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

  const targetHref = user?.role === "teacher" ? "/teacher" : "/student";

  return (
    <main className="space-y-5">
      <section className="glass-panel overflow-hidden rounded-[32px] px-6 py-8 md:px-10 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold tracking-[0.28em] text-slate-500">教师为核心 · 学生为辅助 · AI 提效不替代教师</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">把教学设计、课堂互动、作业闭环与教学反馈放进同一个智能平台</h2>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
              平台面向前沿学科教学场景，围绕“设计 - 实施 - 反馈 - 优化”形成闭环。教师可完成课程设计、前沿内容融入、PPT / 教案更新、作业管理、问题回复和教学分析；学生在教师配置范围内使用课程专属 AI 助教、提交作业、填写匿名反馈并查看学习建议。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={loading ? "/" : targetHref} className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90">
                {loading ? "正在识别身份..." : user ? "进入我的工作台" : "登录后按身份进入平台"}
              </Link>
              <Link href="/settings" className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white/70">查看设置中心</Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            <div className="section-card rounded-[28px] p-6">
              <p className="text-sm font-semibold text-amber-700">教师端核心价值</p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                {teacherHighlights.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="section-card rounded-[28px] p-6">
              <p className="text-sm font-semibold text-teal-700">学生端核心体验</p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                {studentHighlights.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <article className="section-card rounded-[28px] p-6">
          <p className="text-sm font-semibold text-slate-500">统一账号入口</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">右上角统一登录 / 注册</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">不再保留教师、学生分散注册主页。点击右上角入口后先选角色，再进入对应登录或注册流程。登录成功后系统按身份自动展示教师或学生视图。</p>
        </article>
        <article className="section-card rounded-[28px] p-6">
          <p className="text-sm font-semibold text-slate-500">设置入口收纳</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">设置中心统一放在右上角</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">个人资料、外观设置、账号相关操作统一收纳在右上角，不占首页核心模块。教师端和学生端都支持白天、夜间、护眼模式，以及主色、字体、皮肤切换。</p>
        </article>
        <article className="section-card rounded-[28px] p-6">
          <p className="text-sm font-semibold text-slate-500">真实模型接入</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">支持选择实际大模型</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">课程问答默认走平台配置模型，同时支持返回豆包、千问等 OpenAI 兼容接入的模型清单。学生可按问题场景切换文本模型或视觉模型。</p>
        </article>
      </section>
    </main>
  );
}
