"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useLanguage } from "@/components/language-provider";
import { SignalStrip, WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { api, type AgentConfig, type Course } from "@/lib/api";
import { pick } from "@/lib/i18n";

const emptyConfig: Omit<AgentConfig, "course_id" | "updated_at"> = {
  scope_rules: "仅围绕课程内容与教师上传材料回答。",
  answer_style: "讲解型",
  enable_homework_support: true,
  enable_material_qa: true,
  enable_frontier_extension: true,
};

export default function TeacherAiConfigPage() {
  const { language } = useLanguage();
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
        eyebrow={pick(language, "AI 助教配置", "AI Assistant Setup")}
        title={<h1>{pick(language, "AI 助教配置", "AI Assistant Setup")}</h1>}
        description={
          <p>
            {pick(language, "设置知识边界、回答风格和开放能力。", "Set knowledge scope, answer style, and enabled capabilities.")}
          </p>
        }
        actions={
          <>
            <Link href="/teacher" className="ui-pill rounded-full px-5 py-3 text-sm font-semibold">
              {pick(language, "返回教师工作台", "Back to Workspace")}
            </Link>
            <button onClick={() => void saveConfig()} disabled={!selectedCourseId || saving} className="button-primary rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-60">
              {saving ? pick(language, "保存中...", "Saving...") : pick(language, "保存配置", "Save Setup")}
            </button>
          </>
        }
        footer={
          <SignalStrip
            tone="teacher"
            items={[
              { label: pick(language, "知识边界", "Scope"), value: config.scope_rules ? pick(language, "已定义", "Defined") : pick(language, "待补充", "Pending"), note: pick(language, "决定问答覆盖范围。", "Controls the answer boundary.") },
              { label: pick(language, "回答风格", "Answer Style"), value: config.answer_style, note: pick(language, "影响学生看到的讲解方式。", "Shapes the teaching tone students receive.") },
              { label: pick(language, "扩展能力", "Enabled Capabilities"), value: `${Number(config.enable_homework_support) + Number(config.enable_material_qa) + Number(config.enable_frontier_extension)}/3`, note: pick(language, "勾选越多，可用能力越完整。", "More enabled options mean broader student-side support.") },
            ]}
          />
        }
      />

      <WorkspaceSection
        tone="teacher"
        eyebrow={pick(language, "配置表单", "Setup Form")}
        title={pick(language, "先选课程，再设置规则", "Choose a course, then set the rules")}
        description={pick(language, "这里决定学生端 AI 助教的实际行为边界。", "This defines the real behavior boundary of the student-side assistant.")}
      >
        <div className="workspace-stack">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "选择课程", "Choose Course")}</span>
            <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
              <option value="">{pick(language, "请选择课程", "Select a course")}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>

          <div className="workspace-form-grid">
            <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
              <span className="font-semibold">{pick(language, "知识边界说明", "Scope Rules")}</span>
              <textarea value={config.scope_rules} onChange={(e) => setConfig({ ...config, scope_rules: e.target.value })} rows={5} />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">{pick(language, "回答风格", "Answer Style")}</span>
              <select value={config.answer_style} onChange={(e) => setConfig({ ...config, answer_style: e.target.value })}>
                <option value="讲解型">{pick(language, "讲解型", "Explainer")}</option>
                <option value="启发型">{pick(language, "启发型", "Guided")}</option>
                <option value="精炼型">{pick(language, "精炼型", "Concise")}</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3">
            <label className="workspace-callout flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={config.enable_homework_support} onChange={(e) => setConfig({ ...config, enable_homework_support: e.target.checked })} />
              {pick(language, "开放作业与大报告支持", "Enable assignments and reports")}
            </label>
            <label className="workspace-callout flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={config.enable_material_qa} onChange={(e) => setConfig({ ...config, enable_material_qa: e.target.checked })} />
              {pick(language, "开放课堂资料问答", "Enable material Q&A")}
            </label>
            <label className="workspace-callout flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={config.enable_frontier_extension} onChange={(e) => setConfig({ ...config, enable_frontier_extension: e.target.checked })} />
              {pick(language, "开放前沿拓展内容解释", "Enable frontier-topic guidance")}
            </label>
          </div>
        </div>
      </WorkspaceSection>
    </WorkspacePage>
  );
}
