"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DiscussionWorkspace } from "@/components/discussion-workspace";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { WorkspaceSection } from "@/components/workspace-panels";
import { pick } from "@/lib/i18n";

export default function StudentDiscussionsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/");
  }, [loading, user, router]);

  if (!user || user.role !== "student") {
    return (
      <WorkspacePage tone="student">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载课程讨论空间...", "Loading discussion spaces...")}</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="student" className="space-y-5">
      <WorkspaceHero
        tone="student"
        eyebrow={pick(language, "课程讨论空间", "Discussion Spaces")}
        title={<h2>{pick(language, "参与课程讨论，整理问题与观点", "Join course discussions and collect ideas")}</h2>}
        description={pick(language, "这里保留课程讨论、发帖和互动。", "Use this space for course discussion, posting, and interaction.")}
      />
      <WorkspaceSection
        tone="student"
        title={pick(language, "讨论工作区", "Discussion Workspace")}
        description={pick(language, "继续查看帖子、搜索消息和参与互动。", "Browse posts, search messages, and keep the discussion moving.")}
      >
        <DiscussionWorkspace user={user} />
      </WorkspaceSection>
    </WorkspacePage>
  );
}
