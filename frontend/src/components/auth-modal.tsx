"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { pick } from "@/lib/i18n";

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
  const { language } = useLanguage();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<Role>("teacher");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSubmitting(false);
      setError("");
    }
  }, [open]);

  const roleTips = useMemo(() => {
    return role === "teacher"
      ? pick(language, "教师账号用于课程设计、资料更新、作业管理和反馈查看。", "Teacher accounts are used for course setup, material updates, assignments, and feedback.")
      : role === "admin"
        ? pick(language, "管理员账号用于统一管理用户与平台内容。", "Admin accounts manage users and platform-wide content.")
        : pick(language, "学生账号用于提问、提交作业和查看学习反馈。", "Student accounts are used for questions, assignment submission, and learning feedback.");
  }, [language, role]);

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
        throw new Error(pick(language, "管理员账号不支持前台注册，请直接登录。", "Admin accounts cannot be registered from the public entry. Please sign in."));
      }

      if (form.password !== form.confirmPassword) {
        throw new Error(pick(language, "两次输入的密码不一致。", "The two passwords do not match."));
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
      setError(submitError instanceof Error ? submitError.message : pick(language, "提交失败，请稍后重试。", "Submission failed. Please try again later."));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
      <div className="glass-panel max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[32px] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-sm font-semibold text-slate-500">{pick(language, "账号入口", "Account Access")}</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">{mode === "login" ? pick(language, "登录平台账号", "Sign In") : pick(language, "注册平台账号", "Create Account")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{roleTips}</p>
          </div>
          <button onClick={onClose} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">{pick(language, "关闭", "Close")}</button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={() => setMode("login")} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === "login" ? "ui-pill-active" : "ui-pill"}`}>{pick(language, "登录", "Sign In")}</button>
          <button onClick={() => setMode("register")} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === "register" ? "ui-pill-active" : "ui-pill"}`}>{pick(language, "注册", "Register")}</button>
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={() => setRole("teacher")} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${role === "teacher" ? "ui-pill-active" : "ui-pill"}`}>{pick(language, "教师", "Teacher")}</button>
            <button onClick={() => setRole("student")} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${role === "student" ? "ui-pill-active" : "ui-pill"}`}>{pick(language, "学生", "Student")}</button>
            <button onClick={() => setRole("admin")} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${role === "admin" ? "ui-pill-active" : "ui-pill"}`}>{pick(language, "管理员", "Admin")}</button>
          </div>
        </div>

        {error ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "账号", "Account")}</span>
            <input value={form.account} onChange={(e) => updateField("account", e.target.value)} placeholder={pick(language, "建议使用学号、工号或易记账号", "Use a memorable account, student ID, or staff ID")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">{pick(language, "密码", "Password")}</span>
            <input type="password" value={form.password} onChange={(e) => updateField("password", e.target.value)} placeholder={pick(language, "请输入密码", "Enter password")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          {mode === "register" && role !== "admin" ? (
            <>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">{pick(language, "确认密码", "Confirm Password")}</span>
                <input type="password" value={form.confirmPassword} onChange={(e) => updateField("confirmPassword", e.target.value)} placeholder={pick(language, "请再次输入密码", "Enter password again")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">{pick(language, "姓名", "Name")}</span>
                <input value={form.realName} onChange={(e) => updateField("realName", e.target.value)} placeholder={pick(language, "请输入真实姓名", "Enter your name")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
              </label>
              <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{pick(language, "性别", "Gender")}</span><input value={form.gender} onChange={(e) => updateField("gender", e.target.value)} placeholder={pick(language, "可选填写", "Optional")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{pick(language, "学院", "School")}</span><input value={form.college} onChange={(e) => updateField("college", e.target.value)} placeholder={pick(language, "请输入学院", "Enter school")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{role === "teacher" ? pick(language, "专业方向", "Field") : pick(language, "专业", "Major")}</span><input value={form.major} onChange={(e) => updateField("major", e.target.value)} placeholder={role === "teacher" ? pick(language, "请输入专业方向", "Enter teaching field") : pick(language, "请输入专业", "Enter major")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              {role === "teacher" ? <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{pick(language, "工号", "Staff ID")}</span><input value={form.teacherNo} onChange={(e) => updateField("teacherNo", e.target.value)} placeholder={pick(language, "请输入工号", "Enter staff ID")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label> : <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{pick(language, "学号", "Student ID")}</span><input value={form.studentNo} onChange={(e) => updateField("studentNo", e.target.value)} placeholder={pick(language, "请输入学号", "Enter student ID")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>}
              {role === "teacher" ? (
                <>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{pick(language, "所属教研室", "Department")}</span><input value={form.department} onChange={(e) => updateField("department", e.target.value)} placeholder={pick(language, "请输入教研室", "Enter department")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{pick(language, "教学组", "Teaching Group")}</span><input value={form.teachingGroup} onChange={(e) => updateField("teachingGroup", e.target.value)} placeholder={pick(language, "请输入教学组", "Enter teaching group")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{pick(language, "岗位称谓", "Title")}</span><input value={form.roleTitle} onChange={(e) => updateField("roleTitle", e.target.value)} placeholder={pick(language, "请输入岗位称谓", "Enter title")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{pick(language, "常用课程", "Common Courses")}</span><input value={form.commonCourses} onChange={(e) => updateField("commonCourses", e.target.value)} placeholder={pick(language, "多个课程可用逗号分隔", "Separate courses with commas")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
                </>
              ) : (
                <>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{pick(language, "年级", "Grade")}</span><input value={form.grade} onChange={(e) => updateField("grade", e.target.value)} placeholder={pick(language, "请输入年级", "Enter grade")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{pick(language, "班级", "Class")}</span><input value={form.className} onChange={(e) => updateField("className", e.target.value)} placeholder={pick(language, "请输入班级", "Enter class")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
                </>
              )}
              <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{pick(language, "出生日期", "Birth Date")}</span><input type="date" value={form.birthDate} onChange={(e) => updateField("birthDate", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{pick(language, "邮箱", "Email")}</span><input value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder={pick(language, "请输入邮箱", "Enter email")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{pick(language, "手机号", "Phone")}</span><input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder={pick(language, "请输入手机号", "Enter phone")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              <label className="space-y-2 text-sm text-slate-700"><span className="font-semibold">{pick(language, "研究方向 / 兴趣方向", "Focus / Interests")}</span><input value={form.researchDirection} onChange={(e) => updateField("researchDirection", e.target.value)} placeholder={pick(language, "可选填写", "Optional")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              <label className="space-y-2 text-sm text-slate-700 md:col-span-2"><span className="font-semibold">{pick(language, "个人简介", "Profile")}</span><textarea value={form.bio} onChange={(e) => updateField("bio", e.target.value)} rows={3} placeholder={pick(language, "可简要介绍自己", "Add a short introduction")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
              <label className="space-y-2 text-sm text-slate-700 md:col-span-2"><span className="font-semibold">{role === "teacher" ? pick(language, "关联班级", "Linked Classes") : pick(language, "兴趣关键词", "Interest Tags")}</span><textarea value={role === "teacher" ? form.linkedClasses : form.interests} onChange={(e) => updateField(role === "teacher" ? "linkedClasses" : "interests", e.target.value)} rows={2} placeholder={role === "teacher" ? pick(language, "多个班级可用逗号分隔", "Separate classes with commas") : pick(language, "多个关键词可用逗号分隔", "Separate tags with commas")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" /></label>
            </>
          ) : (
            <div className="md:col-span-2 rounded-[24px] border border-dashed border-slate-300 bg-white/70 px-5 py-5 text-sm leading-7 text-slate-600">
              {role === "admin"
                ? pick(language, "管理员登录后可统一管理用户与平台内容。", "Admins can manage users and platform content after signing in.")
                : pick(language, "登录后可直接开始提问、提交作业和填写反馈。", "After signing in, you can ask questions, submit assignments, and send feedback.")}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {mode === "register" && role !== "admin"
              ? pick(language, "注册后会保留你的学习记录与作业记录。", "Your learning and assignment records stay with this account after registration.")
              : pick(language, "登录后会自动进入对应角色的工作台。", "After signing in, the correct workspace opens automatically.")}
          </p>
          <button onClick={handleSubmit} disabled={submitting || !form.account.trim() || !form.password.trim()} className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? pick(language, "提交中...", "Submitting...") : mode === "login" ? pick(language, "立即登录", "Sign In Now") : pick(language, "完成注册", "Create Account")}
          </button>
        </div>
      </div>
    </div>
  );
}
