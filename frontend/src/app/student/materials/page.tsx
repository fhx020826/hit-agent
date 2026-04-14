"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, type ClassroomShare, type Course, type LiveShareRecord, type MaterialItem } from "@/lib/api";
import { pick } from "@/lib/i18n";

export default function StudentMaterialsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const defaultRequestText = useMemo(
    () => pick(language, "希望教师共享本节课使用的 PPT、讲义或相关补充资料。", "Please share the slides, notes, or supporting materials used in this class."),
    [language],
  );

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [shares, setShares] = useState<ClassroomShare[]>([]);
  const [liveShare, setLiveShare] = useState<LiveShareRecord | null>(null);

  const [requestText, setRequestText] = useState(defaultRequestText);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const loadCourses = useCallback(async () => {
    const list = await api.listCourses().catch(() => []);
    setCourses(list);
    const firstId = list[0]?.id || "";
    setSelectedCourseId((prev) => prev || firstId);
  }, []);

  const loadCourseShares = useCallback(async (courseId: string) => {
    if (!courseId) {
      setShares([]);
      setLiveShare(null);
      return;
    }
    const [shareList, currentLive] = await Promise.all([
      api.listCurrentShares(courseId).catch(() => []),
      api.getCurrentLiveShare(courseId).catch(() => null),
    ]);
    setShares(shareList);
    setLiveShare(currentLive);
  }, []);

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) {
      router.push("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || user.role !== "student") return;
    void loadCourses();
  }, [loadCourses, user]);

  useEffect(() => {
    if (!user || user.role !== "student") return;
    if (!selectedCourseId) return;
    void loadCourseShares(selectedCourseId);
  }, [loadCourseShares, selectedCourseId, user]);

  useEffect(() => {
    setRequestText((prev) => {
      const fallbackTexts = [
        "希望教师共享本节课使用的 PPT、讲义或相关补充资料。",
        "Please share the slides, notes, or supporting materials used in this class.",
      ];
      return fallbackTexts.includes(prev) ? defaultRequestText : prev;
    });
  }, [defaultRequestText]);

  const currentShare = useMemo(() => shares[0] || null, [shares]);

  const handleRequest = async () => {
    if (!selectedCourseId) {
      setMessage(pick(language, "当前没有可用课程，暂时无法发送资料请求。", "There is no available course to send a material request."));
      return;
    }
    setSending(true);
    try {
      await api.requestCourseMaterial({ course_id: selectedCourseId, request_text: requestText });
      setMessage(pick(language, "资料请求已发送给教师，教师端会收到提醒。", "The request has been sent to the teacher."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "发送失败", "Request failed"));
    } finally {
      setSending(false);
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

  if (!user || user.role !== "student") {
    return (
      <WorkspacePage tone="student">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载课堂共享资料...", "Loading shared materials...")}</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="student" className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "课堂共享资料", "Shared Materials")}</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900">{pick(language, "查看教师共享资料与课堂同步展示", "Review shared materials and live classroom display")}</h2>
        </div>

        <div className="mt-6 space-y-5">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "当前课程", "Current Course")}</span>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>

          {liveShare ? (
            <div className="rounded-[26px] border border-[var(--active-border)] bg-[var(--active-surface)] p-6">
              <p className="text-sm font-semibold text-[var(--accent-contrast)]">{pick(language, "教师正在共享课堂内容", "The teacher is sharing live class content")}</p>
              <p className="mt-2 text-lg font-bold text-slate-900">{pick(language, `当前页：第 ${liveShare.current_page} 页`, `Current page: ${liveShare.current_page}`)}</p>
              <button
                onClick={() => router.push(`/student/materials/live/${liveShare.id}`)}
                className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {pick(language, "进入同步查看", "Open Live View")}
              </button>
            </div>
          ) : null}

          {currentShare ? (
            <div className="section-card rounded-[28px] p-6">
              <p className="text-sm font-semibold text-slate-500">{pick(language, "最近共享", "Latest Share")}</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">{currentShare.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{currentShare.description}</p>
              <div className="mt-5 space-y-3">
                {currentShare.materials.map((material) => (
                  <div
                    key={material.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-[var(--active-border)]"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{material.filename}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {material.file_type || pick(language, "未知类型", "Unknown type")} · {material.created_at}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => void handlePreviewMaterial(material)}
                        className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-contrast)]"
                      >
                        {pick(language, "打开资料", "Open")}
                      </button>
                      <button
                        onClick={() => void handleDownloadMaterial(material)}
                        className="ui-pill rounded-full px-3 py-1 text-xs font-semibold"
                      >
                        {pick(language, "下载", "Download")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="section-card rounded-[28px] p-6 text-sm leading-7 text-slate-500">
              {pick(language, "当前课程还没有教师正在共享的资料。你可以在右侧直接请求教师上传讲义。", "There are no shared materials for this course yet. You can request them from the teacher on the right.")}
            </div>
          )}
        </div>
      </section>

      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <p className="text-sm font-semibold text-slate-500">{pick(language, "请求讲义 / 请求资料", "Request Materials")}</p>
        <h3 className="mt-2 text-2xl font-black text-slate-900">{pick(language, "如果还没共享，可以直接提醒教师", "If nothing is shared yet, send a reminder")}</h3>
        <textarea
          value={requestText}
          onChange={(e) => setRequestText(e.target.value)}
          rows={6}
          className="mt-5 w-full rounded-[24px] border border-slate-300 bg-white px-4 py-4 text-sm leading-7 text-slate-900"
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className={`text-sm ${message.toLowerCase().includes("fail") || message.includes("失败") ? "text-rose-700" : "text-slate-500"}`}>
            {message || pick(language, "可以请求课堂 PPT、讲义、板书材料、带批注版本或无批注版本。", "You can request slides, notes, board captures, or annotated and clean versions.")}
          </p>
          <button
            onClick={() => void handleRequest()}
            disabled={sending}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {sending ? pick(language, "发送中...", "Sending...") : pick(language, "发送资料请求", "Send Request")}
          </button>
        </div>
      </section>
    </WorkspacePage>
  );
}
