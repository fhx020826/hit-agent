"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DiscussionWorkspace } from "@/components/discussion-workspace";
import { useAuth } from "@/components/auth-provider";

export default function StudentDiscussionsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/");
  }, [loading, user, router]);

  if (!user || user.role !== "student") {
    return <main className="section-card rounded-[28px] p-8 text-center text-slate-500">正在加载课程讨论空间...</main>;
  }

  return <DiscussionWorkspace user={user} />;
}
