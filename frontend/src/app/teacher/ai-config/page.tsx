"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
    <main className="min-h-screen px-6 py-8">
      <div className="glass-panel mx-auto max-w-5xl rounded-[32px] px-8 py-8 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-8">
          <div>
            <p className="text-sm font-semibold text-slate-400">课程专属 AI 助教配置</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-900 md:text-4xl">AI 助教配置</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">教师可配置学生端 AI 助教的知识边界、回答风格，以及是否开放作业支持、资料问答和前沿拓展。</p>
          </div>
          <Link href="/teacher" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">返回教师工作台</Link>
        </div>

        <div className="mt-8 space-y-6">
          <section className="section-card rounded-[24px] p-6">
            <h2 className="text-xl font-bold text-slate-900">选择课程</h2>
            <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900">
              <option value="">请选择课程</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </section>

          <section className="section-card rounded-[24px] p-6 space-y-5">
            <div>
              <p className="text-sm font-semibold text-slate-700">知识边界说明</p>
              <textarea value={config.scope_rules} onChange={(e) => setConfig({ ...config, scope_rules: e.target.value })} rows={4} className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">回答风格</p>
              <select value={config.answer_style} onChange={(e) => setConfig({ ...config, answer_style: e.target.value })} className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900">
                <option value="讲解型">讲解型</option>
                <option value="启发型">启发型</option>
                <option value="精炼型">精炼型</option>
              </select>
            </div>
            <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={config.enable_homework_support} onChange={(e) => setConfig({ ...config, enable_homework_support: e.target.checked })} />开放作业与大报告支持</label>
            <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={config.enable_material_qa} onChange={(e) => setConfig({ ...config, enable_material_qa: e.target.checked })} />开放课堂资料问答</label>
            <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={config.enable_frontier_extension} onChange={(e) => setConfig({ ...config, enable_frontier_extension: e.target.checked })} />开放前沿拓展内容解释</label>
            <button onClick={saveConfig} disabled={!selectedCourseId || saving} className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "保存中..." : "保存 AI 助教配置"}</button>
          </section>
        </div>
      </div>
    </main>
  );
}
