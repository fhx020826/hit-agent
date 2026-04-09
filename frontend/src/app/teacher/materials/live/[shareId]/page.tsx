"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LiveAnnotationBoard } from "@/components/live-annotation-board";
import { useAuth } from "@/components/auth-provider";
import { api, type LiveShareRecord, type MaterialItem } from "@/lib/api";

export default function TeacherLiveMaterialPage() {
  const params = useParams<{ shareId: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
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
    return <main className="section-card rounded-[28px] p-8 text-center text-slate-500">正在加载课堂展示...</main>;
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-3">
        <button onClick={async () => { setClosing(true); await api.endLiveShare(share.id, { save_mode: "save", version_name: "课堂批注保存版" }); router.push("/teacher/materials"); }} disabled={closing} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">结束共享并保存批注</button>
        <button onClick={async () => { setClosing(true); await api.endLiveShare(share.id, { save_mode: "discard" }); router.push("/teacher/materials"); }} disabled={closing} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">结束共享不保存</button>
      </div>
      <LiveAnnotationBoard share={share} material={material} teacherMode />
    </div>
  );
}
