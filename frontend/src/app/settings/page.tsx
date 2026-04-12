"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { api } from "@/lib/api";
import { applyAppearance, persistAppearance } from "@/lib/appearance";
import { LANGUAGE_OPTIONS, pick } from "@/lib/i18n";

const modeOptions = [
  { value: "day", zh: "白天模式", en: "Day Mode", zhDesc: "适合常规教学展示与白天办公", enDesc: "Best for regular teaching and daytime work" },
  { value: "night", zh: "夜间模式", en: "Night Mode", zhDesc: "适合低光环境与晚间备课", enDesc: "Best for low-light rooms and evening prep" },
  { value: "eye-care", zh: "护眼模式", en: "Eye-care Mode", zhDesc: "更柔和，适合长时间阅读", enDesc: "Gentler for long reading sessions" },
] as const;

const accentOptions = [
  { value: "blue", zh: "蓝色", en: "Blue" },
  { value: "green", zh: "绿色", en: "Green" },
  { value: "purple", zh: "紫色", en: "Purple" },
  { value: "orange", zh: "橙色", en: "Orange" },
  { value: "gray", zh: "灰色", en: "Gray" },
] as const;

const fontOptions = [
  { value: "default", zh: "标准字体", en: "Default" },
  { value: "rounded", zh: "圆润字体", en: "Rounded" },
  { value: "serif", zh: "衬线字体", en: "Serif" },
  { value: "mono", zh: "等宽字体", en: "Monospace" },
] as const;

const skinOptions = [
  { value: "clean", zh: "简洁风", en: "Clean" },
  { value: "tech", zh: "科技风", en: "Tech" },
  { value: "gentle", zh: "温和风", en: "Gentle" },
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [appearance, setAppearance] = useState({ mode: "day", accent: "blue", font: "default", skin: "clean", language: "zh-CN" });
  const hasUnsavedAppearanceEditsRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    hasUnsavedAppearanceEditsRef.current = false;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    api.getMyAppearance()
      .then((result) => {
        if (hasUnsavedAppearanceEditsRef.current) return;
        const next = { mode: result.mode, accent: result.accent, font: result.font, skin: result.skin, language: result.language || "zh-CN" };
        setAppearance(next);
        applyAppearance(next);
        persistAppearance(next);
        setLanguage(next.language === "en-US" ? "en-US" : "zh-CN");
      })
      .catch(() => undefined);
  }, [setLanguage, user]);

  if (!user) {
    return <main className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载设置中心...", "Loading settings...")}</main>;
  }

  const updateAppearance = (key: "mode" | "accent" | "font" | "skin" | "language", value: string) => {
    hasUnsavedAppearanceEditsRef.current = true;
    const next = { ...appearance, [key]: value };
    setAppearance(next);
    applyAppearance(next);
    persistAppearance(next);
    if (key === "language") {
      setLanguage(value === "en-US" ? "en-US" : "zh-CN");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await api.updateMyAppearance(appearance);
      setMessage(pick(language, "外观与语言设置已保存，下次登录会自动恢复。", "Theme and language settings have been saved and will be restored next time."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "保存失败，请稍后重试", "Save failed. Please try again later."));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordSaving(true);
    setPasswordMessage("");
    try {
      const result = await api.changePassword(passwordForm);
      setPasswordMessage(result.message);
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : pick(language, "密码修改失败", "Password change failed."));
    } finally {
      setPasswordSaving(false);
    }
  };

  const roleLabel = user.role === "teacher" ? pick(language, "教师", "Teacher") : user.role === "student" ? pick(language, "学生", "Student") : pick(language, "管理员", "Admin");

  return (
    <main className="space-y-5">
      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-semibold text-slate-500">{pick(language, "设置中心", "Settings Center")}</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">{pick(language, "账号、语言与外观设置", "Account, Language and Theme Settings")}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              {pick(language, "设置入口统一放在右上角。首页只保留教学核心模块，个人偏好、语言切换和账号安全都在这里维护。", "Settings are grouped in the top-right menu. The homepage stays focused on teaching workflows, while appearance, language and account security are managed here.")}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="section-card rounded-[28px] p-6">
            <h3 className="text-xl font-bold text-slate-900">{pick(language, "外观与语言", "Theme and Language")}</h3>

            <div className="mt-5 space-y-5">
              <div>
                <p className="text-sm font-semibold text-slate-700">{pick(language, "语言模式", "Language")}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {LANGUAGE_OPTIONS.map((item) => (
                    <button key={item.value} onClick={() => updateAppearance("language", item.value)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${appearance.language === item.value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-slate-900" : "border-slate-300 bg-white text-slate-700"}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700">{pick(language, "主题模式", "Theme Mode")}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {modeOptions.map((item) => (
                    <button key={item.value} onClick={() => updateAppearance("mode", item.value)} className={`rounded-[24px] border px-4 py-4 text-left transition ${appearance.mode === item.value ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-slate-300 bg-white"}`}>
                      <p className="text-sm font-semibold text-slate-900">{pick(language, item.zh, item.en)}</p>
                      <p className="mt-2 text-xs leading-6 text-slate-500">{pick(language, item.zhDesc, item.enDesc)}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700">{pick(language, "主题主色", "Accent Color")}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {accentOptions.map((item) => (
                    <button key={item.value} onClick={() => updateAppearance("accent", item.value)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${appearance.accent === item.value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-slate-900" : "border-slate-300 bg-white text-slate-700"}`}>
                      {pick(language, item.zh, item.en)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700">{pick(language, "字体方案", "Font Scheme")}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {fontOptions.map((item) => (
                    <button key={item.value} onClick={() => updateAppearance("font", item.value)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${appearance.font === item.value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-slate-900" : "border-slate-300 bg-white text-slate-700"}`}>
                      {pick(language, item.zh, item.en)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700">{pick(language, "皮肤风格", "Skin Style")}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {skinOptions.map((item) => (
                    <button key={item.value} onClick={() => updateAppearance("skin", item.value)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${appearance.skin === item.value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-slate-900" : "border-slate-300 bg-white text-slate-700"}`}>
                      {pick(language, item.zh, item.en)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="section-card rounded-[28px] p-6">
            <h3 className="text-xl font-bold text-slate-900">{pick(language, "账号说明", "Account Summary")}</h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              <p>{pick(language, "当前角色：", "Current role: ")}{roleLabel}</p>
              <p>{pick(language, "当前账号：", "Current account: ")}{user.account}</p>
              <p>{pick(language, "当前显示名：", "Display name: ")}{user.display_name}</p>
              <p>{pick(language, "登录后系统会自动切换到对应角色视图。教师只看到教师功能，学生只看到学生功能。", "After sign-in, the system automatically switches to the correct role view. Teachers only see teacher modules, and students only see student modules.")}</p>
              <p>{pick(language, "匿名发言只隐藏展示身份，不代表匿名登录。账号绑定、权限和审计仍然存在。", "Anonymous posting only hides the display identity. Account binding, permissions and audit records still remain in the system.")}</p>
            </div>
          </section>
        </div>

        <section id="account-security" className="mt-6 section-card rounded-[28px] p-6">
          <h3 className="text-xl font-bold text-slate-900">{pick(language, "账号安全", "Account Security")}</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">{pick(language, "当前密码", "Current Password")}</span>
              <input type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm((prev) => ({ ...prev, current_password: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">{pick(language, "新密码", "New Password")}</span>
              <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">{pick(language, "确认新密码", "Confirm New Password")}</span>
              <input type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={() => void handlePasswordChange()} disabled={passwordSaving} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
              {passwordSaving ? pick(language, "提交中...", "Submitting...") : pick(language, "更新密码", "Update Password")}
            </button>
            <button onClick={() => void logout().then(() => router.push("/"))} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white">
              {pick(language, "退出登录", "Log Out")}
            </button>
            {passwordMessage ? <p className={`text-sm ${passwordMessage.includes("已") || passwordMessage.toLowerCase().includes("updated") ? "text-emerald-700" : "text-slate-600"}`}>{passwordMessage}</p> : null}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className={`text-sm ${message.includes("已") || message.toLowerCase().includes("saved") ? "text-emerald-700" : "text-slate-500"}`}>
            {message || pick(language, "修改后建议点击保存，以便跨设备和下次登录自动恢复。", "Click save after changes so your preferences persist across devices and future sign-ins.")}
          </p>
          <button onClick={() => void handleSave()} disabled={saving} className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
            {saving ? pick(language, "保存中...", "Saving...") : pick(language, "保存设置", "Save Settings")}
          </button>
        </div>
      </section>
    </main>
  );
}
