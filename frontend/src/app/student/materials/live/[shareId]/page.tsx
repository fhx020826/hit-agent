"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LiveAnnotationBoard } from "@/components/live-annotation-board";
import { useAuth } from "@/components/auth-provider";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { WorkspaceSection } from "@/components/workspace-panels";
import { api, type LiveShareRecord, type MaterialItem } from "@/lib/api";

export default function StudentLiveMaterialPage() {
  const params = useParams<{ shareId: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
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
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">正在接入教师课堂共享...</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="student" className="space-y-5">
      <WorkspaceHero
        tone="student"
        eyebrow="课堂同步展示"
        title={material?.filename || "课堂共享内容"}
        description="学生端在这里跟随教师的课堂同步展示查看共享内容，翻页和批注状态会实时同步。"
      />
      <WorkspaceSection tone="student" title="同步查看区" description="实时展示逻辑保持不变，只切换到统一的学习工作区框架。">
        <LiveAnnotationBoard share={share} material={material} teacherMode={false} />
      </WorkspaceSection>
    </WorkspacePage>
  );
}
