"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, type AnalyticsReport } from "@/lib/api";

export default function ReviewPage() {
  return <Suspense fallback={<div className="p-8 text-center text-gray-500">加载中...</div>}><ReviewContent /></Suspense>;
}

function ReviewContent() {
  const searchParams = useSearchParams();
  const lpId = searchParams.get("lp_id") || "demo-lp-001";
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics(lpId).then(setReport).catch(() => {}).finally(() => setLoading(false));
  }, [lpId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">教师复盘</h1>
          <Link href="/teacher" className="text-sm text-gray-500 hover:text-gray-700">返回工作台</Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        {loading && <p className="text-center text-gray-500 py-12">加载中...</p>}
        {!loading && !report && <p className="text-center text-gray-400 py-12">暂无复盘数据</p>}
        {report && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">问答概览</h2>
              <p className="text-3xl font-bold text-blue-600">{report.total_questions} <span className="text-sm font-normal text-gray-500">个学生提问</span></p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card title="高频问题" items={report.high_freq_topics} color="blue" />
              <Card title="易混淆概念" items={report.confused_concepts} color="orange" />
              <Card title="知识盲区" items={report.knowledge_gaps} color="red" />
              <Card title="教学建议" items={report.teaching_suggestions} color="green" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Card({ title, items, color }: { title: string; items: string[]; color: string }) {
  const colors: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50",
    orange: "border-orange-200 bg-orange-50",
    red: "border-red-200 bg-red-50",
    green: "border-green-200 bg-green-50",
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color] || ""}`}>
      <h3 className="font-semibold text-gray-800 mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">暂无数据</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">{i + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
