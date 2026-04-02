"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface PublishedPack {
  id: string;
  course_id: string;
  frontier_topic: Record<string, unknown>;
}

export default function StudentPage() {
  const [packs, setPacks] = useState<PublishedPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPacks = () => {
    setLoading(true);
    api.listPublishedPacks()
      .then((p) => { setPacks(p); setError(null); })
      .catch(() => setError("加载课时包失败，请刷新重试"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPacks(); }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">学生端 - 课时问答</h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">返回首页</Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">选择课时包</h2>
        {loading && <p className="text-center text-gray-500">加载中...</p>}
        {error && (
          <div className="text-center py-8">
            <p className="text-red-500 mb-3">{error}</p>
            <button onClick={loadPacks} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">重试</button>
          </div>
        )}
        {!loading && !error && packs.length === 0 && <p className="text-center text-gray-400">暂无可用的课时包</p>}
        <div className="grid gap-4">
          {packs.map((p) => (
            <Link key={p.id} href={`/student/qa?lp_id=${p.id}`}
              className="block bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-gray-900">{(p.frontier_topic?.name as string) || "课时包"}</h3>
              <p className="text-sm text-gray-500 mt-1">点击进入问答</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
