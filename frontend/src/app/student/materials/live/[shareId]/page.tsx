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

export default function StudentLiveMaterialPage() {
  const params = useParams<{ shareId: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const [share, setShare] = useState<LiveShareRecord | null>(null);
  const [material, setMaterial] = useState<MaterialItem | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/");
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

  if (!user || user.role !== "student" || !share) {
    return (
      <WorkspacePage tone="student">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在接入教师课堂共享...", "Connecting to the teacher's live class...")}</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="student" className="space-y-5">
      <WorkspaceHero
        tone="student"
        eyebrow={pick(language, "课堂同步展示", "Live Class View")}
        title={material?.filename || pick(language, "课堂共享内容", "Shared Classroom Content")}
        description={pick(language, "跟随教师查看同步展示内容，页码和批注会实时更新。", "Follow the teacher's live presentation with real-time page and annotation updates.")}
      />
      <WorkspaceSection tone="student" title={pick(language, "同步查看区", "Synchronized Viewer")} description={pick(language, "实时展示逻辑保持不变，只切换到统一工作区外层。", "The live sync behavior stays the same inside the unified workspace shell.")}>
        <LiveAnnotationBoard share={share} material={material} teacherMode={false} />
      </WorkspaceSection>
    </WorkspacePage>
  );
}
