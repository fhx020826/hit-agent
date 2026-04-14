"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { MetricCard, WorkspaceSection } from "@/components/workspace-panels";
import { WorkspaceHero, WorkspacePage } from "@/components/workspace-shell";
import { api, type AdminUserItem, type UserProfile } from "@/lib/api";
import { pick } from "@/lib/i18n";

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
  const { language } = useLanguage();
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
      setMessage(error instanceof Error ? error.message : pick(language, "加载用户失败", "Failed to load users"));
    }
  }, [keyword, language, role]);

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
        if (alive) setMessage(error instanceof Error ? error.message : pick(language, "加载用户失败", "Failed to load users"));
      });
    return () => {
      alive = false;
    };
  }, [keyword, language, role, user?.role]);

  const teacherCount = useMemo(() => items.filter((item) => item.role === "teacher").length, [items]);
  const studentCount = useMemo(() => items.filter((item) => item.role === "student").length, [items]);
  const adminCount = useMemo(() => items.filter((item) => item.role === "admin").length, [items]);

  if (!user || user.role !== "admin") {
    return <main className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载用户管理...", "Loading user management...")}</main>;
  }

  return (
    <WorkspacePage tone="admin">
      <WorkspaceHero
        tone="admin"
        eyebrow={pick(language, "管理员后台", "Admin Console")}
        title={<h2>{pick(language, "管理员运营控制台", "Admin Operations Console")}</h2>}
        description={
          <p>
            {pick(language, "搜索账号、筛选角色、创建新账号并处理用户管理。", "Search accounts, filter roles, create new accounts, and handle daily user operations.")}
          </p>
        }
        aside={
          <div className="workspace-stack">
            <MetricCard tone="admin" label={pick(language, "教师账号", "Teacher Accounts")} value={teacherCount} note={pick(language, "用于课程、资料和反馈管理。", "Used for courses, materials, and feedback workflows.")} />
            <MetricCard tone="admin" label={pick(language, "学生账号", "Student Accounts")} value={studentCount} note={pick(language, "用于学习、作业和匿名反馈。", "Used for study, assignments, and anonymous feedback.")} />
            <MetricCard tone="admin" label={pick(language, "管理员账号", "Admin Accounts")} value={adminCount} note={pick(language, "负责系统级管理与运营。", "Handle system-level administration and operations.")} />
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
        <WorkspaceSection
          tone="admin"
          eyebrow={pick(language, "存量账号", "Existing Accounts")}
          title={pick(language, "用户管理与角色权限控制", "User management and role control")}
          description={pick(language, "保留搜索、筛选和删除能力，并统一到同一管理面板。", "Keep search, filtering, and deletion in one management surface.")}
          actions={
            <button onClick={() => void load()} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              {pick(language, "搜索", "Search")}
            </button>
          }
        >
          <div className="workspace-stack">
            <div className="workspace-form-grid">
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">{pick(language, "关键词搜索", "Keyword Search")}</span>
                <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={pick(language, "搜索账号、姓名、班级、邮箱", "Search account, name, class, or email")} />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">{pick(language, "角色筛选", "Role Filter")}</span>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="">{pick(language, "全部角色", "All Roles")}</option>
                  <option value="admin">{pick(language, "管理员", "Admin")}</option>
                  <option value="teacher">{pick(language, "教师", "Teacher")}</option>
                  <option value="student">{pick(language, "学生", "Student")}</option>
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
                        setMessage(pick(language, "用户已删除。", "User deleted."));
                        await load();
                      }}
                      className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600"
                    >
                      {pick(language, "删除", "Delete")}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                    <p>{pick(language, "学院：", "College: ")}{item.college || pick(language, "未填写", "Not set")}</p>
                    <p>{pick(language, "专业：", "Major: ")}{item.major || pick(language, "未填写", "Not set")}</p>
                    <p>{pick(language, "班级：", "Class: ")}{item.class_name || pick(language, "未填写", "Not set")}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </WorkspaceSection>

        <WorkspaceSection
          tone="admin"
          eyebrow={pick(language, "新增用户", "Create User")}
          title={pick(language, "管理员可直接创建管理员、教师或学生账号", "Create admin, teacher, or student accounts")}
          description={pick(language, "保留现有提交逻辑，只统一录入结构和文案。", "Keep the current submission flow while unifying structure and copy.")}
        >
          <div className="workspace-stack">
            <div className="workspace-form-grid">
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">{pick(language, "角色", "Role")}</span>
                <select value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as "admin" | "teacher" | "student" }))}>
                  <option value="student">{pick(language, "学生", "Student")}</option>
                  <option value="teacher">{pick(language, "教师", "Teacher")}</option>
                  <option value="admin">{pick(language, "管理员", "Admin")}</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">{pick(language, "账号", "Account")}</span>
                <input value={form.account} onChange={(e) => setForm((prev) => ({ ...prev, account: e.target.value }))} />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">{pick(language, "密码", "Password")}</span>
                <input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">{pick(language, "显示名", "Display Name")}</span>
                <input value={form.display_name} onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))} />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">{pick(language, "姓名", "Name")}</span>
                <input value={form.profile.real_name} onChange={(e) => setForm((prev) => ({ ...prev, profile: { ...prev.profile, real_name: e.target.value } }))} />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">{pick(language, "班级 / 教研室", "Class / Department")}</span>
                <input value={form.profile.class_name} onChange={(e) => setForm((prev) => ({ ...prev, profile: { ...prev.profile, class_name: e.target.value } }))} />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">{pick(language, "学院", "College")}</span>
                <input value={form.profile.college} onChange={(e) => setForm((prev) => ({ ...prev, profile: { ...prev.profile, college: e.target.value } }))} />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">{pick(language, "邮箱", "Email")}</span>
                <input value={form.profile.email} onChange={(e) => setForm((prev) => ({ ...prev, profile: { ...prev.profile, email: e.target.value } }))} />
              </label>
            </div>

            <div className="workspace-inline-actions">
              <button
                onClick={async () => {
                  await api.createAdminUser(form);
                  setMessage(pick(language, "用户创建成功。", "User created."));
                  setForm({ role: "student", account: "", password: "", display_name: "", status: "active", profile: { ...EMPTY_PROFILE } });
                  await load();
                }}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {pick(language, "创建用户", "Create User")}
              </button>
              {message ? <p className="text-sm text-slate-500">{message}</p> : null}
            </div>
          </div>
        </WorkspaceSection>
      </div>
    </WorkspacePage>
  );
}
