"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DiscussionWorkspace } from "@/components/discussion-workspace";
import { useAuth } from "@/components/auth-provider";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { WorkspaceSection } from "@/components/workspace-panels";

export default function TeacherDiscussionsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) router.push("/");
  }, [loading, user, router]);

  if (!user || user.role !== "teacher") {
    return (
      <WorkspacePage tone="teacher">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">正在加载课程讨论空间...</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="teacher" className="space-y-5">
      <WorkspaceHero
        tone="teacher"
        eyebrow="课程讨论空间"
        title="围绕课程话题管理讨论、公告和追问"
        description="教师端讨论空间继续保留原有交互能力，但统一纳入新的工作台结构，在移动端会自动收敛为更聚焦的单列流。"
      />
      <WorkspaceSection
        tone="teacher"
        title="讨论工作区"
        description="这里保留原有的讨论广场、发帖、筛选与互动能力。"
      >
        <DiscussionWorkspace user={user} />
      </WorkspaceSection>
    </WorkspacePage>
  );
}
