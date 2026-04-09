"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { AvatarBadge } from "@/components/avatar-badge";
import { AuthModal } from "@/components/auth-modal";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { api } from "@/lib/api";
import { applyAppearance, persistAppearance } from "@/lib/appearance";
import { LANGUAGE_OPTIONS, pick, t } from "@/lib/i18n";

const THEME_PRESETS = [
  { mode: "day", accent: "blue", font: "default", skin: "clean", language: "zh-CN", labelZh: "白天蓝色", labelEn: "Day Blue" },
  { mode: "night", accent: "gray", font: "rounded", skin: "tech", language: "zh-CN", labelZh: "夜间科技", labelEn: "Night Tech" },
  { mode: "eye-care", accent: "green", font: "default", skin: "gentle", language: "zh-CN", labelZh: "护眼温和", labelEn: "Eye-care Gentle" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickSkinOpen, setQuickSkinOpen] = useState(false);
  const [teacherUnread, setTeacherUnread] = useState(0);

  const teacherNav = useMemo(
    () => [
      { href: "/teacher", label: pick(language, "教师工作台", "Teacher Workspace") },
      { href: "/teacher/course", label: pick(language, "智能课程设计", "Course Design") },
      { href: "/teacher/ai-config", label: pick(language, "AI 助教配置", "AI Assistant Setup") },
      { href: "/teacher/assignments", label: pick(language, "作业任务管理", "Assignments") },
      { href: "/teacher/discussions", label: pick(language, "课程讨论空间", "Discussion Spaces") },
      { href: "/teacher/questions", label: pick(language, "学生提问中心", "Student Questions") },
      { href: "/teacher/materials", label: pick(language, "教学资料库", "Teaching Materials") },
      { href: "/teacher/material-update", label: pick(language, "PPT / 教案更新", "PPT / Lesson Update") },
      { href: "/teacher/feedback", label: pick(language, "匿名问卷分析", "Feedback Analytics") },
    ],
    [language],
  );

  const studentNav = useMemo(
    () => [
      { href: "/student", label: pick(language, "学生学习台", "Student Workspace") },
      { href: "/student/qa", label: pick(language, "课程专属 AI 助教", "Course AI Assistant") },
      { href: "/student/questions", label: pick(language, "学习问答记录", "Q&A History") },
      { href: "/student/discussions", label: pick(language, "课程讨论空间", "Discussion Spaces") },
      { href: "/student/materials", label: pick(language, "课堂共享资料", "Shared Materials") },
      { href: "/student/weakness", label: pick(language, "薄弱点分析", "Weakness Analysis") },
      { href: "/student/assignments", label: pick(language, "作业任务中心", "Assignment Center") },
      { href: "/student/feedback", label: pick(language, "匿名课堂反馈", "Anonymous Feedback") },
    ],
    [language],
  );

  const adminNav = useMemo(
    () => [
      { href: "/admin/users", label: pick(language, "用户管理", "User Management") },
      { href: "/teacher/discussions", label: pick(language, "讨论空间总览", "Discussion Overview") },
      { href: "/teacher/materials", label: pick(language, "资料共享总览", "Material Overview") },
    ],
    [language],
  );

  const navItems = useMemo(() => {
    if (!user) return [];
    return user.role === "admin" ? adminNav : user.role === "teacher" ? teacherNav : studentNav;
  }, [adminNav, studentNav, teacherNav, user]);

  useEffect(() => {
    setMenuOpen(false);
    setQuickSkinOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user || user.role !== "teacher") return;
    let alive = true;
    api.listTeacherNotifications()
      .then((items) => {
        if (alive) setTeacherUnread(items.filter((item) => !item.is_read).length);
      })
      .catch(() => {
        if (alive) setTeacherUnread(0);
      });
    return () => {
      alive = false;
    };
  }, [pathname, user]);

  const unreadCount = user?.role === "teacher" ? teacherUnread : 0;

  const openAuth = (mode: "login" | "register") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const applyPreset = async (preset: { mode: string; accent: string; font: string; skin: string; language: string }) => {
    applyAppearance(preset);
    persistAppearance(preset);
    setLanguage(preset.language === "en-US" ? "en-US" : "zh-CN");
    setQuickSkinOpen(false);
    if (isAuthenticated) {
      try {
        await api.updateMyAppearance(preset);
      } catch {
        // ignore sync failure
      }
    }
  };

  const handleLanguageChange = async (nextLanguage: "zh-CN" | "en-US") => {
    setLanguage(nextLanguage);
    const nextAppearance = {
      mode: document.documentElement.dataset.themeMode || "day",
      accent: document.documentElement.dataset.themeAccent || "blue",
      font: document.documentElement.dataset.themeFont || "default",
      skin: document.documentElement.dataset.themeSkin || "clean",
      language: nextLanguage,
    };
    if (isAuthenticated) {
      try {
        await api.updateMyAppearance(nextAppearance);
      } catch {
        // ignore sync failure
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    router.push("/");
  };

  const userRoleLabel = user?.role === "admin" ? t(language, "admin") : user?.role === "teacher" ? t(language, "teacher") : t(language, "student");
  const roleHint = user?.role === "admin" ? t(language, "adminRoleHint") : user?.role === "teacher" ? t(language, "teacherRoleHint") : t(language, "studentRoleHint");

  return (
    <>
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-8 pt-5 md:px-6">
        <header className="glass-panel rounded-[28px] px-5 py-4 md:px-7">
          <div className="flex flex-wrap items-center gap-4">
            <Link href={isAuthenticated ? (user?.role === "admin" ? "/admin/users" : user?.role === "teacher" ? "/teacher" : "/student") : "/"} className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{t(language, "platformTag")}</p>
              <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-slate-900">{t(language, "platformTitle")}</h1>
            </Link>

            {isAuthenticated && navItems.length > 0 ? (
              <nav className="hidden flex-wrap items-center gap-2 xl:flex">
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "ui-pill-active" : "ui-pill"}`}>
                      {item.label}
                      {item.href === "/teacher/questions" && unreadCount > 0 ? ` (${unreadCount})` : ""}
                    </Link>
                  );
                })}
              </nav>
            ) : null}

            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setQuickSkinOpen((prev) => !prev)} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
                {t(language, "appearance")}
              </button>
              {!loading && !isAuthenticated ? (
                <>
                  <button onClick={() => openAuth("login")} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
                    {t(language, "login")}
                  </button>
                  <button onClick={() => openAuth("register")} className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
                    {t(language, "register")}
                  </button>
                </>
              ) : null}
              {!loading && isAuthenticated && user ? (
                <button onClick={() => setMenuOpen((prev) => !prev)} className="flex items-center gap-3 rounded-full border border-white/70 bg-white/80 px-2 py-2 shadow-sm transition hover:bg-white">
                  <AvatarBadge name={user.display_name || user.account} avatarPath={user.profile.avatar_path} size="sm" />
                  <div className="hidden text-left md:block">
                    <p className="text-sm font-semibold text-slate-900">{user.display_name || user.account}</p>
                    <p className="text-xs text-slate-500">{userRoleLabel}</p>
                  </div>
                </button>
              ) : null}
            </div>
          </div>

          {isAuthenticated && navItems.length > 0 ? (
            <nav className="mt-4 flex flex-wrap gap-2 xl:hidden">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "ui-pill-active" : "ui-pill"}`}>
                    {item.label}
                    {item.href === "/teacher/questions" && unreadCount > 0 ? ` (${unreadCount})` : ""}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </header>

        <div className="flex-1 pt-5">{children}</div>
      </div>

      {quickSkinOpen ? (
        <div className="fixed right-4 top-20 z-[85] w-[min(28rem,calc(100vw-2rem))] rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_28px_60px_rgba(20,33,61,0.22)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{t(language, "quickTheme")}</p>
              <p className="mt-1 text-xs leading-6 text-slate-500">
                {pick(language, "设置入口统一收纳在右上角，语言与外观会按账号分别保存。", "Theme and language are grouped in the top-right menu and saved per account.")}
              </p>
            </div>
            <button onClick={() => setQuickSkinOpen(false)} className="ui-pill rounded-full px-3 py-1.5 text-xs font-semibold">
              {t(language, "close")}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {THEME_PRESETS.map((preset) => (
              <button key={`${preset.mode}-${preset.accent}`} onClick={() => void applyPreset(preset)} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
                {pick(language, preset.labelZh, preset.labelEn)}
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm font-semibold text-slate-900">{pick(language, "语言", "Language")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((item) => (
                <button key={item.value} onClick={() => void handleLanguageChange(item.value)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${language === item.value ? "ui-pill-active" : "ui-pill"}`}>
                  {item.label}
                </button>
              ))}
            </div>
            <Link href="/settings" className="mt-4 inline-flex rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
              {t(language, "enterSettings")}
            </Link>
          </div>
        </div>
      ) : null}

      {menuOpen && user ? (
        <div className="fixed right-4 top-20 z-[90] w-[min(24rem,calc(100vw-2rem))] rounded-[28px] border border-slate-200 bg-white/96 p-4 shadow-[0_28px_60px_rgba(20,33,61,0.24)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <AvatarBadge name={user.display_name || user.account} avatarPath={user.profile.avatar_path} size="lg" />
              <div>
                <p className="text-lg font-bold text-slate-900">{user.display_name || user.account}</p>
                <p className="mt-1 text-sm text-slate-500">{user.account}</p>
                <p className="mt-1 text-xs leading-6 text-slate-500">{roleHint}</p>
              </div>
            </div>
            <button onClick={() => setMenuOpen(false)} className="ui-pill rounded-full px-3 py-1.5 text-xs font-semibold">
              {t(language, "close")}
            </button>
          </div>

          <div className="mt-4 rounded-[22px] bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p><span className="font-semibold text-slate-900">{pick(language, "当前角色：", "Current role: ")}</span>{userRoleLabel}</p>
            <p><span className="font-semibold text-slate-900">{pick(language, "当前头像：", "Avatar: ")}</span>{pick(language, user.profile.avatar_path ? "已设置自定义头像" : "使用默认头像", user.profile.avatar_path ? "Custom avatar set" : "Using default avatar")}</p>
          </div>

          <div className="mt-4 grid gap-2 text-sm">
            <Link href="/profile" className="ui-pill rounded-[18px] px-4 py-3 font-semibold text-slate-800">{t(language, "profileCenter")}</Link>
            <Link href="/settings" className="ui-pill rounded-[18px] px-4 py-3 font-semibold text-slate-800">{t(language, "settingsCenter")}</Link>
            <Link href="/settings#account-security" className="ui-pill rounded-[18px] px-4 py-3 font-semibold text-slate-800">{t(language, "changePassword")}</Link>
            {user.role === "admin" ? <Link href="/admin/users" className="ui-pill rounded-[18px] px-4 py-3 font-semibold text-slate-800">{pick(language, "用户管理", "User Management")}</Link> : null}
            <button onClick={() => void handleLogout()} className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-left font-semibold text-rose-600">{t(language, "logout")}</button>
          </div>
        </div>
      ) : null}

      <AuthModal open={authOpen} initialMode={authMode} onClose={() => setAuthOpen(false)} />
    </>
  );
}
