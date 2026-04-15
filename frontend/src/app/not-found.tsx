"use client";

import Link from "next/link";

import { useLanguage } from "@/components/language-provider";
import { pick } from "@/lib/i18n";
import { WorkspacePage } from "@/components/workspace-shell";

export default function NotFound() {
  const { language } = useLanguage();

  return (
    <WorkspacePage className="not-found-page">
      <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
        <div className="text-7xl font-bold text-[var(--muted)]">404</div>
        <h1 className="text-2xl font-semibold">
          {pick(language, "页面未找到", "Page not found")}
        </h1>
        <p className="max-w-md text-[var(--muted)]">
          {pick(
            language,
            "你访问的页面不存在或已被移除。请检查地址是否正确。",
            "The page you are looking for does not exist or has been removed. Please check the URL.",
          )}
        </p>
        <Link
          href="/"
          className="button-primary rounded-full px-6 py-3 text-sm font-semibold"
        >
          {pick(language, "返回首页", "Back to Home")}
        </Link>
      </div>
    </WorkspacePage>
  );
}
