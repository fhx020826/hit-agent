"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { MetricCard, WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { api, type Course, type LessonPack, type SurveyAnalytics, type SurveyInstanceItem } from "@/lib/api";

export default function TeacherFeedbackPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
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
      if (!silent) setMessage("已加载匿名反馈统计结果。");
    } catch (error) {
      setAnalytics(null);
      if (!silent) setMessage(error instanceof Error ? error.message : "加载统计失败");
    }
  }, []);

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
    return <main className="section-card rounded-[28px] p-8 text-center text-slate-500">正在加载匿名问卷分析...</main>;
  }

  return (
    <WorkspacePage tone="teacher">
      <WorkspaceHero
        tone="teacher"
        eyebrow="匿名问卷分析"
        title={<h2>教师查看的是汇总结果，学生填写的是匿名反馈</h2>}
        description={(
          <p>
            教师端只显示参与率、评分分布和文本建议，不展示学生个人身份。当前支持教师手动触发课程结束后的反馈问卷，自动定时触发保留为后续扩展能力。
          </p>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <WorkspaceSection
          tone="teacher"
          eyebrow="问卷触发"
          title="先绑定课程与课程包，再手动触发反馈问卷"
          description="当前页面保留手动触发模式，让教师在真实课程结束后主动决定何时收集反馈。"
        >
          <div className="workspace-stack">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">所属课程</span>
              <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">请选择课程</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">对应课次 / 课程包</span>
              <select value={packId} onChange={(e) => setPackId(e.target.value)}>
                <option value="">请选择课程包</option>
                {publishedPacks.map((pack) => <option key={pack.id} value={pack.id}>{pack.id} · 第 {pack.version} 版</option>)}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">问卷实例</span>
              <select
                value={surveyId}
                onChange={(e) => {
                  const nextSurveyId = e.target.value;
                  setSurveyId(nextSurveyId);
                  void loadAnalytics(nextSurveyId, true);
                }}
              >
                <option value="">{surveyInstances.length === 0 ? "当前课程暂无问卷实例" : "请选择问卷实例"}</option>
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
                      title: `课后匿名反馈 ${new Date().toLocaleString("zh-CN")}`,
                      trigger_mode: "manual",
                      template_id: undefined,
                    });
                    const instances = await loadSurveyInstances(courseId, packId);
                    setSurveyId(created.id);
                    if (!instances.some((item) => item.id === created.id)) {
                      setSurveyInstances([created, ...instances]);
                    }
                    await loadAnalytics(created.id, true);
                    setMessage("问卷实例已创建。学生端会在“匿名课堂反馈”中看到待填写项目。");
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "创建失败，请稍后重试");
                  }
                }}
                className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white"
              >
                手动触发反馈问卷
              </button>

              <button
                onClick={async () => {
                  if (!surveyId) {
                    setMessage("请先选择或创建问卷实例后再查看统计。");
                    return;
                  }
                  await loadAnalytics(surveyId);
                }}
                className="ui-pill rounded-full px-5 py-3 text-sm font-semibold"
              >
                查看统计结果
              </button>
            </div>

            {surveyId ? <p className="text-xs text-slate-500">当前问卷实例编号：{surveyId}</p> : null}
            {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          </div>
        </WorkspaceSection>

        <WorkspaceSection
          tone="teacher"
          eyebrow="反馈结果"
          title="参与率、评分分布与文本建议"
          description="所有结果都以匿名汇总方式展示，重点是帮助教师复盘节奏、难度和课堂体验。"
        >
          {analytics ? (
            <div className="workspace-stack">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard tone="teacher" label="目标学生数" value={analytics.total_target_students} />
                <MetricCard tone="teacher" label="参与人数" value={analytics.participation_count} />
                <MetricCard tone="teacher" label="参与率" value={`${analytics.participation_rate}%`} />
              </div>

              <div className="workspace-callout">
                <p className="font-semibold text-slate-900">评分分布</p>
                <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
                  {Object.entries(analytics.rating_breakdown).map(([key, value]) => <p key={key}>{key}：{Object.entries(value).map(([score, count]) => `${score} 分 ${count} 人`).join("；")}</p>)}
                  {Object.entries(analytics.choice_breakdown).map(([key, value]) => <p key={key}>{key}：{Object.entries(value).map(([option, count]) => `${option} ${count} 人`).join("；")}</p>)}
                </div>
              </div>

              <div className="workspace-callout">
                <p className="font-semibold text-slate-900">匿名文本建议</p>
                <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
                  {analytics.text_feedback.length === 0 ? <p>当前还没有文本建议。</p> : analytics.text_feedback.map((item, index) => <p key={`${index}-${item}`}>{index + 1}. {item}</p>)}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">触发或选择问卷后，这里会展示参与率、难度评分、节奏评价、风格满意度和文本建议汇总。</div>
          )}
        </WorkspaceSection>
      </div>
    </WorkspacePage>
  );
}
