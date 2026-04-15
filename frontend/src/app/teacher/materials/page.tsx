"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, type ClassroomShare, type Course, type LiveShareRecord, type MaterialItem, type MaterialRequestItem } from "@/lib/api";
import { pick } from "@/lib/i18n";

function TeacherMaterialsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const defaultShareForm = useMemo(
    () => ({
      title: pick(language, "课堂资料共享", "Shared Class Materials"),
      description: pick(language, "教师正在共享本节课相关资料，请同学们结合课堂讲解查看。", "The teacher is sharing materials for this class. Review them together with the lecture."),
    }),
    [language],
  );
  const [courses, setCourses] = useState<Course[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [shares, setShares] = useState<ClassroomShare[]>([]);
  const [requests, setRequests] = useState<MaterialRequestItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [shareForm, setShareForm] = useState(defaultShareForm);
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [liveShare, setLiveShare] = useState<LiveShareRecord | null>(null);
  const selectedCourseIdRef = useRef("");

  const queryCourseId = searchParams.get("course_id") || "";
  const focusRequestId = searchParams.get("request_id") || "";

  useEffect(() => {
    selectedCourseIdRef.current = selectedCourseId;
  }, [selectedCourseId]);

  const load = useCallback(async (courseId?: string) => {
    const courseList = await api.listCourses().catch(() => []);
    setCourses(courseList);
    const nextCourseId = courseId || queryCourseId || selectedCourseIdRef.current || courseList[0]?.id || "";
    if (nextCourseId !== selectedCourseIdRef.current) {
      selectedCourseIdRef.current = nextCourseId;
      setSelectedCourseId(nextCourseId);
    }
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
  }, [queryCourseId]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || user.role !== "teacher") return;
    void load();
  }, [user, load]);

  useEffect(() => {
    if (!selectedCourseId || !user || user.role !== "teacher") return;
    void load(selectedCourseId);
  }, [selectedCourseId, user, load]);

  useEffect(() => {
    setShareForm((prev) => {
      const defaultTitles = ["课堂资料共享", "Shared Class Materials"];
      const defaultDescriptions = [
        "教师正在共享本节课相关资料，请同学们结合课堂讲解查看。",
        "The teacher is sharing materials for this class. Review them together with the lecture.",
      ];
      return {
        title: defaultTitles.includes(prev.title) ? defaultShareForm.title : prev.title,
        description: defaultDescriptions.includes(prev.description) ? defaultShareForm.description : prev.description,
      };
    });
  }, [defaultShareForm]);

  const activeCourse = useMemo(() => courses.find((item) => item.id === selectedCourseId), [courses, selectedCourseId]);

  const handleUpload = async (file: File | null) => {
    if (!file || !selectedCourseId) return;
    setUploading(true);
    setMessage("");
    try {
      await api.uploadMaterial(selectedCourseId, file);
      await load(selectedCourseId);
      setMessage(pick(language, "资料上传成功。现在可以勾选并共享到学生端，或发起课堂同步展示。", "Upload complete. You can now share the material or start a live classroom view."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "资料上传失败", "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedCourseId || selectedIds.length === 0) {
      setMessage(pick(language, "请先选择课程并勾选至少一份资料。", "Select a course and choose at least one file."));
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
      setMessage(pick(language, "资料已共享到学生端。", "Materials have been shared with students."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "共享失败", "Share failed"));
    } finally {
      setSharing(false);
    }
  };

  const handleStartLive = async (materialId: number) => {
    try {
      const share = await api.startLiveShare({ material_id: materialId, share_target_type: "course_class", share_target_id: activeCourse?.class_name || activeCourse?.audience || selectedCourseId });
      router.push(`/teacher/materials/live/${share.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "发起课堂共享失败", "Failed to start live share"));
    }
  };

  const handlePreviewMaterial = async (item: MaterialItem) => {
    try {
      setMessage("");
      await api.openProtectedFile(item.download_url, item.filename);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "资料预览失败", "Preview failed"));
    }
  };

  const handleDownloadMaterial = async (item: MaterialItem) => {
    try {
      setMessage("");
      await api.downloadProtectedFile(item.download_url, item.filename);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "资料下载失败", "Download failed"));
    }
  };

  if (!user || user.role !== "teacher") {
    return (
      <WorkspacePage tone="teacher">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载教学资料库...", "Loading teaching materials...")}</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="teacher" className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "教学资料库", "Teaching Materials")}</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900">{pick(language, "教师资料上传、共享与课堂同步展示", "Upload, share, and present class materials")}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{pick(language, "上传资料、共享给学生，或直接发起课堂同步展示。", "Upload files, share them with students, or start a live classroom view.")}</p>
        </div>

        <div className="mt-6 space-y-5">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "所属课程", "Course")}</span>
            <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3">
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </label>

          <div className="section-card rounded-[28px] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-slate-900">{pick(language, "上传教学资料", "Upload Teaching Materials")}</p>
                <p className="mt-1 text-sm text-slate-500">{pick(language, "支持 PPT、PDF、图片、文档、Markdown 等课堂材料。", "Supports slides, PDFs, images, documents, and Markdown files.")}</p>
              </div>
              <label className="button-primary rounded-full px-4 py-2 text-sm font-semibold">
                {uploading ? pick(language, "上传中...", "Uploading...") : pick(language, "选择文件", "Choose File")}
                <input type="file" className="hidden" onChange={(e) => void handleUpload(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>

          <div className="section-card rounded-[28px] p-5">
            <h3 className="text-lg font-bold text-slate-900">{pick(language, "共享设置", "Share Setup")}</h3>
            <div className="mt-4 grid gap-4">
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">{pick(language, "共享标题", "Share Title")}</span>
                <input value={shareForm.title} onChange={(e) => setShareForm((prev) => ({ ...prev, title: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">{pick(language, "共享说明", "Share Note")}</span>
                <textarea value={shareForm.description} onChange={(e) => setShareForm((prev) => ({ ...prev, description: e.target.value }))} rows={3} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
              </label>
            </div>

            <div className="mt-4 space-y-3">
              {materials.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">{pick(language, "当前课程还没有已上传资料。", "There are no uploaded materials for this course yet.")}</div> : materials.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={(e) => setSelectedIds((prev) => e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id))} />
                      <div>
                        <p className="font-semibold text-slate-900">{item.filename}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.file_type || pick(language, "未知类型", "Unknown type")} · {item.created_at}</p>
                      </div>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => void handlePreviewMaterial(item)} className="ui-pill rounded-full px-3 py-1.5 text-xs font-semibold">{pick(language, "预览资料", "Preview")}</button>
                      <button onClick={() => void handleDownloadMaterial(item)} className="ui-pill rounded-full px-3 py-1.5 text-xs font-semibold">{pick(language, "下载资料", "Download")}</button>
                      <button onClick={() => void handleStartLive(item.id)} className="button-primary rounded-full px-3 py-1.5 text-xs font-semibold">{pick(language, "开始共享展示", "Start Live View")}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className={`text-sm ${message.toLowerCase().includes("fail") || message.includes("失败") ? "text-rose-700" : "text-slate-500"}`}>{message || pick(language, "勾选资料后可共享到学生端，或直接发起课堂共享展示。", "Choose files to share them with students or start a live classroom view.")} </p>
              <button onClick={() => void handleShare()} disabled={sharing} className="button-primary rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60">{sharing ? pick(language, "共享中...", "Sharing...") : pick(language, "共享到学生端", "Share with Students")}</button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "当前课程", "Current Course")}</p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">{activeCourse?.name || pick(language, "未选择课程", "No Course Selected")}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">{pick(language, "最近共享记录、当前课堂同步状态和共享入口都会显示在这里。", "Recent shares, current live state, and share entry points are shown here.")}</p>
          {liveShare ? (
            <div className="mt-4 rounded-[24px] border border-[var(--active-border)] bg-[var(--active-surface)] p-5">
              <p className="text-sm font-semibold text-[color:var(--accent-soft-fg)]">{pick(language, "当前正在共享", "Live Now")}</p>
              <p className="mt-2 text-lg font-bold text-slate-900">{pick(language, `共享记录 ${liveShare.id}`, `Share ${liveShare.id}`)}</p>
              <p className="mt-2 text-sm text-slate-600">{pick(language, `当前页：第 ${liveShare.current_page} 页`, `Current page: ${liveShare.current_page}`)}</p>
              <button onClick={() => router.push(`/teacher/materials/live/${liveShare.id}`)} className="button-primary mt-4 rounded-full px-4 py-2 text-sm font-semibold">{pick(language, "进入课堂展示", "Open Live View")}</button>
            </div>
          ) : null}
          <div className="mt-5 space-y-3">
            {shares.length === 0 ? <div className="section-card rounded-[24px] p-5 text-sm text-slate-500">{pick(language, "当前还没有共享记录。", "There are no share records yet.")}</div> : shares.map((share) => (
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

        <div id="material-requests" className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "学生资料请求", "Student Requests")}</p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">{pick(language, "学生请求讲义 / 请求资料", "Requests for notes and materials")}</h3>
          <div className="mt-5 space-y-3">
            {requests.length === 0 ? <div className="section-card rounded-[24px] p-5 text-sm text-slate-500">{pick(language, "目前还没有新的资料请求。", "There are no new requests right now.")}</div> : requests.map((item) => (
              <div key={item.id} className={`section-card rounded-[24px] p-5 ${focusRequestId && focusRequestId === item.id ? "ring-2 ring-[var(--accent)]" : ""}`}>
                <p className="font-semibold text-slate-900">{item.student_name}</p>
                <p className="mt-1 text-xs text-slate-500">{item.created_at} · {pick(language, "状态：", "Status: ")}{item.status}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.request_text}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={async () => { await api.handleMaterialRequest(item.id, "approved"); await load(selectedCourseId); }} className="ui-pill rounded-full px-3 py-1.5 text-xs font-semibold">{pick(language, "同意", "Approve")}</button>
                  <button onClick={async () => { await api.handleMaterialRequest(item.id, "shared"); await load(selectedCourseId); }} className="ui-pill rounded-full px-3 py-1.5 text-xs font-semibold">{pick(language, "已共享", "Marked Shared")}</button>
                  <button onClick={async () => { await api.handleMaterialRequest(item.id, "rejected"); await load(selectedCourseId); }} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600">{pick(language, "拒绝", "Reject")}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </WorkspacePage>
  );
}

export default function TeacherMaterialsPage() {
  return (
    <Suspense
      fallback={
        <WorkspacePage tone="teacher">
          <div className="section-card rounded-[28px] p-8 text-center text-slate-500">正在加载教学资料库...</div>
        </WorkspacePage>
      }
    >
      <TeacherMaterialsPageContent />
    </Suspense>
  );
}
