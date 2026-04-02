"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, type Course, type LessonPack } from "@/lib/api";

export default function TeacherDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [packs, setPacks] = useState<LessonPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadCourseId, setUploadCourseId] = useState<string>("");

  const loadData = () => {
    Promise.all([api.listCourses(), api.listLessonPacks()])
      .then(([c, p]) => { setCourses(c); setPacks(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleUpload = (courseId: string) => {
    setUploadCourseId(courseId);
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadCourseId) return;
    setUploading(uploadCourseId);
    try {
      await api.uploadMaterial(uploadCourseId, file);
      alert("上传成功: " + file.name);
    } catch (err) {
      alert("上传失败: " + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setUploading(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">加载中...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">教师工作台</h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">返回首页</Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6 space-y-8">
        <input type="file" ref={fileInputRef} className="hidden" onChange={onFileChange}
          accept=".txt,.md,.pdf,.doc,.docx" />

        <div className="flex gap-4">
          <Link href="/teacher/course" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            + 创建课程画像
          </Link>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">我的课程</h2>
          {courses.length === 0 ? (
            <p className="text-gray-400">暂无课程，请先创建课程画像</p>
          ) : (
            <div className="grid gap-4">
              {courses.map((c) => (
                <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{c.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{c.audience} | {c.chapter} | 前沿方向: {c.frontier_direction}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleUpload(c.id)} disabled={uploading === c.id}
                        className="px-4 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50">
                        {uploading === c.id ? "上传中..." : "上传资料"}
                      </button>
                      <Link href={`/teacher/lesson-pack?course_id=${c.id}`}
                        className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">
                        生成课时包
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">课时包</h2>
          {packs.length === 0 ? (
            <p className="text-gray-400">暂无课时包</p>
          ) : (
            <div className="grid gap-4">
              {packs.map((p) => {
                const ft = p.payload?.frontier_topic as Record<string, string> | undefined;
                return (
                  <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{ft?.name || "课时包"} (v{p.version})</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          状态:{" "}
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${p.status === "published" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {p.status === "published" ? "已发布" : "草稿"}
                          </span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/teacher/lesson-pack/${p.id}`} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">查看</Link>
                        <Link href={`/teacher/review?lp_id=${p.id}`} className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700">复盘</Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
