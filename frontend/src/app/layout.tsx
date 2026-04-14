import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/components/auth-provider";
import { AppearanceProvider } from "@/components/appearance-provider";
import { LanguageProvider } from "@/components/language-provider";
import { ToastProvider } from "@/components/toast-provider";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "面向前沿学科的智能教学平台",
  description: "教师教学全流程智能伙伴平台，支持智能课程设计、问答互动、作业闭环与匿名反馈。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" data-theme-mode="day" data-theme-accent="blue" data-theme-font="default" data-theme-skin="clean">
      <body className="app-shell min-h-full">
        <AppearanceProvider>
          <AuthProvider>
            <LanguageProvider>
              <ToastProvider>
                <AppShell>{children}</AppShell>
              </ToastProvider>
            </LanguageProvider>
          </AuthProvider>
        </AppearanceProvider>
      </body>
    </html>
  );
}
