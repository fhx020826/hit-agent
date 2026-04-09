"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { api, type ClassroomShare, type Course, type LiveShareRecord, type MaterialItem, type MaterialRequestItem } from "@/lib/api";

export default function TeacherMaterialsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [shares, setShares] = useState<ClassroomShare[]>([]);
  const [requests, setRequests] = useState<MaterialRequestItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [shareForm, setShareForm] = useState({ title: "课堂资料共享", description: "教师正在共享本节课相关资料，请同学们结合课堂讲解查看。" });
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [liveShare, setLiveShare] = useState<LiveShareRecord | null>(null);

  const load = async (courseId?: string) => {
    const courseList = await api.listCourses().catch(() => []);
    setCourses(courseList);
    const nextCourseId = courseId || selectedCourseId || courseList[0]?.id || "";
    setSelectedCourseId(nextCourseId);
    if (nextCourseId) {
      const [materialList, shareList, requestList, currentLive] = await Promise.all([
        api.listMaterials(nextCourseId).catch(() => []),
        api.listTeacherShares(nextCourseId).catch(() => []),
        api.listMaterialRequests(nextCourseId).catch(() => []),
        api.getCurrentLiveShare(nextCourseId).catch(() => null),
      ]);
      setMaterials(materialList);
      setShares(shareList);
      setRequests(requestList);
      setLiveShare(currentLive);
    } else {
      setMaterials([]);
      setShares([]);
      setRequests([]);
      setLiveShare(null);
    }
  };

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || user.role !== "teacher") return;
    void load();
  }, [user]);

  useEffect(() => {
    if (!selectedCourseId || !user || user.role !== "teacher") return;
    void load(selectedCourseId);
  }, [selectedCourseId]);

  const activeCourse = useMemo(() => courses.find((item) => item.id === selectedCourseId), [courses, selectedCourseId]);

  const handleUpload = async (file: File | null) => {
    if (!file || !selectedCourseId) return;
    setUploading(true);
    setMessage("");
    try {
      await api.uploadMaterial(selectedCourseId, file);
      await load(selectedCourseId);
      setMessage("资料上传成功。现在可以勾选并共享到学生端，或发起课堂同步展示。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "资料上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedCourseId || selectedIds.length === 0) {
      setMessage("请先选择课程并勾选至少一份资料。");
      return;
    }
    setSharing(true);
    setMessage("");
    try {
      await api.createClassroomShare({
        course_id: selectedCourseId,
        material_ids: selectedIds,
        title: shareForm.title,
        description: shareForm.description,
        share_scope: "classroom",
        share_type: "material",
      });
      setSelectedIds([]);
      await load(selectedCourseId);
      setMessage("资料已共享到学生端。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "共享失败");
    } finally {
      setSharing(false);
    }
  };

  const handleStartLive = async (materialId: number) => {
    try {
      const share = await api.startLiveShare({ material_id: materialId, share_target_type: "course_class", share_target_id: activeCourse?.class_name || activeCourse?.audience || selectedCourseId });
      router.push(`/teacher/materials/live/${share.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "发起课堂共享失败");
    }
  };

  const handlePreviewMaterial = async (item: MaterialItem) => {
    try {
      setMessage("");
      await api.openProtectedFile(item.download_url, item.filename);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "资料预览失败");
    }
  };

  const handleDownloadMaterial = async (item: MaterialItem) => {
    try {
      setMessage("");
      await api.downloadProtectedFile(item.download_url, item.filename);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "资料下载失败");
    }
  };

  if (!user || user.role !== "teacher") {
    return <main className="section-card rounded-[28px] p-8 text-center text-slate-500">正在加载教学资料库...</main>;
  }

  return (
    <main className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-slate-500">教学资料库</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900">教师资料上传、共享与课堂同步展示</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">支持上传 PPT、PDF、图片、文档等资料；可共享给学生端，也可发起课堂同步展示并进行实时批注。</p>
        </div>

        <div className="mt-6 space-y-5">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">所属课程</span>
            <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3">
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </label>

          <div className="section-card rounded-[28px] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-slate-900">上传教学资料</p>
                <p className="mt-1 text-sm text-slate-500">支持 PPT、PDF、图片、文档、Markdown 等课堂材料。</p>
              </div>
              <label className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
                {uploading ? "上传中..." : "选择文件"}
                <input type="file" className="hidden" onChange={(e) => void handleUpload(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>

          <div className="section-card rounded-[28px] p-5">
            <h3 className="text-lg font-bold text-slate-900">共享设置</h3>
            <div className="mt-4 grid gap-4">
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">共享标题</span>
                <input value={shareForm.title} onChange={(e) => setShareForm((prev) => ({ ...prev, title: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">共享说明</span>
                <textarea value={shareForm.description} onChange={(e) => setShareForm((prev) => ({ ...prev, description: e.target.value }))} rows={3} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
              </label>
            </div>

            <div className="mt-4 space-y-3">
              {materials.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">当前课程还没有已上传资料。</div> : materials.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={(e) => setSelectedIds((prev) => e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id))} />
                      <div>
                        <p className="font-semibold text-slate-900">{item.filename}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.file_type || "未知类型"} · {item.created_at}</p>
                      </div>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => void handlePreviewMaterial(item)} className="ui-pill rounded-full px-3 py-1.5 text-xs font-semibold">预览资料</button>
                      <button onClick={() => void handleDownloadMaterial(item)} className="ui-pill rounded-full px-3 py-1.5 text-xs font-semibold">下载资料</button>
                      <button onClick={() => void handleStartLive(item.id)} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">开始共享展示</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className={`text-sm ${message.includes("失败") ? "text-rose-700" : "text-slate-500"}`}>{message || "勾选资料后可共享到学生端，或直接发起课堂共享展示。"} </p>
              <button onClick={() => void handleShare()} disabled={sharing} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">{sharing ? "共享中..." : "共享到学生端"}</button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
          <p className="text-sm font-semibold text-slate-500">当前课程</p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">{activeCourse?.name || "未选择课程"}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">最近共享记录、当前课堂同步状态和共享入口都会显示在这里。</p>
          {liveShare ? (
            <div className="mt-4 rounded-[24px] border border-[var(--active-border)] bg-[var(--active-surface)] p-5">
              <p className="text-sm font-semibold text-[var(--accent-contrast)]">当前正在共享</p>
              <p className="mt-2 text-lg font-bold text-slate-900">共享记录 {liveShare.id}</p>
              <p className="mt-2 text-sm text-slate-600">当前页：第 {liveShare.current_page} 页</p>
              <button onClick={() => router.push(`/teacher/materials/live/${liveShare.id}`)} className="mt-4 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">进入课堂展示</button>
            </div>
          ) : null}
          <div className="mt-5 space-y-3">
            {shares.length === 0 ? <div className="section-card rounded-[24px] p-5 text-sm text-slate-500">当前还没有共享记录。</div> : shares.map((share) => (
              <div key={share.id} className="section-card rounded-[24px] p-5">
                <p className="text-lg font-bold text-slate-900">{share.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{share.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {share.materials.map((material) => <span key={material.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{material.filename}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
          <p className="text-sm font-semibold text-slate-500">学生资料请求</p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">学生请求讲义 / 请求资料</h3>
          <div className="mt-5 space-y-3">
            {requests.length === 0 ? <div className="section-card rounded-[24px] p-5 text-sm text-slate-500">目前还没有新的资料请求。</div> : requests.map((item) => (
              <div key={item.id} className="section-card rounded-[24px] p-5">
                <p className="font-semibold text-slate-900">{item.student_name}</p>
                <p className="mt-1 text-xs text-slate-500">{item.created_at} · 状态：{item.status}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.request_text}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={async () => { await api.handleMaterialRequest(item.id, "approved"); await load(selectedCourseId); }} className="ui-pill rounded-full px-3 py-1.5 text-xs font-semibold">同意</button>
                  <button onClick={async () => { await api.handleMaterialRequest(item.id, "shared"); await load(selectedCourseId); }} className="ui-pill rounded-full px-3 py-1.5 text-xs font-semibold">已共享</button>
                  <button onClick={async () => { await api.handleMaterialRequest(item.id, "rejected"); await load(selectedCourseId); }} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600">拒绝</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
