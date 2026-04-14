"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, type Course, type SurveyPendingItem } from "@/lib/api";
import { pick } from "@/lib/i18n";

export default function StudentFeedbackPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const [items, setItems] = useState<SurveyPendingItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [message, setMessage] = useState("");

  const courseNameMap = useMemo(
    () => Object.fromEntries(courses.map((course) => [course.id, course.name])),
    [courses],
  );

  const reload = async () => {
    const [pending, courseList] = await Promise.all([
      api.listPendingSurveys(),
      api.listCourses().catch(() => []),
    ]);
    setItems(pending);
    setCourses(courseList);
  };

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || user.role !== "student") return;
    let alive = true;
    const load = async () => {
      try {
        const [pending, courseList] = await Promise.all([
          api.listPendingSurveys(),
          api.listCourses().catch(() => []),
        ]);
        if (!alive) return;
        setItems(pending);
        setCourses(courseList);
      } catch {
        if (!alive) return;
        setItems([]);
        setCourses([]);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [user]);

  if (!user || user.role !== "student") {
    return (
      <WorkspacePage tone="student">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载匿名反馈...", "Loading anonymous feedback...")}</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="student" className="space-y-5">
    <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
      <div className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold text-slate-500">{pick(language, "匿名课堂反馈", "Anonymous Feedback")}</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">{pick(language, "课后自愿填写，不向教师暴露个人身份", "Optional after-class feedback without exposing your identity")}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{pick(language, "问卷是匿名的，可以填写也可以跳过。教师端只看到汇总结果和文本建议。", "This survey is anonymous. You can submit it or skip it, and teachers only see aggregated results and comments.")}</p>
      </div>

      <div className="mt-6 space-y-5">
        {items.length === 0 ? <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "当前没有待填写问卷。已选择跳过的问卷不会反复强制弹出。", "There are no pending surveys. Skipped items will not keep interrupting you.")}</div> : items.map((survey) => (
          <div key={survey.id} className="section-card rounded-[28px] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{survey.title}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {pick(language, "课程：", "Course: ")}
                  {courseNameMap[survey.course_id] || survey.course_id || pick(language, "未关联课程", "Unassigned")}
                </p>
                <p className="mt-2 text-xs text-slate-500">{pick(language, "创建时间：", "Created: ")}{survey.created_at}</p>
              </div>
              <div className="text-sm leading-7 text-slate-600">{pick(language, "你可以现在填写，也可以选择稍后忽略。", "You can answer now or ignore it for later.")}</div>
            </div>
            <div className="mt-4 space-y-4">
              {survey.questions.map((question) => (
                <div key={question.id} className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                  <p className="font-semibold text-slate-900">{question.title}</p>
                  {question.type === "rating" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((score) => <button key={score} onClick={() => setAnswers((prev) => ({ ...prev, [survey.id]: { ...(prev[survey.id] || {}), [question.id]: score } }))} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${answers[survey.id]?.[question.id] === score ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>{score}{pick(language, " 分", "",)}</button>)}
                    </div>
                  ) : question.type === "choice" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(question.options || []).map((option) => <button key={option} onClick={() => setAnswers((prev) => ({ ...prev, [survey.id]: { ...(prev[survey.id] || {}), [question.id]: option } }))} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${answers[survey.id]?.[question.id] === option ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>{option}</button>)}
                    </div>
                  ) : (
                    <textarea rows={3} value={String(answers[survey.id]?.[question.id] || "")} onChange={(e) => setAnswers((prev) => ({ ...prev, [survey.id]: { ...(prev[survey.id] || {}), [question.id]: e.target.value } }))} placeholder={pick(language, "可选填文字建议", "Optional comments")} className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={async () => {
                await api.submitSurvey(survey.id, answers[survey.id] || {});
                setMessage(pick(language, "匿名反馈已提交，感谢你的教学改进建议。", "Feedback submitted. Thank you for helping improve the course."));
                await reload();
              }} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">{pick(language, "提交匿名反馈", "Submit Feedback")}</button>
              <button onClick={async () => {
                await api.skipSurvey(survey.id);
                setMessage(pick(language, "已为你标记稍后忽略。", "Marked to ignore for now."));
                await reload();
              }} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white">{pick(language, "稍后忽略", "Ignore for Now")}</button>
            </div>
          </div>
        ))}
      </div>
      {message ? <p className="mt-5 text-sm text-slate-600">{message}</p> : null}
    </section>
    </WorkspacePage>
  );
}
