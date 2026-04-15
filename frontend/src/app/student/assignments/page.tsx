"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { useToast } from "@/components/toast-provider";
import { RichAnswer } from "@/components/rich-answer";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, API_BASE, type AssignmentStudentView } from "@/lib/api";
import { pick } from "@/lib/i18n";

export default function StudentAssignmentsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const toast = useToast();
  const [items, setItems] = useState<AssignmentStudentView[]>([]);
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
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载作业任务中心...", "Loading assignments...")}</div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage tone="student" className="space-y-5">
    <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
      <div className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold text-slate-500">{pick(language, "作业任务中心", "Assignment Center")}</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">{pick(language, "确认收到、上传提交并查看 AI 初步反馈", "Confirm, submit, and review AI feedback")}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{pick(language, "作业提交与本人账号绑定。若教师开启 AI 辅助反馈，系统会给出参考建议，最终评分仍由教师决定。", "Assignment submissions stay linked to your account. If AI support is enabled, the system provides reference suggestions while teachers keep final grading authority.")}</p>
      </div>

      <div className="mt-6 space-y-5">
        {items.length === 0 ? <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "当前还没有可见作业任务。", "There are no visible assignments yet.")}</div> : items.map((item) => (
          <div key={item.assignment.id} className="section-card rounded-[28px] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{item.assignment.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.assignment.description}</p>
                <p className="mt-2 text-xs text-slate-500">{pick(language, "截止时间：", "Deadline: ")}{item.assignment.deadline} · {pick(language, "面向班级：", "Class: ")}{item.assignment.target_class || pick(language, "全体学生", "All Students")}</p>
              </div>
              <div className="rounded-[22px] bg-white/70 px-4 py-3 text-sm leading-7 text-slate-600">
                <p>{pick(language, "确认状态：", "Receipt: ")}{item.receipt.confirmed ? pick(language, "已确认收到", "Confirmed") : pick(language, "未确认", "Pending")}</p>
                <p>{pick(language, "提交状态：", "Submission: ")}{item.submission ? `${pick(language, "已提交（", "Submitted (")}${item.submission.submitted_at})` : pick(language, "未提交", "Not submitted")}</p>
                <p>{pick(language, "是否允许补交：", "Resubmission: ")}{item.assignment.allow_resubmit ? pick(language, "是", "Yes") : pick(language, "否", "No")}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {!item.receipt.confirmed ? <button onClick={() => { api.confirmAssignment(item.assignment.id).then(() => { toast.success(pick(language, "已确认收到", "Receipt confirmed")); reload(); }).catch(() => toast.error(pick(language, "确认失败", "Confirm failed"))); }} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">{pick(language, "确认收到", "Confirm Receipt")}</button> : null}
              <label className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                {pick(language, "选择提交文件", "Choose Files")}
                <input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setSelectedFiles((prev) => ({ ...prev, [item.assignment.id]: Array.from(e.target.files || []) }))} />
              </label>
              <button onClick={async () => {
                try {
                  setSubmittingId(item.assignment.id);
                  const files = selectedFiles[item.assignment.id] || [];
                  if (files.length === 0) {
                    toast.info(pick(language, "请先选择要提交的文件", "Choose files before submitting"));
                    return;
                  }
                  await api.submitAssignment(item.assignment.id, files);
                  toast.success(pick(language, "作业已提交成功", "Assignment submitted"));
                  setSelectedFiles((prev) => ({ ...prev, [item.assignment.id]: [] }));
                  await reload();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : pick(language, "提交失败，请稍后重试", "Submission failed"));
                } finally {
                  setSubmittingId("");
                }
              }} disabled={submittingId === item.assignment.id} className="button-primary rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60">{submittingId === item.assignment.id ? pick(language, "提交中...", "Submitting...") : item.submission ? pick(language, "重新提交", "Resubmit") : pick(language, "提交作业", "Submit")}</button>
            </div>

            {(selectedFiles[item.assignment.id] || []).length > 0 ? <p className="mt-3 text-sm text-slate-500">{pick(language, "待提交文件：", "Queued files: ")}{(selectedFiles[item.assignment.id] || []).map((file) => file.name).join("、")}</p> : null}

            {item.submission?.files?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {item.submission.files.map((file) => <a key={file.download_url} href={`${API_BASE}${file.download_url}`} target="_blank" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">{pick(language, "已提交：", "Submitted: ")}{file.file_name}</a>)}
              </div>
            ) : null}

            {item.feedback ? (
              <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50/70 px-5 py-4 text-sm leading-7 text-slate-700">
                <p className="font-semibold text-emerald-700">{pick(language, "AI 辅助批改参考", "AI Review Notes")}</p>
                {item.feedback.summary ? <RichAnswer content={item.feedback.summary} className="mt-2" /> : null}
                <p className="mt-3 text-xs text-slate-500">{pick(language, "结构建议：", "Structure: ")}{item.feedback.structure_feedback.join("；") || pick(language, "暂无", "None")}</p>
                <p className="mt-1 text-xs text-slate-500">{pick(language, "逻辑建议：", "Logic: ")}{item.feedback.logic_feedback.join("；") || pick(language, "暂无", "None")}</p>
                <p className="mt-1 text-xs text-slate-500">{pick(language, "规范建议：", "Writing: ")}{item.feedback.writing_feedback.join("；") || pick(language, "暂无", "None")}</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
    </WorkspacePage>
  );
}
