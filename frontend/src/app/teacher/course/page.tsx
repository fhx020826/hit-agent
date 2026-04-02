"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

export default function CourseCreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", audience: "", student_level: "", chapter: "",
    objectives: "", duration_minutes: 90, frontier_direction: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const course = await api.createCourse(form);
      router.push(`/teacher/lesson-pack?course_id=${course.id}`);
    } catch (err) {
      alert("创建失败: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">创建课程画像</h1>
          <Link href="/teacher" className="text-sm text-gray-500 hover:text-gray-700">返回工作台</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto p-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">课程名称 *</label>
            <input type="text" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="例：计算机网络" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">授课对象</label>
              <input type="text" value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="例：大三本科生" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学生水平</label>
              <input type="text" value={form.student_level}
                onChange={(e) => setForm({ ...form, student_level: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="例：中等偏上" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">当前章节</label>
              <input type="text" value={form.chapter}
                onChange={(e) => setForm({ ...form, chapter: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="例：第五章 传输层协议" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">课时时长(分钟)</label>
              <input type="number" value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 90 })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">课程目标</label>
            <textarea value={form.objectives}
              onChange={(e) => setForm({ ...form, objectives: e.target.value })} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="例：理解 TCP/UDP 区别，掌握 TCP 拥塞控制机制" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">拟引入的前沿方向 *</label>
            <input type="text" required value={form.frontier_direction}
              onChange={(e) => setForm({ ...form, frontier_direction: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="例：QUIC 协议与 HTTP/3" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Link href="/teacher" className="px-5 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">取消</Link>
            <button type="submit" disabled={loading}
              className="px-5 py-2.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? "创建中..." : "创建并生成课时包"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
