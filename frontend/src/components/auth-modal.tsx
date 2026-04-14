"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

type Mode = "login" | "register";
type Role = "admin" | "teacher" | "student";

type FormState = {
  account: string;
  password: string;
  confirmPassword: string;
  realName: string;
  gender: string;
  college: string;
  major: string;
  grade: string;
  className: string;
  studentNo: string;
  teacherNo: string;
  department: string;
  teachingGroup: string;
  roleTitle: string;
  birthDate: string;
  email: string;
  phone: string;
  bio: string;
  researchDirection: string;
  interests: string;
  commonCourses: string;
  linkedClasses: string;
};

const EMPTY_FORM: FormState = {
  account: "",
  password: "",
  confirmPassword: "",
  realName: "",
  gender: "",
  college: "",
  major: "",
  grade: "",
  className: "",
  studentNo: "",
  teacherNo: "",
  department: "",
  teachingGroup: "",
  roleTitle: "",
  birthDate: "",
  email: "",
  phone: "",
  bio: "",
  researchDirection: "",
  interests: "",
  commonCourses: "",
  linkedClasses: "",
};

function splitList(value: string) {
  return value.split(/[\n,，；;]/).map((item) => item.trim()).filter(Boolean);
}

export function AuthModal({ open, initialMode = "login", onClose }: { open: boolean; initialMode?: Mode; onClose: () => void }) {
  const router = useRouter();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<Role>("teacher");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const roleTips = useMemo(() => {
    return role === "teacher"
      ? "教师账号用于课程设计、资料更新、作业管理、问题回复和教学分析。"
      : role === "admin"
        ? "管理员账号用于全站用户、课程、讨论空间和系统运营管理。"
        : "学生账号用于课程问答、作业提交、匿名反馈和学习记录。匿名发言仅隐藏展示身份，不脱离本人账号。";
  }, [role]);

  if (!open) return null;

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      if (mode === "login") {
        const user = await login({ role, account: form.account.trim(), password: form.password });
        onClose();
        router.push(user.role === "admin" ? "/admin/users" : user.role === "teacher" ? "/teacher" : "/student");
        return;
      }

      if (role === "admin") {
        throw new Error("管理员账号不支持前台注册，请使用管理员现有账号登录。");
      }

      if (form.password !== form.confirmPassword) {
        throw new Error("两次输入的密码不一致");
      }

      const user = await register({
        role,
        account: form.account.trim(),
        password: form.password,
        confirm_password: form.confirmPassword,
        profile: {
          real_name: form.realName.trim(),
          gender: form.gender.trim(),
          college: form.college.trim(),
          major: form.major.trim(),
          grade: role === "student" ? form.grade.trim() : "",
          class_name: role === "student" ? form.className.trim() : "",
          student_no: role === "student" ? form.studentNo.trim() : "",
          teacher_no: role === "teacher" ? form.teacherNo.trim() : "",
          department: role === "teacher" ? form.department.trim() : "",
          teaching_group: role === "teacher" ? form.teachingGroup.trim() : "",
          role_title: role === "teacher" ? form.roleTitle.trim() : "",
          birth_date: form.birthDate,
          email: form.email.trim(),
          phone: form.phone.trim(),
          avatar_path: "",
          bio: form.bio.trim(),
          research_direction: form.researchDirection.trim(),
          interests: form.interests.trim(),
          common_courses: role === "teacher" ? splitList(form.commonCourses) : [],
          linked_classes: role === "teacher" ? splitList(form.linkedClasses) : (form.className.trim() ? [form.className.trim()] : []),
        },
      });
      onClose();
      router.push(user.role === "admin" ? "/admin/users" : user.role === "teacher" ? "/teacher" : "/student");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败，请稍后重试");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
      <div className="glass-panel max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[32px] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-sm font-semibold text-slate-500">账号登录与注册</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">{mode === "login" ? "登录平台账号" : "注册平台账号"}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{roleTips}</p>
          </div>
          <button onClick={onClose} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">关闭</button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={() => setMode("login")} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === "login" ? "ui-pill-active" : "ui-pill"}`}>登录</button>
          <button onClick={() => setMode("register")} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === "register" ? "ui-pill-active" : "ui-pill"}`}>注册</button>
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={() => setRole("teacher")} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${role === "teacher" ? "ui-pill-active" : "ui-pill"}`}>教师</button>
            <button onClick={() => setRole("student")} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${role === "student" ? "ui-pill-active" : "ui-pill"}`}>学生</button>
            <button onClick={() => setRole("admin")} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${role === "admin" ? "ui-pill-active" : "ui-pill"}`}>管理员</button>
          </div>
        </div>

        {error ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">账号</span>
            <input value={form.account} onChange={(e) => updateField("account", e.target.value)} placeholder="建议使用学号、工号或易记账号" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">密码</span>
            <input type="password" value={form.password} onChange={(e) => updateField("password", e.target.value)} placeholder="请输入密码" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          {mode === "register" && role !== "admin" ? (
            <>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">确认密码</span>
                <input type="password" value={form.confirmPassword} onChange={(e) => updateField("confirmPassword", e.target.value)} placeholder="请再次输入密码" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">姓名</span>
                <input value={form.realName} onChange={(e) => updateField("realName", e.target.value)} placeholder="请输入真实姓名" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
              </label>
              <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">性别</span><input value={form.gender} onChange={(e) => updateField("gender", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">学院</span><input value={form.college} onChange={(e) => updateField("college", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{role === "teacher" ? "专业方向" : "专业"}</span><input value={form.major} onChange={(e) => updateField("major", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              {role === "teacher" ? <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">工号</span><input value={form.teacherNo} onChange={(e) => updateField("teacherNo", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label> : <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">学号</span><input value={form.studentNo} onChange={(e) => updateField("studentNo", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>}
              {role === "teacher" ? (
                <>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">所属教研室</span><input value={form.department} onChange={(e) => updateField("department", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">教学组</span><input value={form.teachingGroup} onChange={(e) => updateField("teachingGroup", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">岗位称谓</span><input value={form.roleTitle} onChange={(e) => updateField("roleTitle", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">常用课程</span><input value={form.commonCourses} onChange={(e) => updateField("commonCourses", e.target.value)} placeholder="多个课程可用逗号分隔" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
                </>
              ) : (
                <>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">年级</span><input value={form.grade} onChange={(e) => updateField("grade", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">班级</span><input value={form.className} onChange={(e) => updateField("className", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
                </>
              )}
              <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">出生日期</span><input type="date" value={form.birthDate} onChange={(e) => updateField("birthDate", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">邮箱</span><input value={form.email} onChange={(e) => updateField("email", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">手机号</span><input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">研究方向 / 兴趣方向</span><input value={form.researchDirection} onChange={(e) => updateField("researchDirection", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              <label className="space-y-2 text-sm text-slate-700 md:col-span-2"><span className="font-semibold">个人简介</span><textarea value={form.bio} onChange={(e) => updateField("bio", e.target.value)} rows={3} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              <label className="space-y-2 text-sm text-slate-700 md:col-span-2"><span className="font-semibold">{role === "teacher" ? "关联班级" : "兴趣关键词"}</span><textarea value={role === "teacher" ? form.linkedClasses : form.interests} onChange={(e) => updateField(role === "teacher" ? "linkedClasses" : "interests", e.target.value)} rows={2} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
            </>
          ) : (
            <div className="md:col-span-2 rounded-[24px] border border-dashed border-slate-300 bg-white/70 px-5 py-5 text-sm leading-7 text-slate-600">
              {role === "admin" ? "管理员登录后可统一管理用户、课程、讨论空间与平台数据。" : "登录后请使用本人账号进行学习、提问、作业提交和反馈填写。若不希望教师在提问时看到公开身份，可以在提问时单独勾选匿名发言。"}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">{mode === "register" && role !== "admin" ? "注册用于形成独立账号体系，所有学习记录、作业记录与提问记录都与本人账号绑定。" : "登录后系统会根据管理员、教师或学生身份自动进入对应工作台。"}</p>
          <button onClick={handleSubmit} disabled={submitting || !form.account.trim() || !form.password.trim()} className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "提交中..." : mode === "login" ? "立即登录" : "完成注册"}</button>
        </div>
      </div>
    </div>
  );
}
