"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, API_BASE, type AssignmentStudentView } from "@/lib/api";

export default function StudentAssignmentsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<AssignmentStudentView[]>([]);
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File[]>>({});
  const [submittingId, setSubmittingId] = useState("");

  const reload = async () => {
    setItems(await api.listStudentAssignments());
  };

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || user.role !== "student") return;
    reload().catch(() => setItems([]));
  }, [user]);

  if (!user || user.role !== "student") {
    return (
      <WorkspacePage tone="student">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">正在加载作业任务中心...</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="student" className="space-y-5">
    <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
      <div className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold text-slate-500">作业任务中心</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">确认收到、上传提交并查看 AI 初步反馈</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">作业提交与本人账号绑定。若教师开启 AI 辅助反馈，系统会生成结构性、逻辑性和规范性建议，最终评分仍由教师决定。</p>
      </div>

      <div className="mt-6 space-y-5">
        {items.length === 0 ? <div className="section-card rounded-[28px] p-8 text-center text-slate-500">当前还没有可见作业任务。</div> : items.map((item) => (
          <div key={item.assignment.id} className="section-card rounded-[28px] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{item.assignment.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.assignment.description}</p>
                <p className="mt-2 text-xs text-slate-500">截止时间：{item.assignment.deadline} · 面向班级：{item.assignment.target_class || "全体学生"}</p>
              </div>
              <div className="rounded-[22px] bg-white/70 px-4 py-3 text-sm leading-7 text-slate-600">
                <p>确认状态：{item.receipt.confirmed ? "已确认收到" : "未确认"}</p>
                <p>提交状态：{item.submission ? `已提交（${item.submission.submitted_at}）` : "未提交"}</p>
                <p>是否允许补交：{item.assignment.allow_resubmit ? "是" : "否"}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {!item.receipt.confirmed ? <button onClick={() => api.confirmAssignment(item.assignment.id).then(() => reload())} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">确认收到</button> : null}
              <label className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                选择提交文件
                <input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setSelectedFiles((prev) => ({ ...prev, [item.assignment.id]: Array.from(e.target.files || []) }))} />
              </label>
              <button onClick={async () => {
                try {
                  setSubmittingId(item.assignment.id);
                  setMessage("");
                  const files = selectedFiles[item.assignment.id] || [];
                  if (files.length === 0) {
                    setMessage("请先选择要提交的文件。")
                    return;
                  }
                  await api.submitAssignment(item.assignment.id, files);
                  setMessage("作业已提交，若教师开启 AI 辅助反馈，系统会同步生成参考意见。")
                  setSelectedFiles((prev) => ({ ...prev, [item.assignment.id]: [] }));
                  await reload();
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "提交失败，请稍后重试");
                } finally {
                  setSubmittingId("");
                }
              }} disabled={submittingId === item.assignment.id} className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">{submittingId === item.assignment.id ? "提交中..." : item.submission ? "重新提交" : "提交作业"}</button>
            </div>

            {(selectedFiles[item.assignment.id] || []).length > 0 ? <p className="mt-3 text-sm text-slate-500">待提交文件：{(selectedFiles[item.assignment.id] || []).map((file) => file.name).join("、")}</p> : null}

            {item.submission?.files?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {item.submission.files.map((file) => <a key={file.download_url} href={`${API_BASE}${file.download_url}`} target="_blank" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">已提交：{file.file_name}</a>)}
              </div>
            ) : null}

            {item.feedback ? (
              <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50/70 px-5 py-4 text-sm leading-7 text-slate-700">
                <p className="font-semibold text-emerald-700">AI 辅助批改参考</p>
                <p className="mt-2">{item.feedback.summary}</p>
                <p className="mt-3 text-xs text-slate-500">结构建议：{item.feedback.structure_feedback.join("；") || "暂无"}</p>
                <p className="mt-1 text-xs text-slate-500">逻辑建议：{item.feedback.logic_feedback.join("；") || "暂无"}</p>
                <p className="mt-1 text-xs text-slate-500">规范建议：{item.feedback.writing_feedback.join("；") || "暂无"}</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {message ? <p className="mt-5 text-sm text-slate-600">{message}</p> : null}
    </section>
    </WorkspacePage>
  );
}
