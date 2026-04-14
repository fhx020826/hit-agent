"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DiscussionWorkspace } from "@/components/discussion-workspace";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { WorkspaceSection } from "@/components/workspace-panels";
import { pick } from "@/lib/i18n";

export default function TeacherDiscussionsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) router.push("/");
  }, [loading, user, router]);

  if (!user || user.role !== "teacher") {
    return (
      <WorkspacePage tone="teacher">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载课程讨论空间...", "Loading discussion spaces...")}</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="teacher" className="space-y-5">
      <WorkspaceHero
        tone="teacher"
        eyebrow={pick(language, "课程讨论空间", "Discussion Spaces")}
        title={pick(language, "围绕课程管理讨论与公告", "Manage course discussions and notices")}
        description={pick(language, "统一查看帖子、互动和追问。", "Review posts, interactions, and follow-up questions in one place.")}
      />
      <WorkspaceSection
        tone="teacher"
        title={pick(language, "讨论工作区", "Discussion Workspace")}
        description={pick(language, "继续处理讨论、筛选和互动。", "Keep working with discussions, filters, and interactions here.")}
      >
        <DiscussionWorkspace user={user} />
      </WorkspaceSection>
    </WorkspacePage>
  );
}
