"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, type AnalyticsReport } from "@/lib/api";

export default function ReviewPage() {
  return <Suspense fallback={<div className="px-6 py-24 text-center text-slate-500">正在加载复盘页...</div>}><ReviewContent /></Suspense>;
}

function ReviewContent() {
  const searchParams = useSearchParams();
  const lpId = searchParams.get("lp_id") || "demo-lp-001";
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const result = await api.getAnalytics(lpId);
      setReport(result);
      setError(null);
    } catch (e) {
      setError(`加载复盘数据失败：${e instanceof Error ? e.message : "网络错误"}`);
    } finally {
      setLoading(false);
    }
  }, [lpId]);

  useEffect(() => {
    let active = true;
    api.getAnalytics(lpId)
      .then((result) => {
        if (!active) return;
        setReport(result);
        setError(null);
      })
      .catch((e) => {
        if (!active) return;
        setError(`加载复盘数据失败：${e instanceof Error ? e.message : "网络错误"}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lpId]);

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="glass-panel mx-auto max-w-6xl rounded-[32px] px-8 py-8 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-8">
          <div>
            <p className="text-sm font-semibold text-slate-400">教学复盘分析</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-900 md:text-4xl">教师复盘</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">系统会在学生提问后同步统计问答数据。实名提问会显示学生信息，匿名提问只显示匿名学生。</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => loadReport()} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">刷新复盘</button>
            <Link href="/teacher" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">返回教师工作台</Link>
          </div>
        </div>

        {loading && <div className="py-20 text-center text-slate-500">正在生成复盘视图...</div>}
        {error && <div className="mt-8 rounded-[24px] border border-rose-200 bg-rose-50 px-6 py-8 text-center text-rose-700">{error}</div>}

        {report && (
          <div className="mt-8 space-y-6">
            <div className="grid gap-5 md:grid-cols-4">
              <MetricCard label="学生提问总数" value={String(report.total_questions)} tone="amber" />
              <MetricCard label="实名提问数" value={String(report.identified_questions)} tone="teal" />
              <MetricCard label="匿名提问数" value={String(report.anonymous_questions)} tone="slate" />
              <MetricCard label="教学建议数" value={String(report.teaching_suggestions.length)} tone="blue" />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <ReviewCard title="高频问题" items={report.high_freq_topics} />
              <ReviewCard title="易混淆概念" items={report.confused_concepts} />
              <ReviewCard title="知识盲区" items={report.knowledge_gaps} />
              <ReviewCard title="教学建议" items={report.teaching_suggestions} />
            </div>

            <section className="section-card rounded-[24px] p-6">
              <h2 className="text-xl font-bold text-slate-900">最近提问记录</h2>
              <div className="mt-4 space-y-3">
                {report.recent_questions.length === 0 ? <p className="text-sm text-slate-500">暂无提问记录</p> : report.recent_questions.map((item, index) => (
                  <div key={`${item.created_at}-${index}`} className="rounded-2xl bg-white/85 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{item.student_display_name}</p>
                      <p className="text-xs text-slate-400">{item.created_at}</p>
                    </div>
                    {!item.anonymous && <p className="mt-1 text-sm text-slate-500">{item.student_grade || "未填年级"} · {item.student_major || "未填专业"}</p>}
                    <p className="mt-3 text-sm leading-7 text-slate-700">{item.question}</p>
                    <p className={`mt-2 text-xs font-semibold ${item.in_scope ? "text-teal-700" : "text-amber-700"}`}>{item.in_scope ? "课程范围内提问" : "超出课程范围提问"}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "amber" | "teal" | "slate" | "blue" }) {
  const toneMap = {
    amber: "from-amber-100 to-white",
    teal: "from-teal-100 to-white",
    slate: "from-slate-200 to-white",
    blue: "from-sky-100 to-white",
  };
  return <div className={`section-card rounded-[24px] bg-gradient-to-br ${toneMap[tone]} p-6`}><p className="text-sm font-semibold">{label}</p><p className="mt-3 text-4xl font-extrabold text-slate-900">{value}</p></div>;
}

function ReviewCard({ title, items }: { title: string; items: string[] }) {
  return <section className="section-card rounded-[24px] p-6"><h2 className="text-xl font-bold text-slate-900">{title}</h2>{items.length === 0 ? <p className="mt-4 text-sm text-slate-500">暂无数据</p> : <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">{items.map((item, index) => <li key={index} className="rounded-2xl bg-white/85 px-4 py-3">{index + 1}. {item}</li>)}</ul>}</section>;
}
