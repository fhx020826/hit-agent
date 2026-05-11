"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { SignalStrip, WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { api, type Course, type LessonPack } from "@/lib/api";
import { pick } from "@/lib/i18n";

export default function LessonPackHubPage() {
  return (
    <Suspense fallback={<LessonPackFallback />}>
      <LessonPackHubContent />
    </Suspense>
  );
}

function LessonPackFallback() {
  const { language } = useLanguage();
  return <div className="px-6 py-24 text-center text-slate-500">{pick(language, "正在准备课程包管理页...", "Preparing the lesson-pack manager...")}</div>;
}

function LessonPackHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const searchCourseId = searchParams.get("course_id") || "";
  const searchPackId = searchParams.get("pack_id") || "";
  const [initializing, setInitializing] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [packs, setPacks] = useState<LessonPack[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedPackId, setSelectedPackId] = useState("");
  const [activePack, setActivePack] = useState<LessonPack | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [courseForm, setCourseForm] = useState<CourseFormInput>(emptyCourseForm());
  const [savingCourse, setSavingCourse] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState(false);
  const [deletingPackId, setDeletingPackId] = useState("");

  const teacherCourses = useMemo(() => {
    if (!user || user.role !== "teacher") return [];
    return courses.filter((item) => !item.owner_user_id || item.owner_user_id === user.id);
  }, [courses, user]);

  const packsByCourse = useMemo(() => {
    const next = new Map<string, LessonPack[]>();
    for (const item of packs) {
      const list = next.get(item.course_id) || [];
      list.push(item);
      next.set(item.course_id, list);
    }
    for (const [courseId, list] of next.entries()) {
      list.sort((a, b) => sortByCreatedAtDesc(a.created_at, b.created_at));
      next.set(courseId, list);
    }
    return next;
  }, [packs]);

  const selectedCourse = useMemo(
    () => teacherCourses.find((item) => item.id === selectedCourseId) || null,
    [selectedCourseId, teacherCourses],
  );

  const packsForSelectedCourse = useMemo(
    () => (selectedCourseId ? packsByCourse.get(selectedCourseId) || [] : []),
    [packsByCourse, selectedCourseId],
  );

  const recentPacks = useMemo(
    () => [...packs].sort((a, b) => sortByCreatedAtDesc(a.created_at, b.created_at)).slice(0, 8),
    [packs],
  );

  useEffect(() => {
    setCourseForm(selectedCourse ? getCourseFormInput(selectedCourse) : emptyCourseForm());
  }, [selectedCourse]);

  const refreshHubData = useCallback(
    async (preferredCourseId?: string, preferredPackId?: string) => {
      const [courseList, packList] = await Promise.all([
        api.listCourses().catch(() => []),
        api.listLessonPacks().catch(() => []),
      ]);
      const visibleCourses =
        !user || user.role !== "teacher"
          ? courseList
          : courseList.filter((item) => !item.owner_user_id || item.owner_user_id === user.id);
      const visibleCourseIds = new Set(visibleCourses.map((item) => item.id));
      const visiblePacks = [...packList]
        .filter((item) => visibleCourseIds.has(item.course_id))
        .sort((a, b) => sortByCreatedAtDesc(a.created_at, b.created_at));

      setCourses(courseList);
      setPacks(visiblePacks);

      const nextCourseId = (preferredCourseId ?? searchCourseId) || selectedCourseId || visibleCourses[0]?.id || "";
      const nextCoursePacks = visiblePacks.filter((item) => item.course_id === nextCourseId);
      const nextPackId = (preferredPackId ?? searchPackId) || selectedPackId || nextCoursePacks[0]?.id || "";

      setSelectedCourseId(nextCourseId);
      setSelectedPackId(nextPackId);
      setActivePack(visiblePacks.find((item) => item.id === nextPackId) || nextCoursePacks[0] || null);
    },
    [searchCourseId, searchPackId, selectedCourseId, selectedPackId, user],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== "teacher") {
      router.push("/");
      return;
    }
    let alive = true;
    setInitializing(true);
    refreshHubData(searchCourseId, searchPackId)
      .catch((error) => {
        if (!alive) return;
        setErrorMessage(error instanceof Error ? error.message : pick(language, "课程包管理页加载失败。", "Failed to load the lesson-pack manager."));
      })
      .finally(() => {
        if (alive) setInitializing(false);
      });
    return () => {
      alive = false;
    };
  }, [authLoading, language, refreshHubData, router, searchCourseId, searchPackId, user]);

  useEffect(() => {
    if (!selectedCourseId) return;
    const nextCoursePacks = packsByCourse.get(selectedCourseId) || [];
    if (selectedPackId && nextCoursePacks.some((item) => item.id === selectedPackId)) return;
    const nextPack = nextCoursePacks[0] || null;
    setSelectedPackId(nextPack?.id || "");
    setActivePack(nextPack);
  }, [packsByCourse, selectedCourseId, selectedPackId]);

  useEffect(() => {
    if (!selectedPackId) {
      setActivePack(packsForSelectedCourse[0] || null);
      return;
    }
    const nextPack = packs.find((item) => item.id === selectedPackId) || null;
    if (nextPack) setActivePack(nextPack);
  }, [packs, packsForSelectedCourse, selectedPackId]);

  const handlePublish = async () => {
    if (!activePack) return;
    setPublishing(true);
    try {
      const updated = await api.publishLessonPack(activePack.id);
      setActivePack(updated);
      setPacks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } finally {
      setPublishing(false);
    }
  };

  const handleSelectCourse = (courseId: string) => {
    const nextPack = (packsByCourse.get(courseId) || [])[0] || null;
    setSelectedCourseId(courseId);
    setSelectedPackId(nextPack?.id || "");
    setActivePack(nextPack);
    syncQuery(router, courseId, nextPack?.id);
  };

  const handlePreviewPack = (pack: LessonPack) => {
    setSelectedCourseId(pack.course_id);
    setSelectedPackId(pack.id);
    setActivePack(pack);
    syncQuery(router, pack.course_id, pack.id);
  };

  const handleSaveCourse = async () => {
    if (!selectedCourse) return;
    setSavingCourse(true);
    setErrorMessage("");
    try {
      const updated = await api.updateCourse(selectedCourse.id, {
        name: courseForm.name.trim(),
        audience: courseForm.audience.trim(),
        class_name: courseForm.class_name.trim(),
        student_level: courseForm.student_level.trim(),
        chapter: courseForm.chapter.trim(),
        objectives: courseForm.objectives.trim(),
        duration_minutes: Number(courseForm.duration_minutes) || 90,
        frontier_direction: courseForm.frontier_direction.trim(),
      });
      setCourses((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setCourseForm(getCourseFormInput(updated));
      await refreshHubData(updated.id, selectedPackId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : pick(language, "课程更新失败。", "Failed to update the course."));
    } finally {
      setSavingCourse(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!selectedCourse) return;
    const confirmed = window.confirm(
      pick(
        language,
        `确认删除课程“${selectedCourse.name}”吗？这会同时删除该课程下的课程包和主要关联记录，此操作不可撤销。`,
        `Delete course "${selectedCourse.name}"? This also removes its lesson packs and major related records. This cannot be undone.`,
      ),
    );
    if (!confirmed) return;
    setDeletingCourse(true);
    setErrorMessage("");
    try {
      await api.deleteCourse(selectedCourse.id);
      const remainingCourses = teacherCourses.filter((item) => item.id !== selectedCourse.id);
      const nextCourseId = remainingCourses[0]?.id || "";
      await refreshHubData(nextCourseId || "", "");
      syncQuery(router, nextCourseId || undefined, undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : pick(language, "课程删除失败。", "Failed to delete the course."));
    } finally {
      setDeletingCourse(false);
    }
  };

  const handleDeletePack = async (pack: LessonPack) => {
    const confirmed = window.confirm(
      pick(
        language,
        `确认删除课程包 v${pack.version} 吗？该版本的问答日志与反馈关联也会一并清理。`,
        `Delete lesson pack v${pack.version}? Related logs and feedback links for this version will also be cleaned up.`,
      ),
    );
    if (!confirmed) return;
    setDeletingPackId(pack.id);
    setErrorMessage("");
    try {
      await api.deleteLessonPack(pack.id);
      const remainingCoursePacks = packsForSelectedCourse.filter((item) => item.id !== pack.id);
      const nextPackId = remainingCoursePacks[0]?.id || "";
      setPacks((prev) => prev.filter((item) => item.id !== pack.id));
      setSelectedPackId(nextPackId);
      setActivePack(remainingCoursePacks[0] || null);
      await refreshHubData(pack.course_id, nextPackId);
      syncQuery(router, pack.course_id, nextPackId || undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : pick(language, "课程包删除失败。", "Failed to delete the lesson pack."));
    } finally {
      setDeletingPackId("");
    }
  };

  if (!user || user.role !== "teacher") {
    return <main className="px-6 py-24 text-center text-slate-500">{pick(language, "正在进入课程包管理页...", "Opening the lesson-pack manager...")}</main>;
  }

  return (
    <WorkspacePage tone="teacher">
      <WorkspaceHero
        tone="teacher"
        eyebrow={pick(language, "课程包管理", "Lesson Pack Manager")}
        title={<h1>{pick(language, "集中管理课程包版本", "Manage lesson-pack versions in one place")}</h1>}
        description={
          <p>
            {pick(
              language,
              "这里负责课程包的历史查看、预览、发布和删除；新的内容生成统一前往 PPT / 教案生成页完成。",
              "This page handles lesson-pack history, preview, publishing, and deletion. New content generation happens in the PPT workspace.",
            )}
          </p>
        }
        actions={
          <div className="workspace-inline-actions">
            <Link href="/teacher/course" className="button-primary rounded-full px-5 py-3 text-sm font-semibold">
              {pick(language, "新建课程画像", "Create Course Profile")}
            </Link>
            <Link href="/teacher" className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
              {pick(language, "返回教师工作台", "Back to Workspace")}
            </Link>
          </div>
        }
      />

      {initializing ? (
        <WorkspaceSection tone="teacher" title={pick(language, "正在加载课程与课程包...", "Loading courses and lesson packs...")}>
          <div className="py-12 text-center text-slate-500">{pick(language, "正在加载课程与课程包...", "Loading courses and lesson packs...")}</div>
        </WorkspaceSection>
      ) : null}

      {!initializing && teacherCourses.length === 0 ? (
        <WorkspaceSection tone="teacher" title={pick(language, "还没有可用课程", "No courses yet")}>
          <div className="empty-state">
            {pick(language, "先创建课程画像，再进入内容生成与课程包管理。", "Create a course profile first, then continue to content generation and lesson-pack management.")}
          </div>
        </WorkspaceSection>
      ) : null}

      {errorMessage ? (
        <WorkspaceSection tone="teacher" title={pick(language, "出现了一点问题", "Something went wrong")}>
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-7 text-rose-700">{errorMessage}</div>
        </WorkspaceSection>
      ) : null}

      {teacherCourses.length > 0 ? (
        <WorkspaceSection
          tone="teacher"
          eyebrow={pick(language, "课程入口", "Courses")}
          title={pick(language, "先选课程，再查看对应的课程包历史", "Choose a course and inspect its lesson-pack history")}
          description={pick(language, "生成动作已统一收口到 PPT 生成与材料升级页，这里只保留课程包管理入口。", "Generation has been centralized in the PPT generation and material-upgrade workspace. This page only keeps lesson-pack management actions.")}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {teacherCourses.map((course) => {
              const coursePacks = packsByCourse.get(course.id) || [];
              const latestPack = coursePacks[0] || null;
              const isActive = course.id === selectedCourseId;
              return (
                <section
                  key={course.id}
                  className={`rounded-[28px] border px-5 py-5 ${isActive ? "border-[var(--role-edge)] bg-white shadow-[0_22px_50px_rgba(15,23,42,0.08)]" : "border-slate-200 bg-white/80"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{course.class_name || pick(language, "课程", "Course")}</p>
                      <h3 className="text-xl font-bold text-slate-900">{course.name}</h3>
                      <p className="text-sm leading-7 text-slate-600">
                        {course.chapter || pick(language, "未填写章节", "No chapter yet")}
                        {" · "}
                        {course.frontier_direction || pick(language, "未填写前沿方向", "No frontier topic yet")}
                      </p>
                    </div>
                    <button onClick={() => handleSelectCourse(course.id)} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
                      {isActive ? pick(language, "当前查看中", "Viewing") : pick(language, "切换到这门课", "Select")}
                    </button>
                  </div>
                  <div className="mt-5">
                    <SignalStrip
                      tone="teacher"
                      items={[
                        { label: pick(language, "课程包数量", "Pack Count"), value: coursePacks.length, note: pick(language, "会持续保留历史生成结果。", "Historical results remain available.") },
                        { label: pick(language, "最新版本", "Latest Version"), value: latestPack ? `v${latestPack.version}` : "-", note: latestPack ? formatDateTime(latestPack.created_at, language) : pick(language, "还没有课程包记录", "No lesson-pack history yet") },
                        { label: pick(language, "最新状态", "Latest Status"), value: latestPack ? formatPackStatus(latestPack.status, language) : pick(language, "未生成", "Not generated"), note: latestPack?.payload ? getFrontierTopicName(latestPack.payload, language) : pick(language, "生成完成后会在这里保留入口", "A reusable entry appears here after generation") },
                      ]}
                    />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href={`/teacher/material-update?course_id=${course.id}&generation_mode=generate_new&target_format=ppt`} className="button-primary rounded-full px-5 py-3 text-sm font-semibold">
                      {pick(language, "前往内容生成", "Go to Content Generation")}
                    </Link>
                    {latestPack ? (
                      <Link href={`/teacher/lesson-pack/${latestPack.id}`} className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
                        {pick(language, "打开最新详情", "Open Latest Details")}
                      </Link>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </WorkspaceSection>
      ) : null}

      {selectedCourse ? (
        <WorkspaceSection
          tone="teacher"
          eyebrow={pick(language, "课程管理", "Course Management")}
          title={pick(language, "编辑当前课程信息", "Edit the current course")}
          description={pick(language, "这里修改的是课程画像本身，后续新的生成结果会直接使用更新后的课程信息。", "These edits update the course profile itself, and later generations will use the refreshed course information.")}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">{pick(language, "课程名称", "Course Name")}</span>
              <input value={courseForm.name} onChange={(event) => setCourseForm((prev) => ({ ...prev, name: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">{pick(language, "授课对象", "Audience")}</span>
              <input value={courseForm.audience} onChange={(event) => setCourseForm((prev) => ({ ...prev, audience: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">{pick(language, "授课班级", "Class")}</span>
              <input value={courseForm.class_name} onChange={(event) => setCourseForm((prev) => ({ ...prev, class_name: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">{pick(language, "学生水平", "Student Level")}</span>
              <input value={courseForm.student_level} onChange={(event) => setCourseForm((prev) => ({ ...prev, student_level: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">{pick(language, "当前章节", "Current Chapter")}</span>
              <input value={courseForm.chapter} onChange={(event) => setCourseForm((prev) => ({ ...prev, chapter: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">{pick(language, "课程时长（分钟）", "Duration (minutes)")}</span>
              <input type="number" min={1} value={courseForm.duration_minutes} onChange={(event) => setCourseForm((prev) => ({ ...prev, duration_minutes: Number(event.target.value) || 90 }))} />
            </label>
            <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
              <span className="font-semibold">{pick(language, "课程目标", "Learning Goals")}</span>
              <textarea rows={4} value={courseForm.objectives} onChange={(event) => setCourseForm((prev) => ({ ...prev, objectives: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
              <span className="font-semibold">{pick(language, "前沿方向", "Frontier Topic")}</span>
              <input value={courseForm.frontier_direction} onChange={(event) => setCourseForm((prev) => ({ ...prev, frontier_direction: event.target.value }))} />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => void handleSaveCourse()} disabled={savingCourse} className="button-primary rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60">
              {savingCourse ? pick(language, "保存中...", "Saving...") : pick(language, "保存课程修改", "Save Course Changes")}
            </button>
            <button onClick={() => void handleDeleteCourse()} disabled={deletingCourse} className="rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 disabled:opacity-60">
              {deletingCourse ? pick(language, "删除中...", "Deleting...") : pick(language, "删除当前课程", "Delete Course")}
            </button>
          </div>
        </WorkspaceSection>
      ) : null}

      {selectedCourse ? (
        <WorkspaceSection
          tone="teacher"
          eyebrow={pick(language, "历史版本", "Version History")}
          title={`${selectedCourse.name} ${pick(language, "的课程包历史", "lesson-pack history")}`}
          description={pick(language, "每次生成都会保留一条可回看的结果，这里只负责历史管理与版本切换。", "Every generation leaves a reusable result. This page focuses on history management and version switching.")}
        >
          {packsForSelectedCourse.length === 0 ? (
            <div className="empty-state">
              {pick(language, "这门课还没有课程包记录，可以先去内容生成页开始第一版。", "This course has no lesson-pack history yet. Start the first version from the content generation workspace.")}
            </div>
          ) : (
            <div className="grid gap-4">
              {packsForSelectedCourse.map((item) => {
                const isCurrent = item.id === activePack?.id;
                return (
                  <section
                    key={item.id}
                    className={`rounded-[26px] border px-5 py-5 ${isCurrent ? "border-[var(--role-edge)] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]" : "border-slate-200 bg-white/80"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-bold text-slate-900">{getFrontierTopicName(item.payload, language)}</h3>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {formatPackStatus(item.status, language)}
                          </span>
                          {isCurrent ? <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">{pick(language, "当前预览", "Previewing")}</span> : null}
                        </div>
                        <p className="text-sm leading-7 text-slate-600">
                          {pick(language, "版本", "Version")} v{item.version}
                          {" · "}
                          {formatDateTime(item.created_at, language)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button onClick={() => handlePreviewPack(item)} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
                          {pick(language, "在下方预览", "Preview Below")}
                        </button>
                        <Link href={`/teacher/lesson-pack/${item.id}`} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
                          {pick(language, "打开详情页", "Open Details")}
                        </Link>
                        <button
                          onClick={() => void handleDeletePack(item)}
                          disabled={deletingPackId === item.id}
                          className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"
                        >
                          {deletingPackId === item.id ? pick(language, "删除中...", "Deleting...") : pick(language, "删除版本", "Delete Version")}
                        </button>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </WorkspaceSection>
      ) : null}

      {activePack ? (
        <>
          <WorkspaceSection
            tone="teacher"
            eyebrow={pick(language, "当前预览", "Current Preview")}
            title={`${getFrontierTopicName(activePack.payload, language)} (${pick(language, `第 ${activePack.version} 版`, `Version ${activePack.version}`)})`}
            description={`${pick(language, "当前状态：", "Status: ")}${formatPackStatus(activePack.status, language)}`}
            actions={
              <div className="workspace-inline-actions">
                <button
                  onClick={handlePublish}
                  disabled={publishing || activePack.status === "published"}
                  className="button-primary rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60"
                >
                  {activePack.status === "published"
                    ? pick(language, "已发布给学生", "Published to Students")
                    : publishing
                      ? pick(language, "发布中...", "Publishing...")
                      : pick(language, "发布当前版本", "Publish This Version")}
                </button>
                <Link href={`/teacher/material-update?course_id=${activePack.course_id}&generation_mode=generate_new&target_format=ppt`} className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
                  {pick(language, "前往内容生成", "Go to Content Generation")}
                </Link>
                <Link href={`/teacher/lesson-pack/${activePack.id}`} className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
                  {pick(language, "查看完整详情", "View Full Details")}
                </Link>
              </div>
            }
          >
            <SignalStrip
              tone="teacher"
              items={[
                { label: pick(language, "所属课程", "Course"), value: selectedCourse?.name || activePack.course_id, note: selectedCourse?.chapter || pick(language, "可随时回到历史列表切换版本。", "You can switch versions from the history list at any time.") },
                { label: pick(language, "版本号", "Version"), value: activePack.version, note: pick(language, "同一门课会沿着版本持续累积。", "Versions accumulate within the same course.") },
                { label: pick(language, "状态", "Status"), value: formatPackStatus(activePack.status, language), note: pick(language, "当前页只负责预览、发布和管理。", "This page focuses on preview, publishing, and management.") },
              ]}
            />
          </WorkspaceSection>
          <EnhancedPackSummary payload={activePack.payload as Record<string, unknown>} language={language} />
        </>
      ) : null}

      {!selectedCourse && recentPacks.length > 0 ? (
        <WorkspaceSection
          tone="teacher"
          eyebrow={pick(language, "最近记录", "Recent")}
          title={pick(language, "最近生成的课程包", "Recently generated lesson packs")}
          description={pick(language, "如果你是从别的入口回来，也可以直接从这里继续查看。", "If you returned from another entry point, you can continue from here.")}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {recentPacks.map((item) => (
              <button
                key={item.id}
                onClick={() => handlePreviewPack(item)}
                className="rounded-[24px] border border-slate-200 bg-white/80 px-5 py-5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
              >
                <p className="text-sm font-semibold text-slate-900">{getFrontierTopicName(item.payload, language)}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {pick(language, "课程", "Course")} ID: {item.course_id}
                  {" · "}
                  v{item.version}
                </p>
              </button>
            ))}
          </div>
        </WorkspaceSection>
      ) : null}
    </WorkspacePage>
  );
}

type CourseFormInput = Omit<Course, "id" | "owner_user_id" | "created_at">;

function emptyCourseForm(): CourseFormInput {
  return {
    name: "",
    audience: "",
    class_name: "",
    student_level: "",
    chapter: "",
    objectives: "",
    duration_minutes: 90,
    frontier_direction: "",
  };
}

function getCourseFormInput(course: Course): CourseFormInput {
  return {
    name: course.name,
    audience: course.audience,
    class_name: course.class_name,
    student_level: course.student_level,
    chapter: course.chapter,
    objectives: course.objectives,
    duration_minutes: course.duration_minutes,
    frontier_direction: course.frontier_direction,
  };
}

function syncQuery(router: ReturnType<typeof useRouter>, courseId?: string, packId?: string) {
  const query = new URLSearchParams();
  if (courseId) query.set("course_id", courseId);
  if (packId) query.set("pack_id", packId);
  router.replace(`/teacher/lesson-pack${query.toString() ? `?${query.toString()}` : ""}`);
}

function sortByCreatedAtDesc(a: string, b: string) {
  return new Date(b).getTime() - new Date(a).getTime();
}

function formatPackStatus(status: string, language: "zh-CN" | "en-US") {
  if (status === "published") return pick(language, "已发布", "Published");
  if (status === "draft") return pick(language, "草稿", "Draft");
  return status;
}

function formatDateTime(value: string, language: "zh-CN" | "en-US") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "en-US" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getFrontierTopicName(payload: Record<string, unknown>, language: "zh-CN" | "en-US") {
  const frontierTopic = payload.frontier_topic;
  if (frontierTopic && typeof frontierTopic === "object" && typeof (frontierTopic as Record<string, unknown>).name === "string") {
    return String((frontierTopic as Record<string, unknown>).name);
  }
  return pick(language, "未命名课程包", "Untitled lesson pack");
}

function EnhancedPackSummary({ payload, language }: { payload: Record<string, unknown>; language: "zh-CN" | "en-US" }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section title={pick(language, "教学目标", "Teaching Goals")} items={toDisplayList(payload.teaching_objectives)} />
      <Section title={pick(language, "先修要求", "Prerequisites")} items={toDisplayList(payload.prerequisites)} />
      <Section title={pick(language, "班级画像", "Class Profile")} items={formatClassProfileDisplay(payload.class_profile, language)} />
      <Section title={pick(language, "学习诊断", "Learning Diagnostics")} items={toDisplayList(payload.learning_diagnostics)} />
      <Section title={pick(language, "本节主线", "Main Thread")} text={typeof payload.main_thread === "string" ? payload.main_thread : ""} full />
      <Section title={pick(language, "关键概念", "Key Concepts")} items={toDisplayList(payload.key_concepts)} />
      <Section title={pick(language, "教学难点", "Teaching Difficulties")} items={toDisplayList(payload.teaching_difficulties)} />
      <Section title={pick(language, "时间分配", "Time Allocation")} items={formatTimeAllocationDisplay(payload.time_allocation, language)} full />
      <Section title={pick(language, "环节设计", "Segment Plan")} items={toDisplayList(payload.segment_plan)} full />
      <Section title={pick(language, "互动设计", "Interaction Plan")} items={toDisplayList(payload.interaction_plan)} />
      <Section title={pick(language, "评价设计", "Assessment Plan")} items={toDisplayList(payload.assessment_plan)} />
      <Section title={pick(language, "课件大纲", "Slides Outline")} items={toDisplayList(payload.ppt_outline)} ordered full />
      <Section title={pick(language, "分层支持", "Differentiated Support")} items={formatStructuredGroupsDisplay(payload.differentiation_support, language)} full />
      <Section title={pick(language, "讨论题", "Discussion Questions")} items={toDisplayList(payload.discussion_questions)} />
      <Section title={pick(language, "课后任务", "After-class Tasks")} items={toDisplayList(payload.after_class_tasks)} />
    </div>
  );
}

function Section({ title, text, items, ordered, full }: { title: string; text?: string; items?: string[]; ordered?: boolean; full?: boolean }) {
  if (!text && (!items || items.length === 0)) return null;
  return (
    <WorkspaceSection tone="teacher" className={full ? "md:col-span-2" : ""} title={title}>
      {text ? <p className="text-sm leading-7 text-slate-600">{text}</p> : null}
      {items ? (
        <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
          {items.map((item, index) => (
            <li key={`${index}-${item}`} className="rounded-2xl bg-white/80 px-4 py-3">
              {ordered ? `${index + 1}. ` : ""}
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </WorkspaceSection>
  );
}

function toDisplayList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") return JSON.stringify(item);
        return String(item ?? "");
      })
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }
  return [];
}

function formatClassProfileDisplay(value: unknown, language: "zh-CN" | "en-US"): string[] {
  if (!value || typeof value !== "object") return [];
  const profile = value as Record<string, unknown>;
  const strengths = toDisplayList(profile.likely_strengths).join(language === "en-US" ? "; " : "；");
  const risks = toDisplayList(profile.likely_risks).join(language === "en-US" ? "; " : "；");
  return [
    profile.audience ? `${pick(language, "授课对象", "Audience")}${language === "en-US" ? ": " : "："}${profile.audience}` : "",
    profile.current_level ? `${pick(language, "当前水平", "Current Level")}${language === "en-US" ? ": " : "："}${profile.current_level}` : "",
    strengths ? `${pick(language, "可能优势", "Likely Strengths")}${language === "en-US" ? ": " : "："}${strengths}` : "",
    risks ? `${pick(language, "潜在风险", "Likely Risks")}${language === "en-US" ? ": " : "："}${risks}` : "",
  ].filter(Boolean);
}

function formatStructuredGroupsDisplay(value: unknown, language: "zh-CN" | "en-US"): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const labels =
    language === "en-US"
      ? { foundation: "Foundation", advanced: "Advanced", support_for_struggling: "Support for Struggling Students" }
      : { foundation: "基础支持", advanced: "拔高支持", support_for_struggling: "薄弱学生支持" };
  return Object.entries(labels)
    .map(([key, label]) => {
      const items = toDisplayList(record[key]);
      if (!items.length) return "";
      return `${label}${language === "en-US" ? ": " : "："}${items.join(language === "en-US" ? "; " : "；")}`;
    })
    .filter(Boolean);
}

function formatTimeAllocationDisplay(value: unknown, language: "zh-CN" | "en-US"): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const segment = typeof record.segment === "string" ? record.segment : "";
          const minutes = record.minutes;
          const objective = typeof record.objective === "string" ? record.objective : "";
          if (segment && minutes !== undefined && minutes !== null && String(minutes).trim()) {
            const base = language === "en-US" ? `${segment}: ${minutes} min` : `${segment}：${minutes} 分钟`;
            return objective ? `${base}${language === "en-US" ? " | Goal: " : "｜目标："}${objective}` : base;
          }
          return JSON.stringify(record);
        }
        return String(item ?? "");
      })
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => (language === "en-US" ? `${key}: ${item}` : `${key}：${item}`));
  }
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }
  return [];
}
