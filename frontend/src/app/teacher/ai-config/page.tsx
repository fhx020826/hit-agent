"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { SignalStrip, WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { api, type AgentConfig, type Course } from "@/lib/api";

const emptyConfig: Omit<AgentConfig, "course_id" | "updated_at"> = {
  scope_rules: "仅围绕课程内容与教师上传材料回答。",
  answer_style: "讲解型",
  enable_homework_support: true,
  enable_material_qa: true,
  enable_frontier_extension: true,
};

export default function TeacherAiConfigPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [config, setConfig] = useState(emptyConfig);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listCourses().then((items) => {
      setCourses(items);
      if (items[0]) setSelectedCourseId(items[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    api.getAgentConfig(selectedCourseId).then((result) => setConfig({
      scope_rules: result.scope_rules,
      answer_style: result.answer_style,
      enable_homework_support: result.enable_homework_support,
      enable_material_qa: result.enable_material_qa,
      enable_frontier_extension: result.enable_frontier_extension,
    }));
  }, [selectedCourseId]);

  const saveConfig = async () => {
    if (!selectedCourseId) return;
    setSaving(true);
    try {
      await api.updateAgentConfig(selectedCourseId, config);
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorkspacePage tone="teacher">
      <WorkspaceHero
        tone="teacher"
        eyebrow="课程专属 AI 助教配置"
        title={<h1>AI 助教配置</h1>}
        description={
          <p>
            教师可配置学生端 AI 助教的知识边界、回答风格，以及是否开放作业支持、资料问答和前沿拓展。
          </p>
        }
        actions={
          <>
            <Link href="/teacher" className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
              返回教师工作台
            </Link>
            <button onClick={() => void saveConfig()} disabled={!selectedCourseId || saving} className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "保存中..." : "保存 AI 助教配置"}
            </button>
          </>
        }
        footer={
          <SignalStrip
            tone="teacher"
            items={[
              { label: "知识边界", value: config.scope_rules ? "已定义" : "待补充", note: "决定学生端问答能触及的范围。" },
              { label: "回答风格", value: config.answer_style, note: "直接影响学生感受到的讲解方式。" },
              { label: "扩展能力", value: `${Number(config.enable_homework_support) + Number(config.enable_material_qa) + Number(config.enable_frontier_extension)}/3`, note: "勾选项越多，学生端能力越完整。" },
            ]}
          />
        }
      />

      <WorkspaceSection
        tone="teacher"
        eyebrow="配置表单"
        title="先选课程，再锁定 AI 的边界与语气"
        description="教师端对课程专属 AI 助教的配置是学生端行为的真实边界，不是简单的装饰开关。"
      >
        <div className="workspace-stack">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">选择课程</span>
            <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
              <option value="">请选择课程</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>

          <div className="workspace-form-grid">
            <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
              <span className="font-semibold">知识边界说明</span>
              <textarea value={config.scope_rules} onChange={(e) => setConfig({ ...config, scope_rules: e.target.value })} rows={5} />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">回答风格</span>
              <select value={config.answer_style} onChange={(e) => setConfig({ ...config, answer_style: e.target.value })}>
                <option value="讲解型">讲解型</option>
                <option value="启发型">启发型</option>
                <option value="精炼型">精炼型</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3">
            <label className="workspace-callout flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={config.enable_homework_support} onChange={(e) => setConfig({ ...config, enable_homework_support: e.target.checked })} />
              开放作业与大报告支持
            </label>
            <label className="workspace-callout flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={config.enable_material_qa} onChange={(e) => setConfig({ ...config, enable_material_qa: e.target.checked })} />
              开放课堂资料问答
            </label>
            <label className="workspace-callout flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={config.enable_frontier_extension} onChange={(e) => setConfig({ ...config, enable_frontier_extension: e.target.checked })} />
              开放前沿拓展内容解释
            </label>
          </div>
        </div>
      </WorkspaceSection>
    </WorkspacePage>
  );
}
