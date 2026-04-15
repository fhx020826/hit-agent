"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AvatarBadge } from "@/components/avatar-badge";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import { api, type UserProfile } from "@/lib/api";
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

const PRESET_AVATARS = [
  { labelZh: "默认头像", labelEn: "Default Avatar", value: "" },
  { labelZh: "日出风格", labelEn: "Sunrise", value: "preset:sunrise" },
  { labelZh: "森林风格", labelEn: "Forest", value: "preset:forest" },
  { labelZh: "星云风格", labelEn: "Nebula", value: "preset:nebula" },
];

function listToText(items: string[]) {
  return items.join(", ");
}

function textToList(value: string) {
  return value.split(/[\n,，；;]/).map((item) => item.trim()).filter(Boolean);
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, updateUser } = useAuth();
  const { language } = useLanguage();
  const [form, setForm] = useState<Omit<UserProfile, "updated_at">>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) return;
    setForm({
      real_name: user.profile.real_name,
      gender: user.profile.gender,
      college: user.profile.college,
      major: user.profile.major,
      grade: user.profile.grade,
      class_name: user.profile.class_name,
      student_no: user.profile.student_no,
      teacher_no: user.profile.teacher_no,
      department: user.profile.department,
      teaching_group: user.profile.teaching_group,
      role_title: user.profile.role_title,
      birth_date: user.profile.birth_date,
      email: user.profile.email,
      phone: user.profile.phone,
      avatar_path: user.profile.avatar_path,
      bio: user.profile.bio,
      research_direction: user.profile.research_direction,
      interests: user.profile.interests,
      common_courses: user.profile.common_courses,
      linked_classes: user.profile.linked_classes,
    });
  }, [user]);

  const grouped = useMemo(() => {
    if (!user) return [];
    return user.role === "teacher"
      ? [
          { title: pick(language, "基本信息", "Basic Information"), fields: ["real_name", "gender", "college", "major", "teacher_no", "role_title"] },
          { title: pick(language, "教学信息", "Teaching Information"), fields: ["department", "teaching_group", "common_courses", "linked_classes", "research_direction"] },
          { title: pick(language, "联系信息", "Contact Information"), fields: ["birth_date", "email", "phone", "bio"] },
        ]
      : [
          { title: pick(language, "基本信息", "Basic Information"), fields: ["real_name", "gender", "college", "major", "student_no"] },
          { title: pick(language, "学籍信息", "Academic Information"), fields: ["grade", "class_name", "linked_classes", "research_direction", "interests"] },
          { title: pick(language, "联系信息", "Contact Information"), fields: ["birth_date", "email", "phone", "bio"] },
        ];
  }, [language, user]);

  const tone = user?.role === "teacher" ? "teacher" : "student";

  if (!user) {
    return (
      <WorkspacePage tone="public">
        <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载个人中心...", "Loading profile...")}</div>
      </WorkspacePage>
    );
  }

  const setValue = (key: keyof typeof form, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const renderField = (field: string) => {
    const map: Record<string, { label: string; value: string; onChange: (value: string) => void; type?: string; multiline?: boolean; hidden?: boolean }> = {
      real_name: { label: pick(language, "姓名", "Full Name"), value: form.real_name, onChange: (value) => setValue("real_name", value) },
      gender: { label: pick(language, "性别", "Gender"), value: form.gender, onChange: (value) => setValue("gender", value) },
      college: { label: pick(language, "学院", "College"), value: form.college, onChange: (value) => setValue("college", value) },
      major: { label: user.role === "teacher" ? pick(language, "专业方向", "Research Direction") : pick(language, "专业", "Major"), value: form.major, onChange: (value) => setValue("major", value) },
      grade: { label: pick(language, "年级", "Grade"), value: form.grade, onChange: (value) => setValue("grade", value), hidden: user.role !== "student" },
      class_name: { label: pick(language, "班级", "Class"), value: form.class_name, onChange: (value) => setValue("class_name", value), hidden: user.role !== "student" },
      student_no: { label: pick(language, "学号", "Student Number"), value: form.student_no, onChange: (value) => setValue("student_no", value), hidden: user.role !== "student" },
      teacher_no: { label: pick(language, "工号", "Teacher Number"), value: form.teacher_no, onChange: (value) => setValue("teacher_no", value), hidden: user.role !== "teacher" },
      department: { label: pick(language, "所属教研室", "Department"), value: form.department, onChange: (value) => setValue("department", value), hidden: user.role !== "teacher" },
      teaching_group: { label: pick(language, "教学组", "Teaching Group"), value: form.teaching_group, onChange: (value) => setValue("teaching_group", value), hidden: user.role !== "teacher" },
      role_title: { label: pick(language, "岗位称谓", "Role Title"), value: form.role_title, onChange: (value) => setValue("role_title", value), hidden: user.role !== "teacher" },
      birth_date: { label: pick(language, "出生日期", "Birth Date"), value: form.birth_date, onChange: (value) => setValue("birth_date", value), type: "date" },
      email: { label: pick(language, "邮箱", "Email"), value: form.email, onChange: (value) => setValue("email", value) },
      phone: { label: pick(language, "手机号", "Phone"), value: form.phone, onChange: (value) => setValue("phone", value) },
      bio: { label: pick(language, "个人简介", "Biography"), value: form.bio, onChange: (value) => setValue("bio", value), multiline: true },
      research_direction: { label: user.role === "teacher" ? pick(language, "研究方向", "Research Direction") : pick(language, "建议加强方向", "Suggested Focus Area"), value: form.research_direction, onChange: (value) => setValue("research_direction", value) },
      interests: { label: pick(language, "兴趣方向", "Interests"), value: form.interests, onChange: (value) => setValue("interests", value), hidden: user.role !== "student" },
      common_courses: { label: pick(language, "常用课程", "Common Courses"), value: listToText(form.common_courses), onChange: (value) => setValue("common_courses", textToList(value)), hidden: user.role !== "teacher" },
      linked_classes: { label: user.role === "teacher" ? pick(language, "关联班级", "Linked Classes") : pick(language, "所在班级关联信息", "Linked Class Info"), value: listToText(form.linked_classes), onChange: (value) => setValue("linked_classes", textToList(value)) },
    };
    const config = map[field];
    if (!config || config.hidden) return null;
    return (
      <label key={field} className={`space-y-2 text-sm text-slate-700 ${config.multiline ? "md:col-span-2" : ""}`}>
        <span className="font-semibold">{config.label}</span>
        {config.multiline ? (
          <textarea value={config.value} onChange={(e) => config.onChange(e.target.value)} rows={3} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
        ) : (
          <input type={config.type || "text"} value={config.value} onChange={(e) => config.onChange(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
        )}
      </label>
    );
  };

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingAvatar(true);
    setMessage("");
    try {
      const result = await api.uploadAvatar(file);
      const nextProfile = { ...form, avatar_path: result.avatar_path };
      setForm(nextProfile);
      updateUser({ ...user, profile: { ...user.profile, avatar_path: result.avatar_path }, display_name: nextProfile.real_name || user.account });
      setMessage(pick(language, "头像已更新。你也可以继续选择默认头像样式。", "Avatar updated. You can also continue using a preset style.")); 
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "头像上传失败", "Avatar upload failed."));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const profile = await api.updateProfile(form);
      updateUser({ ...user, display_name: profile.real_name || user.account, profile });
      setMessage(pick(language, "个人资料已保存，头像、简介和角色信息都会同步到右上角菜单。", "Profile saved. Avatar, biography and role information are now synced to the top-right menu."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "保存失败，请稍后重试", "Save failed. Please try again later."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorkspacePage tone={tone} className="space-y-5">
      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-semibold text-slate-500">{pick(language, "个人中心", "Profile Center")}</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">{user.role === "teacher" ? pick(language, "教师资料维护", "Teacher Profile") : pick(language, "学生资料维护", "Student Profile")}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              {pick(language, `当前身份为“${user.role === "teacher" ? "教师" : "学生"}”。平台中的问答记录、作业记录、反馈记录都与账号绑定；匿名发言仅隐藏展示身份，不脱离账号体系。`, `Your current role is "${user.role === "teacher" ? "Teacher" : "Student"}". Q&A records, assignments and feedback remain bound to your account. Anonymous posting only hides your displayed identity.`)}
            </p>
          </div>
          <div className="rounded-[24px] bg-white/75 px-5 py-4 text-sm leading-7 text-slate-600">
            <p><span className="font-semibold text-slate-900">{pick(language, "账号：", "Account: ")}</span>{user.account}</p>
            <p><span className="font-semibold text-slate-900">{pick(language, "当前显示名：", "Display name: ")}</span>{user.display_name}</p>
            <p><span className="font-semibold text-slate-900">{pick(language, "角色视图：", "Role View: ")}</span>{user.role === "teacher" ? pick(language, "教师教学视图", "Teacher workspace") : pick(language, "学生学习视图", "Student workspace")}</p>
          </div>
        </div>

        <section className="mt-6 section-card rounded-[28px] p-6">
          <h3 className="text-xl font-bold text-slate-900">{pick(language, "头像与公开展示", "Avatar and Public Display")}</h3>
          <div className="mt-5 flex flex-wrap items-start gap-6">
            <AvatarBadge name={form.real_name || user.display_name || user.account} avatarPath={form.avatar_path} size="lg" />
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{pick(language, "选择默认头像风格", "Choose a Preset Avatar")}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {PRESET_AVATARS.map((item) => (
                    <button key={item.value || item.labelEn} onClick={() => setValue("avatar_path", item.value)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${form.avatar_path === item.value ? "ui-pill-active" : "ui-pill"}`}>
                      {pick(language, item.labelZh, item.labelEn)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{pick(language, "上传自定义头像", "Upload a Custom Avatar")}</p>
                <label className="button-primary mt-3 inline-flex cursor-pointer rounded-full px-4 py-2 text-sm font-semibold">
                  {uploadingAvatar ? pick(language, "上传中...", "Uploading...") : pick(language, "上传图片", "Upload Image")}
                  <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => void handleAvatarUpload(e.target.files?.[0] || null)} />
                </label>
                <p className="mt-2 text-xs leading-6 text-slate-500">{pick(language, "支持 jpg、png、webp。上传后右上角会立刻显示新头像。", "Supports jpg, png and webp. The new avatar will appear in the top-right menu immediately after upload.")}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 space-y-6">
          {grouped.map((group) => (
            <section key={group.title} className="section-card rounded-[28px] p-6">
              <h3 className="text-xl font-bold text-slate-900">{group.title}</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {group.fields.map(renderField)}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className={`text-sm ${(message.includes("已") || message.toLowerCase().includes("saved") || message.toLowerCase().includes("updated")) ? "text-emerald-700" : "text-slate-500"}`}>
            {message || pick(language, "建议完善资料，便于教师进行班级管理与教学统计。", "Keeping your profile complete helps with class management and teaching analytics.")}
          </p>
          <button onClick={() => void handleSave()} disabled={saving} className="button-primary rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-60">
            {saving ? pick(language, "保存中...", "Saving...") : pick(language, "保存个人资料", "Save Profile")}
          </button>
        </div>
      </section>
    </WorkspacePage>
  );
}
