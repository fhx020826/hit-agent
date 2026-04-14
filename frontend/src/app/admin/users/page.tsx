"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { MetricCard, WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { api, type AdminUserItem, type UserProfile } from "@/lib/api";

const EMPTY_PROFILE: Omit<UserProfile, "updated_at"> = {
  real_name: "",
  gender: "",
  college: "",
  major: "",
  grade: "",
  class_name: "",
  student_no: "",
  teacher_no: "",
  department: "",
  teaching_group: "",
  role_title: "",
  birth_date: "",
  email: "",
  phone: "",
  avatar_path: "",
  bio: "",
  research_direction: "",
  interests: "",
  common_courses: [],
  linked_classes: [],
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    role: "student" as "admin" | "teacher" | "student",
    account: "",
    password: "",
    display_name: "",
    status: "active",
    profile: { ...EMPTY_PROFILE },
  });

  const load = useCallback(async () => {
    try {
      const result = await api.listAdminUsers({ role: role || undefined, keyword: keyword || undefined });
      setItems(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载用户失败");
    }
  }, [keyword, role]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    let alive = true;
    if (user?.role !== "admin") return;
    api.listAdminUsers({ role: role || undefined, keyword: keyword || undefined })
      .then((result) => {
        if (alive) setItems(result);
      })
      .catch((error) => {
        if (alive) setMessage(error instanceof Error ? error.message : "加载用户失败");
      });
    return () => {
      alive = false;
    };
  }, [keyword, role, user?.role]);

  const teacherCount = useMemo(() => items.filter((item) => item.role === "teacher").length, [items]);
  const studentCount = useMemo(() => items.filter((item) => item.role === "student").length, [items]);
  const adminCount = useMemo(() => items.filter((item) => item.role === "admin").length, [items]);

  if (!user || user.role !== "admin") {
    return <main className="section-card rounded-[28px] p-8 text-center text-slate-500">正在加载用户管理...</main>;
  }

  return (
    <WorkspacePage tone="admin">
      <WorkspaceHero
        tone="admin"
        eyebrow="管理员后台"
        title={<h2>管理员运营控制台</h2>}
        description={
          <p>
            在这里可以完成账号搜索、筛选、角色查看、新账号创建与用户删除，集中处理日常用户运营管理工作。
          </p>
        }
        aside={
          <div className="workspace-stack">
            <MetricCard tone="admin" label="教师账号" value={teacherCount} note="用于课程设计、资料与反馈管理。" />
            <MetricCard tone="admin" label="学生账号" value={studentCount} note="用于学习、作业与匿名反馈。" />
            <MetricCard tone="admin" label="管理员账号" value={adminCount} note="负责系统级管理与运营。" />
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
        <WorkspaceSection
          tone="admin"
          eyebrow="存量账号"
          title="用户管理与角色权限控制"
          description="保留原有搜索、筛选和删除功能，但强化密度和对比度，让管理员更像在看一块运营面板。"
          actions={
            <button onClick={() => void load()} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">
              搜索
            </button>
          }
        >
          <div className="workspace-stack">
            <div className="workspace-form-grid">
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">关键词搜索</span>
                <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索账号、姓名、班级、邮箱" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">角色筛选</span>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="">全部角色</option>
                  <option value="admin">管理员</option>
                  <option value="teacher">教师</option>
                  <option value="student">学生</option>
                </select>
              </label>
            </div>

            <div className="workspace-data-list">
              {items.map((item) => (
                <article key={item.id} className="workspace-data-item">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-slate-900">{item.display_name}</p>
                      <p className="mt-1 text-sm text-slate-500">{item.account} · {item.role} · {item.status}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await api.deleteAdminUser(item.id);
                        setMessage("用户已删除。");
                        await load();
                      }}
                      className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600"
                    >
                      删除
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                    <p>学院：{item.college || "未填写"}</p>
                    <p>专业：{item.major || "未填写"}</p>
                    <p>班级：{item.class_name || "未填写"}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </WorkspaceSection>

        <WorkspaceSection
          tone="admin"
          eyebrow="新增用户"
          title="管理员可直接创建管理员、教师或学生账号"
          description="所有字段仍然沿用现有接口入参，只优化录入顺序和视觉结构，不改变任何提交逻辑。"
        >
          <div className="workspace-stack">
            <div className="workspace-form-grid">
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">角色</span>
                <select value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as "admin" | "teacher" | "student" }))}>
                  <option value="student">学生</option>
                  <option value="teacher">教师</option>
                  <option value="admin">管理员</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">账号</span>
                <input value={form.account} onChange={(e) => setForm((prev) => ({ ...prev, account: e.target.value }))} />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">密码</span>
                <input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">显示名</span>
                <input value={form.display_name} onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))} />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">姓名</span>
                <input value={form.profile.real_name} onChange={(e) => setForm((prev) => ({ ...prev, profile: { ...prev.profile, real_name: e.target.value } }))} />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">班级 / 教研室</span>
                <input value={form.profile.class_name} onChange={(e) => setForm((prev) => ({ ...prev, profile: { ...prev.profile, class_name: e.target.value } }))} />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">学院</span>
                <input value={form.profile.college} onChange={(e) => setForm((prev) => ({ ...prev, profile: { ...prev.profile, college: e.target.value } }))} />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">邮箱</span>
                <input value={form.profile.email} onChange={(e) => setForm((prev) => ({ ...prev, profile: { ...prev.profile, email: e.target.value } }))} />
              </label>
            </div>

            <div className="workspace-inline-actions">
              <button
                onClick={async () => {
                  await api.createAdminUser(form);
                  setMessage("用户创建成功。");
                  setForm({ role: "student", account: "", password: "", display_name: "", status: "active", profile: { ...EMPTY_PROFILE } });
                  await load();
                }}
                className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white"
              >
                创建用户
              </button>
              {message ? <p className="text-sm text-slate-500">{message}</p> : null}
            </div>
          </div>
        </WorkspaceSection>
      </div>
    </WorkspacePage>
  );
}
