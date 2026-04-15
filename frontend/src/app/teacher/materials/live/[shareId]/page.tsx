"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LiveAnnotationBoard } from "@/components/live-annotation-board";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { WorkspaceSection } from "@/components/workspace-panels";
import { api, type LiveShareRecord, type MaterialItem } from "@/lib/api";
import { pick } from "@/lib/i18n";

export default function TeacherLiveMaterialPage() {
  const params = useParams<{ shareId: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const [share, setShare] = useState<LiveShareRecord | null>(null);
  const [material, setMaterial] = useState<MaterialItem | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!params.shareId) return;
    api.listCourses().then(async (courses) => {
      for (const course of courses) {
        const current = await api.getCurrentLiveShare(course.id).catch(() => null);
        if (current?.id === params.shareId) {
          setShare(current);
          const materials = await api.listMaterials(course.id).catch(() => []);
          setMaterial(materials.find((item) => item.id === current.material_id) || null);
          break;
        }
      }
    }).catch(() => undefined);
  }, [params.shareId]);

  if (!user || user.role !== "teacher" || !share) {
    return (
      <WorkspacePage tone="teacher">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载课堂展示...", "Loading live classroom view...")}</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="teacher" className="space-y-5">
      <WorkspaceHero
        tone="teacher"
        eyebrow={pick(language, "课堂同步展示", "Live Class View")}
        title={material?.filename || pick(language, "课堂共享展示", "Live Shared Material")}
        description={pick(language, "教师在这里控制翻页与批注。结束共享后可保存批注版，或直接丢弃本轮临时标记。", "Control paging and annotation here. When the session ends, keep the annotated version or discard this round of marks.")}
      />
      <WorkspaceSection
        tone="teacher"
        title={pick(language, "课堂控制", "Classroom Controls")}
        actions={(
          <div className="workspace-inline-actions">
            <button onClick={async () => { setClosing(true); await api.endLiveShare(share.id, { save_mode: "save", version_name: pick(language, "课堂批注保存版", "Saved annotated classroom version") }); router.push("/teacher/materials"); }} disabled={closing} className="button-primary rounded-full px-5 py-3 text-sm font-semibold">{pick(language, "结束共享并保存批注", "End and Save Annotations")}</button>
            <button onClick={async () => { setClosing(true); await api.endLiveShare(share.id, { save_mode: "discard" }); router.push("/teacher/materials"); }} disabled={closing} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">{pick(language, "结束共享不保存", "End Without Saving")}</button>
          </div>
        )}
        description={pick(language, "实时展示区保留原有批注与同步逻辑，只更新页面外层结构。", "The live viewer keeps its annotation and sync logic while the outer page follows the unified layout.")}
      >
        <LiveAnnotationBoard share={share} material={material} teacherMode />
      </WorkspaceSection>
    </WorkspacePage>
  );
}
