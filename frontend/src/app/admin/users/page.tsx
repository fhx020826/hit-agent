"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
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
  const [form, setForm] = useState({ role: "student" as "admin" | "teacher" | "student", account: "", password: "", display_name: "", status: "active", profile: { ...EMPTY_PROFILE } });

  const load = async () => {
    try {
      const result = await api.listAdminUsers({ role: role || undefined, keyword: keyword || undefined });
      setItems(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载用户失败");
    }
  };

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.role === "admin") void load();
  }, [user, role]);

  if (!user || user.role !== "admin") {
    return <main className="section-card rounded-[28px] p-8 text-center text-slate-500">正在加载用户管理...</main>;
  }

  return (
    <main className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-slate-500">管理员后台</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900">用户管理与角色权限控制</h2>
        </div>
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-3">
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索账号、姓名、班级、邮箱" className="min-w-[220px] flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm" />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm">
              <option value="">全部角色</option>
              <option value="admin">管理员</option>
              <option value="teacher">教师</option>
              <option value="student">学生</option>
            </select>
            <button onClick={() => void load()} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">搜索</button>
          </div>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="section-card rounded-[24px] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-900">{item.display_name}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.account} · {item.role} · {item.status}</p>
                  </div>
                  <button onClick={async () => {
                    await api.deleteAdminUser(item.id);
                    setMessage("用户已删除。");
                    await load();
                  }} className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600">删除</button>
                </div>
                <p className="mt-2 text-sm text-slate-600">学院：{item.college || "未填写"} · 专业：{item.major || "未填写"} · 班级：{item.class_name || "未填写"}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <p className="text-sm font-semibold text-slate-500">新增用户</p>
        <h3 className="mt-2 text-2xl font-black text-slate-900">管理员可直接创建管理员、教师或学生账号</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">角色</span>
            <select value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as "admin" | "teacher" | "student" }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3">
              <option value="student">学生</option>
              <option value="teacher">教师</option>
              <option value="admin">管理员</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">账号</span>
            <input value={form.account} onChange={(e) => setForm((prev) => ({ ...prev, account: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">密码</span>
            <input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">显示名</span>
            <input value={form.display_name} onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">姓名</span>
            <input value={form.profile.real_name} onChange={(e) => setForm((prev) => ({ ...prev, profile: { ...prev.profile, real_name: e.target.value } }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">班级 / 教研室</span>
            <input value={form.profile.class_name} onChange={(e) => setForm((prev) => ({ ...prev, profile: { ...prev.profile, class_name: e.target.value } }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">学院</span>
            <input value={form.profile.college} onChange={(e) => setForm((prev) => ({ ...prev, profile: { ...prev.profile, college: e.target.value } }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">邮箱</span>
            <input value={form.profile.email} onChange={(e) => setForm((prev) => ({ ...prev, profile: { ...prev.profile, email: e.target.value } }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={async () => {
            await api.createAdminUser(form);
            setMessage("用户创建成功。");
            setForm({ role: "student", account: "", password: "", display_name: "", status: "active", profile: { ...EMPTY_PROFILE } });
            await load();
          }} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">创建用户</button>
          {message ? <p className="text-sm text-slate-500">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
