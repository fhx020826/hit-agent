"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { MetricCard, WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { api, type Course, type LessonPack, type SurveyAnalytics, type SurveyInstanceItem } from "@/lib/api";
import { pick } from "@/lib/i18n";

export default function TeacherFeedbackPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [packs, setPacks] = useState<LessonPack[]>([]);
  const [surveyInstances, setSurveyInstances] = useState<SurveyInstanceItem[]>([]);
  const [surveyId, setSurveyId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [packId, setPackId] = useState("");
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null);
  const [message, setMessage] = useState("");

  const publishedPacks = useMemo(
    () => packs.filter((item) => item.status === "published" && (!courseId || item.course_id === courseId)),
    [courseId, packs],
  );

  const loadSurveyInstances = useCallback(async (targetCourseId: string, targetPackId: string) => {
    const instances = await api.listSurveyInstances({
      courseId: targetCourseId || undefined,
      lessonPackId: targetPackId || undefined,
    }).catch(() => []);
    setSurveyInstances(instances);
    return instances;
  }, []);

  const loadAnalytics = useCallback(async (targetSurveyId: string, silent = false) => {
    if (!targetSurveyId) {
      setAnalytics(null);
      return;
    }
    try {
      const result = await api.getSurveyAnalytics(targetSurveyId);
      setAnalytics(result);
      if (!silent) setMessage(pick(language, "已加载匿名反馈统计结果。", "Anonymous feedback analytics loaded."));
    } catch (error) {
      setAnalytics(null);
      if (!silent) setMessage(error instanceof Error ? error.message : pick(language, "加载统计失败", "Failed to load analytics"));
    }
  }, [language]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || user.role !== "teacher") return;
    let alive = true;

    const bootstrap = async () => {
      const [courseList, packList] = await Promise.all([
        api.listCourses().catch(() => []),
        api.listLessonPacks().catch(() => []),
      ]);
      if (!alive) return;
      const published = packList.filter((item) => item.status === "published");
      const firstCourseId = courseList[0]?.id || "";
      const firstPackId = published.find((item) => item.course_id === firstCourseId)?.id || published[0]?.id || "";
      setCourses(courseList);
      setPacks(published);
      setCourseId(firstCourseId);
      setPackId(firstPackId);
    };

    void bootstrap();
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "teacher" || !courseId) return;
    let alive = true;

    const syncInstances = async () => {
      const validPackId = packId && publishedPacks.some((item) => item.id === packId) ? packId : (publishedPacks[0]?.id || "");
      if (validPackId !== packId) {
        setPackId(validPackId);
        return;
      }
      const instances = await loadSurveyInstances(courseId, validPackId);
      if (!alive) return;
      let nextSurveyId = "";
      setSurveyId((prev) => {
        nextSurveyId = instances.some((item) => item.id === prev) ? prev : (instances[0]?.id || "");
        return nextSurveyId;
      });
      await loadAnalytics(nextSurveyId, true);
    };

    void syncInstances();
    return () => {
      alive = false;
    };
  }, [courseId, packId, publishedPacks, user, loadSurveyInstances, loadAnalytics]);

  if (!user || user.role !== "teacher") {
    return <main className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载匿名问卷分析...", "Loading anonymous survey analytics...")}</main>;
  }

  return (
    <WorkspacePage tone="teacher">
      <WorkspaceHero
        tone="teacher"
        eyebrow={pick(language, "匿名问卷分析", "Anonymous Survey Analytics")}
        title={<h2>{pick(language, "教师查看汇总结果，学生填写匿名反馈", "Teachers review aggregates while students stay anonymous")}</h2>}
        description={(
          <p>
            {pick(language, "这里只显示参与率、评分分布和文本建议，不展示学生个人身份。", "This page shows participation, rating breakdowns, and text suggestions without exposing student identities.")}
          </p>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <WorkspaceSection
          tone="teacher"
          eyebrow={pick(language, "问卷触发", "Survey Trigger")}
          title={pick(language, "先绑定课程与课程包，再手动触发反馈问卷", "Bind the course and lesson pack, then trigger feedback")}
          description={pick(language, "当前保留手动触发模式，由教师决定何时开始收集反馈。", "The current flow stays manual so teachers choose when to collect feedback.")}
        >
          <div className="workspace-stack">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">{pick(language, "所属课程", "Course")}</span>
              <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">{pick(language, "请选择课程", "Select a course")}</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">{pick(language, "对应课次 / 课程包", "Lesson Pack")}</span>
              <select value={packId} onChange={(e) => setPackId(e.target.value)}>
                <option value="">{pick(language, "请选择课程包", "Select a lesson pack")}</option>
                {publishedPacks.map((pack) => <option key={pack.id} value={pack.id}>{pack.id} · {pick(language, `第 ${pack.version} 版`, `Version ${pack.version}`)}</option>)}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">{pick(language, "问卷实例", "Survey Instance")}</span>
              <select
                value={surveyId}
                onChange={(e) => {
                  const nextSurveyId = e.target.value;
                  setSurveyId(nextSurveyId);
                  void loadAnalytics(nextSurveyId, true);
                }}
              >
                <option value="">{surveyInstances.length === 0 ? pick(language, "当前课程暂无问卷实例", "No survey instances for this course yet") : pick(language, "请选择问卷实例", "Select a survey instance")}</option>
                {surveyInstances.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {item.created_at}
                  </option>
                ))}
              </select>
            </label>

            <div className="workspace-inline-actions">
              <button
                onClick={async () => {
                  try {
                    setMessage("");
                    const created = await api.createSurveyInstance({
                      lesson_pack_id: packId,
                      course_id: courseId,
                      title: `${pick(language, "课后匿名反馈", "Post-class Anonymous Feedback")} ${new Date().toLocaleString(language === "en-US" ? "en-US" : "zh-CN")}`,
                      trigger_mode: "manual",
                      template_id: undefined,
                    });
                    const instances = await loadSurveyInstances(courseId, packId);
                    setSurveyId(created.id);
                    if (!instances.some((item) => item.id === created.id)) {
                      setSurveyInstances([created, ...instances]);
                    }
                    await loadAnalytics(created.id, true);
                    setMessage(pick(language, "问卷实例已创建。学生端会在“匿名课堂反馈”中看到待填写项目。", "Survey instance created. Students will now see it in anonymous classroom feedback."));
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : pick(language, "创建失败，请稍后重试", "Creation failed. Please try again."));
                  }
                }}
                className="button-primary rounded-full px-5 py-3 text-sm font-semibold"
              >
                {pick(language, "手动触发反馈问卷", "Trigger Feedback Survey")}
              </button>

              <button
                onClick={async () => {
                  if (!surveyId) {
                    setMessage(pick(language, "请先选择或创建问卷实例后再查看统计。", "Choose or create a survey instance before loading analytics."));
                    return;
                  }
                  await loadAnalytics(surveyId);
                }}
                className="ui-pill rounded-full px-5 py-3 text-sm font-semibold"
              >
                {pick(language, "查看统计结果", "View Analytics")}
              </button>
            </div>

            {surveyId ? <p className="text-xs text-slate-500">{pick(language, "当前问卷实例编号：", "Current survey ID: ")}{surveyId}</p> : null}
            {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          </div>
        </WorkspaceSection>

        <WorkspaceSection
          tone="teacher"
          eyebrow={pick(language, "反馈结果", "Results")}
          title={pick(language, "参与率、评分分布与文本建议", "Participation, ratings, and text suggestions")}
          description={pick(language, "所有结果都以匿名汇总方式展示，重点帮助教师复盘节奏、难度和课堂体验。", "All results stay aggregated and anonymous, helping teachers review pace, difficulty, and classroom experience.")}
        >
          {analytics ? (
            <div className="workspace-stack">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard tone="teacher" label={pick(language, "目标学生数", "Target Students")} value={analytics.total_target_students} />
                <MetricCard tone="teacher" label={pick(language, "参与人数", "Participants")} value={analytics.participation_count} />
                <MetricCard tone="teacher" label={pick(language, "参与率", "Participation Rate")} value={`${analytics.participation_rate}%`} />
              </div>

              <div className="workspace-callout">
                <p className="font-semibold text-slate-900">{pick(language, "评分分布", "Rating Breakdown")}</p>
                <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
                  {Object.entries(analytics.rating_breakdown).map(([key, value]) => <p key={key}>{key}：{Object.entries(value).map(([score, count]) => language === "en-US" ? `${score} points · ${count}` : `${score} 分 ${count} 人`).join(language === "en-US" ? "; " : "；")}</p>)}
                  {Object.entries(analytics.choice_breakdown).map(([key, value]) => <p key={key}>{key}：{Object.entries(value).map(([option, count]) => language === "en-US" ? `${option} · ${count}` : `${option} ${count} 人`).join(language === "en-US" ? "; " : "；")}</p>)}
                </div>
              </div>

              <div className="workspace-callout">
                <p className="font-semibold text-slate-900">{pick(language, "匿名文本建议", "Anonymous Text Feedback")}</p>
                <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
                  {analytics.text_feedback.length === 0 ? <p>{pick(language, "当前还没有文本建议。", "There is no text feedback yet.")}</p> : analytics.text_feedback.map((item, index) => <p key={`${index}-${item}`}>{index + 1}. {item}</p>)}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">{pick(language, "触发或选择问卷后，这里会展示参与率、难度评分、节奏评价、风格满意度和文本建议汇总。", "After you trigger or select a survey, this area will show participation, difficulty ratings, pace feedback, style satisfaction, and text suggestions.")}</div>
          )}
        </WorkspaceSection>
      </div>
    </WorkspacePage>
  );
}
