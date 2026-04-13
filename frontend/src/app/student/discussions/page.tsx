"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DiscussionWorkspace } from "@/components/discussion-workspace";
import { useAuth } from "@/components/auth-provider";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { WorkspaceSection } from "@/components/workspace-panels";

export default function StudentDiscussionsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/");
  }, [loading, user, router]);

  if (!user || user.role !== "student") {
    return (
      <WorkspacePage tone="student">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">正在加载课程讨论空间...</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="student" className="space-y-5">
      <WorkspaceHero
        tone="student"
        eyebrow="课程讨论空间"
        title="参与课程讨论，沉淀问题与观点"
        description="学生端讨论空间继续保留原有论坛式交互，但现在与整个学习工作区的节奏和移动端结构保持一致。"
      />
      <WorkspaceSection
        tone="student"
        title="讨论工作区"
        description="这里保留原有发帖、浏览、搜索和互动流程。"
      >
        <DiscussionWorkspace user={user} />
      </WorkspaceSection>
    </WorkspacePage>
  );
}
