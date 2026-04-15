"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, type Course, type WeaknessAnalysis } from "@/lib/api";
import { pick } from "@/lib/i18n";

export default function WeaknessPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [result, setResult] = useState<WeaknessAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState("");
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/");
  }, [loading, router, user]);

  const loadAnalysis = useCallback(async (courseId: string, keepResult = false) => {
    const requestId = ++requestSeqRef.current;
    setAnalyzing(true);
    setMessage("");
    if (!keepResult) {
      setResult(null);
    }
    try {
      const data = await api.getWeaknessAnalysis(courseId || undefined);
      if (requestSeqRef.current !== requestId) return;
      setResult(data);
    } catch (error) {
      if (requestSeqRef.current !== requestId) return;
      setResult(null);
      setMessage(error instanceof Error ? error.message : pick(language, "薄弱点分析加载失败。", "Failed to load the weakness analysis."));
    } finally {
      if (requestSeqRef.current === requestId) {
        setAnalyzing(false);
      }
    }
  }, [language]);

  useEffect(() => {
    if (!user || user.role !== "student") return;
    api.listCourses().then((courseList) => {
      setCourses(courseList);
      const firstCourseId = courseList[0]?.id || "";
      setSelectedCourseId(firstCourseId);
    }).catch(() => {
      setCourses([]);
      setSelectedCourseId("");
      setMessage(pick(language, "课程列表加载失败。", "Failed to load courses."));
    });
  }, [language, user]);

  useEffect(() => {
    if (!user || user.role !== "student") return;
    if (!selectedCourseId) {
      setResult(null);
      setAnalyzing(false);
      return;
    }
    void loadAnalysis(selectedCourseId);
  }, [loadAnalysis, selectedCourseId, user]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) || null,
    [courses, selectedCourseId],
  );

  if (!user || user.role !== "student") {
    return (
      <WorkspacePage tone="student">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">
          {pick(language, "正在加载薄弱点分析...", "Loading weakness analysis...")}
        </div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="student" className="space-y-5">
      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-semibold text-slate-500">{pick(language, "学习诊断", "Learning Diagnosis")}</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">{pick(language, "按课程查看薄弱点分析", "View Weakness Analysis by Course")}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              {pick(
                language,
                "分析结果会跟随当前课程自动切换，并只基于该课程下的提问记录生成。这样你能更清楚地区分不同课程、不同模块中的知识短板。",
                "The analysis updates automatically with the selected course and is generated only from that course's question history. This makes it easier to separate weak spots across courses and modules.",
              )}
            </p>
          </div>
          <button
            onClick={() => void loadAnalysis(selectedCourseId, true)}
            disabled={analyzing || !selectedCourseId}
            className="button-primary rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {analyzing ? pick(language, "分析中...", "Analyzing...") : pick(language, "重新分析", "Refresh Analysis")}
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <div className="section-card rounded-[28px] p-5">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">{pick(language, "选择课程", "Select Course")}</span>
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

            <div className="mt-5 rounded-[22px] border border-slate-200 bg-white/70 p-4">
              <p className="text-sm font-semibold text-slate-500">{pick(language, "当前分析对象", "Current Target")}</p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {selectedCourse?.name || pick(language, "未选择课程", "No course selected")}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {result?.course_name
                  ? `${pick(language, "当前结果对应：", "Current result for: ")}${result.course_name}`
                  : pick(language, "切换课程后会自动刷新本页分析结果。", "Switching the course will automatically refresh the analysis on this page.")}
              </p>
            </div>

            {message ? (
              <p className="mt-4 text-sm text-rose-700">{message}</p>
            ) : null}
          </div>

          <div className="space-y-4">
            {analyzing ? (
              <div className="section-card rounded-[28px] p-8">
                <p className="text-sm font-semibold text-slate-500">{pick(language, "分析进行中", "Analysis in Progress")}</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">{pick(language, "正在生成当前课程的学习诊断", "Generating learning diagnosis for the selected course")}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {pick(language, "我们会根据这门课下的提问记录重新整理总结、薄弱知识点和复习建议。", "We are rebuilding the summary, weak knowledge points, and review suggestions from this course's question history.")}
                </p>
              </div>
            ) : result ? (
              <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <section className="section-card rounded-[28px] p-6">
                  <h3 className="text-xl font-bold text-slate-900">{pick(language, "诊断摘要", "Diagnosis Summary")}</h3>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">
                      {pick(language, "课程：", "Course: ")}
                      {result.course_name || selectedCourse?.name || pick(language, "当前课程", "Current course")}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">
                      {pick(language, "提问记录数：", "Question count: ")}
                      {result.total_questions}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-8 text-slate-600">{result.summary}</p>
                  <p className="mt-5 text-xs text-slate-500">
                    {pick(language, "更新时间：", "Updated at: ")}
                    {result.updated_at}
                  </p>
                </section>

                <section className="section-card rounded-[28px] p-6">
                  <h3 className="text-xl font-bold text-slate-900">{pick(language, "建议加强的知识点", "Suggested Focus Areas")}</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {result.weak_points.length > 0 ? result.weak_points.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold text-slate-800"
                      >
                        {item}
                      </span>
                    )) : (
                      <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
                        {pick(language, "暂无明显薄弱点", "No obvious weak point yet")}
                      </span>
                    )}
                  </div>
                  <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
                    {result.suggestions.length > 0 ? result.suggestions.map((item, index) => (
                      <p key={`${index}-${item}`}>{index + 1}. {item}</p>
                    )) : (
                      <p>{pick(language, "当前建议继续围绕核心概念进行提问，系统会在积累更多记录后给出更细的建议。", "Keep asking around the core concepts. The system will provide more detailed suggestions after more history is accumulated.")}</p>
                    )}
                  </div>
                </section>
              </div>
            ) : (
              <div className="section-card rounded-[28px] p-8 text-center text-slate-500">
                {pick(
                  language,
                  "当前课程暂时还没有足够的提问记录，建议先在课程专属 AI 助教中完成几轮提问，再回来查看分析结果。",
                  "There is not enough question history for this course yet. Ask a few questions in the Course AI Assistant first, then come back for the analysis.",
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </WorkspacePage>
  );
}
