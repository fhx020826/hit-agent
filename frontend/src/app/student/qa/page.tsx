"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, type QAResponse } from "@/lib/api";

interface PackInfo {
  id: string;
  frontier_topic: Record<string, unknown>;
  teaching_objectives: string[];
  main_thread: string;
}

export default function StudentQAPage() {
  return <Suspense fallback={<div className="p-8 text-center text-gray-500">加载中...</div>}><StudentQAContent /></Suspense>;
}

function StudentQAContent() {
  const searchParams = useSearchParams();
  const lpId = searchParams.get("lp_id") || "";
  const [packInfo, setPackInfo] = useState<PackInfo | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ q: string; a: QAResponse }[]>([]);

  useEffect(() => {
    if (!lpId) return;
    api.getStudentLessonPack(lpId).then(setPackInfo).catch(() => {});
  }, [lpId]);

  const handleAsk = async () => {
    if (!question.trim() || !lpId) return;
    const q = question.trim();
    setQuestion("");
    setLoading(true);
    try {
      const resp = await api.studentQA(lpId, q);
      setHistory((prev) => [...prev, { q, a: resp }]);
    } catch {
      setHistory((prev) => [...prev, { q, a: { answer: "抱歉，请求失败，请重试", evidence: [], in_scope: false } }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">课时问答</h1>
          <Link href="/student" className="text-sm text-gray-500 hover:text-gray-700">返回选择</Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col">
        {packInfo && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h2 className="font-semibold text-gray-900">{(packInfo.frontier_topic?.name as string) || "课时包"}</h2>
            <p className="text-sm text-gray-600 mt-1">{packInfo.main_thread}</p>
          </div>
        )}

        {/* 问答历史 */}
        <div className="flex-1 space-y-4 mb-4 overflow-y-auto">
          {history.map((item, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-end">
                <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-[80%] text-sm">{item.q}</div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 max-w-[80%] text-sm">
                  {!item.a.in_scope && (
                    <p className="text-xs text-orange-500 mb-1">此问题超出课时范围</p>
                  )}
                  <p className="text-gray-800">{item.a.answer}</p>
                  {item.a.evidence.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">依据: {item.a.evidence.join("; ")}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && <p className="text-center text-gray-400 text-sm">思考中...</p>}
        </div>

        {/* 输入框 */}
        <div className="flex gap-3">
          <input
            type="text" value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="输入你的问题..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={handleAsk} disabled={loading || !question.trim()}
            className="px-5 py-2.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            提问
          </button>
        </div>
      </main>
    </div>
  );
}
