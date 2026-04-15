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
  { mode: "night", accent: "gray", font: "default", skin: "tech", language: "zh-CN", labelZh: "夜间科技", labelEn: "Night Tech" },
  { mode: "eye-care", accent: "green", font: "default", skin: "gentle", language: "zh-CN", labelZh: "护眼温和", labelEn: "Eye-care Gentle" },
] as const;

type NavItem = {
  href: string;
  label: string;
  note?: string;
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith(`${href}?`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [menuOpenPath, setMenuOpenPath] = useState<string | null>(null);
  const [quickSkinOpenPath, setQuickSkinOpenPath] = useState<string | null>(null);
  const [teacherUnread, setTeacherUnread] = useState(0);

  const teacherNav = useMemo<NavItem[]>(
    () => [
      { href: "/teacher", label: pick(language, "教师工作台", "Teacher Workspace"), note: pick(language, "总览", "Overview") },
      { href: "/teacher/course", label: pick(language, "智能课程设计", "Course Design"), note: pick(language, "设计", "Design") },
      { href: "/teacher/lesson-pack", label: pick(language, "课程包生成", "Lesson Packs"), note: pick(language, "课程包", "Packs") },
      { href: "/teacher/ai-config", label: pick(language, "AI 助教配置", "AI Assistant Setup"), note: pick(language, "配置", "Setup") },
      { href: "/teacher/assignments", label: pick(language, "作业任务管理", "Assignments"), note: pick(language, "作业", "Tasks") },
      { href: "/teacher/discussions", label: pick(language, "课程讨论空间", "Discussion Spaces"), note: pick(language, "讨论", "Discussion") },
      { href: "/teacher/questions", label: pick(language, "学生提问中心", "Student Questions"), note: pick(language, "答疑", "Q&A") },
      { href: "/teacher/materials", label: pick(language, "教学资料库", "Teaching Materials"), note: pick(language, "资料", "Materials") },
      { href: "/teacher/material-update", label: pick(language, "PPT / 教案更新", "PPT / Lesson Update"), note: pick(language, "更新", "Update") },
      { href: "/teacher/feedback", label: pick(language, "匿名问卷分析", "Feedback Analytics"), note: pick(language, "反馈", "Feedback") },
    ],
    [language],
  );

  const studentNav = useMemo<NavItem[]>(
    () => [
      { href: "/student", label: pick(language, "学生学习台", "Student Workspace"), note: pick(language, "总览", "Overview") },
      { href: "/student/qa", label: pick(language, "课程专属 AI 助教", "Course AI Assistant"), note: pick(language, "提问", "Ask") },
      { href: "/student/questions", label: pick(language, "学习问答记录", "Q&A History"), note: pick(language, "归档", "Archive") },
      { href: "/student/discussions", label: pick(language, "课程讨论空间", "Discussion Spaces"), note: pick(language, "讨论", "Discuss") },
      { href: "/student/materials", label: pick(language, "课堂共享资料", "Shared Materials"), note: pick(language, "资料", "Materials") },
      { href: "/student/weakness", label: pick(language, "薄弱点分析", "Weakness Analysis"), note: pick(language, "诊断", "Insights") },
      { href: "/student/assignments", label: pick(language, "作业任务中心", "Assignment Center"), note: pick(language, "作业", "Assignments") },
      { href: "/student/feedback", label: pick(language, "匿名课堂反馈", "Anonymous Feedback"), note: pick(language, "反馈", "Feedback") },
    ],
    [language],
  );

  const adminNav = useMemo<NavItem[]>(
    () => [
      { href: "/admin/users", label: pick(language, "用户管理", "User Management"), note: pick(language, "账号", "Accounts") },
      { href: "/teacher/discussions", label: pick(language, "讨论空间总览", "Discussion Overview"), note: pick(language, "讨论", "Discuss") },
      { href: "/teacher/materials", label: pick(language, "资料共享总览", "Material Overview"), note: pick(language, "资料", "Materials") },
    ],
    [language],
  );

  const navItems = useMemo(() => {
    if (!user) return [];
    return user.role === "admin" ? adminNav : user.role === "teacher" ? teacherNav : studentNav;
  }, [adminNav, studentNav, teacherNav, user]);

  const activeItem = useMemo(() => {
    return navItems.find((item) => isActivePath(pathname, item.href)) ?? navItems[0] ?? null;
  }, [navItems, pathname]);

  const mobileNav = useMemo(() => {
    if (!navItems.length) return [];
    const core = navItems.slice(0, 4);
    if (activeItem && !core.some((item) => item.href === activeItem.href)) {
      return [navItems[0], ...core.slice(1, 3), activeItem];
    }
    return core;
  }, [activeItem, navItems]);

  const unreadCount = user?.role === "teacher" ? teacherUnread : 0;
  const roleLabel = user?.role === "admin" ? t(language, "admin") : user?.role === "teacher" ? t(language, "teacher") : t(language, "student");
  const roleHint = user?.role === "admin" ? t(language, "adminRoleHint") : user?.role === "teacher" ? t(language, "teacherRoleHint") : t(language, "studentRoleHint");
  const appRole = user?.role ?? "guest";
  const menuOpen = menuOpenPath === pathname;
  const quickSkinOpen = quickSkinOpenPath === pathname;

  useEffect(() => {
    if (!user || user.role !== "teacher") return;
    let alive = true;
    api.listTeacherNotifications()
      .then((items) => {
        if (alive) {
          setTeacherUnread(items.filter((item) => !item.is_read).length);
        }
      })
      .catch(() => {
        if (alive) {
          setTeacherUnread(0);
        }
      });
    return () => {
      alive = false;
    };
  }, [pathname, user]);

  const openAuth = (mode: "login" | "register") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const handleLogout = async () => {
    await logout();
    setMenuOpenPath(null);
    router.push("/");
  };

  const applyPreset = async (preset: { mode: string; accent: string; font: string; skin: string; language: string }) => {
    applyAppearance(preset);
    persistAppearance(preset);
    setLanguage(preset.language === "en-US" ? "en-US" : "zh-CN");
    setQuickSkinOpenPath(null);
    if (isAuthenticated) {
      try {
        await api.updateMyAppearance(preset);
      } catch {
        // 忽略外观同步失败，不阻塞本地切换
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
        // 忽略语言同步失败，不影响当前界面切换
      }
    }
  };

  const homeHref = isAuthenticated
    ? user?.role === "admin"
      ? "/admin/users"
      : user?.role === "teacher"
        ? "/teacher"
        : "/student"
    : "/";

  const contextTitle = activeItem?.label || pick(language, "平台总览", "Platform Overview");
  const contextNote = isAuthenticated
    ? pick(
        language,
        `${roleLabel}相关的课程、任务、资料和反馈会集中显示在这里。`,
        `${roleLabel} courses, tasks, materials, and feedback are shown here.`,
      )
    : pick(
        language,
        "登录后会自动打开对应角色的工作台。",
        "The correct role workspace opens automatically after login.",
      );

  return (
    <>
      <div className="app-shell shell-frame" data-app-role={appRole}>
        {isAuthenticated && navItems.length > 0 ? (
          <aside className="shell-sidebar">
            <div className="shell-sidebar-inner">
              <div className="shell-sidebar-copy">
                <div>
                  <span className="shell-brand-chip">
                    <span className="shell-brand-dot" />
                    {t(language, "platformTag")}
                  </span>
                  <div className="shell-title">{t(language, "platformTitle")}</div>
                  <p className="shell-subtitle">
                    {pick(
                      language,
                      "把课程、任务、资料与反馈集中到同一个工作台。",
                      "Bring courses, tasks, materials, and feedback into one workspace.",
                    )}
                  </p>
                </div>

                <div className="shell-role-card">
                  <p className="shell-role-label">{pick(language, "当前视角", "Current Lens")}</p>
                  <p className="shell-role-value">{roleLabel}</p>
                  <p className="shell-role-note">{roleHint}</p>
                </div>

                <nav className="shell-nav">
                  {navItems.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    const showUnread = item.href === "/teacher/questions" && unreadCount > 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`shell-nav-link ${active ? "shell-nav-link-active" : ""}`}
                      >
                        <span>{item.label}</span>
                        {showUnread ? <span className="shell-nav-count">{unreadCount}</span> : null}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="shell-sidebar-footer">
                <div className="shell-footnote">
                  {pick(
                    language,
                    "常用入口会按当前角色集中显示。",
                    "Common entry points are grouped for the current role.",
                  )}
                </div>
                <Link className="ui-pill rounded-full px-4 py-3 text-sm font-semibold text-center" href="/settings">
                  {t(language, "settingsCenter")}
                </Link>
              </div>
            </div>
          </aside>
        ) : null}

        <div className="shell-main">
          <header className="shell-topbar glass-panel">
            <div className="shell-topbar-inner">
              <div className="shell-context">
                <div className="shell-context-row">
                  <Link href={homeHref} className="shell-context-chip">
                    {isAuthenticated ? roleLabel : pick(language, "公共入口", "Entry")}
                  </Link>
                  {activeItem?.note ? <span className="shell-context-chip">{activeItem.note}</span> : null}
                </div>
                <div className="shell-context-title">{contextTitle}</div>
                <p className="shell-context-note">{contextNote}</p>
              </div>

              <div className="shell-topbar-actions">
                <button onClick={() => setQuickSkinOpenPath((prev) => (prev === pathname ? null : pathname))} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
                  {t(language, "appearance")}
                </button>
                {!loading && !isAuthenticated ? (
                  <>
                    <button onClick={() => openAuth("login")} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
                      {t(language, "login")}
                    </button>
                    <button onClick={() => openAuth("register")} className="button-primary rounded-full px-4 py-2 text-sm font-semibold">
                      {t(language, "register")}
                    </button>
                  </>
                ) : null}
                {!loading && isAuthenticated && user ? (
                  <button onClick={() => setMenuOpenPath((prev) => (prev === pathname ? null : pathname))} className="shell-profile-button">
                    <AvatarBadge name={user.display_name || user.account} avatarPath={user.profile.avatar_path} size="sm" />
                    <span className="shell-profile-text">
                      <span className="shell-profile-name">{user.display_name || user.account}</span>
                      <span className="shell-profile-role">{roleLabel}</span>
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          </header>

          <div className="shell-content">{children}</div>
        </div>
      </div>

      {isAuthenticated && mobileNav.length > 0 ? (
        <nav className="shell-mobile-nav">
          {mobileNav.map((item) => {
            const active = isActivePath(pathname, item.href);
            const showUnread = item.href === "/teacher/questions" && unreadCount > 0;
            return (
              <Link key={item.href} href={item.href} className={`shell-mobile-link ${active ? "shell-mobile-link-active" : ""}`}>
                <span>{item.label}</span>
                <span className="shell-mobile-link-meta">{showUnread ? unreadCount : item.note}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      {quickSkinOpen ? (
        <div className="fixed right-4 top-20 z-[85] w-[min(30rem,calc(100vw-2rem))] rounded-[28px] border border-slate-200 bg-white/96 p-5 shadow-[0_28px_60px_rgba(20,33,61,0.22)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{t(language, "quickTheme")}</p>
              <p className="mt-1 text-xs leading-6 text-slate-500">
                {pick(language, "快速切换模式、配色和语言，完整设置仍保留在设置中心。", "Switch modes, palette and language here. The full configuration still lives in Settings.")}
              </p>
            </div>
            <button onClick={() => setQuickSkinOpenPath(null)} className="ui-pill rounded-full px-3 py-1.5 text-xs font-semibold">
              {t(language, "close")}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {THEME_PRESETS.map((preset) => (
              <button key={`${preset.mode}-${preset.accent}`} onClick={() => void applyPreset(preset)} className="section-card rounded-[22px] px-4 py-4 text-left transition hover:-translate-y-0.5">
                <p className="text-sm font-semibold text-slate-900">{pick(language, preset.labelZh, preset.labelEn)}</p>
                <p className="mt-1 text-xs leading-6 text-slate-500">
                  {preset.mode === "day"
                    ? pick(language, "适合常规教学与日间浏览。", "Best for regular teaching and daytime browsing.")
                    : preset.mode === "night"
                      ? pick(language, "更适合长时间夜间使用。", "Optimized for longer night sessions.")
                      : pick(language, "降低视觉刺激，适合轻阅读。", "Reduced visual intensity for gentler reading.")}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm font-semibold text-slate-900">{pick(language, "语言", "Language")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => void handleLanguageChange(item.value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${language === item.value ? "ui-pill-active" : "ui-pill"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Link href="/settings" className="button-primary mt-4 inline-flex rounded-full px-4 py-2 text-sm font-semibold">
              {t(language, "enterSettings")}
            </Link>
          </div>
        </div>
      ) : null}

      {menuOpen && user ? (
        <div className="fixed right-4 top-20 z-[90] w-[min(26rem,calc(100vw-2rem))] rounded-[28px] border border-slate-200 bg-white/96 p-4 shadow-[0_28px_60px_rgba(20,33,61,0.24)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <AvatarBadge name={user.display_name || user.account} avatarPath={user.profile.avatar_path} size="lg" />
              <div>
                <p className="text-lg font-bold text-slate-900">{user.display_name || user.account}</p>
                <p className="mt-1 text-sm text-slate-500">{user.account}</p>
                <p className="mt-1 text-xs leading-6 text-slate-500">{roleHint}</p>
              </div>
            </div>
            <button onClick={() => setMenuOpenPath(null)} className="ui-pill rounded-full px-3 py-1.5 text-xs font-semibold">
              {t(language, "close")}
            </button>
          </div>

          <div className="mt-4 rounded-[22px] bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p><span className="font-semibold text-slate-900">{pick(language, "当前角色：", "Current role: ")}</span>{roleLabel}</p>
            <p><span className="font-semibold text-slate-900">{pick(language, "当前头像：", "Avatar: ")}</span>{pick(language, user.profile.avatar_path ? "已设置自定义头像" : "使用默认头像", user.profile.avatar_path ? "Custom avatar set" : "Using default avatar")}</p>
          </div>

          <div className="mt-4 grid gap-2 text-sm">
            <Link href="/profile" className="ui-pill rounded-[18px] px-4 py-3 font-semibold">{t(language, "profileCenter")}</Link>
            <Link href="/settings" className="ui-pill rounded-[18px] px-4 py-3 font-semibold">{t(language, "settingsCenter")}</Link>
            <Link href="/settings#account-security" className="ui-pill rounded-[18px] px-4 py-3 font-semibold">{t(language, "changePassword")}</Link>
            {user.role === "admin" ? <Link href="/admin/users" className="ui-pill rounded-[18px] px-4 py-3 font-semibold">{pick(language, "用户管理", "User Management")}</Link> : null}
            <button onClick={() => void handleLogout()} className="button-danger rounded-[18px] px-4 py-3 text-left font-semibold">{t(language, "logout")}</button>
          </div>
        </div>
      ) : null}

      <AuthModal open={authOpen} initialMode={authMode} onClose={() => setAuthOpen(false)} />
    </>
  );
}
