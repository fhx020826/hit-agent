export type LanguageCode = "zh-CN" | "en-US";

export const LANGUAGE_OPTIONS: { value: LanguageCode; label: string }[] = [
  { value: "zh-CN", label: "中文" },
  { value: "en-US", label: "English" },
];

type Dict = Record<string, { "zh-CN": string; "en-US": string }>;

const dict: Dict = {
  platformTag: { "zh-CN": "教师教学全流程智能伙伴", "en-US": "AI Teaching Workflow Partner" },
  platformTitle: { "zh-CN": "面向前沿学科的智能教学平台", "en-US": "Intelligent Teaching Platform for Frontier Disciplines" },
  appearance: { "zh-CN": "外观", "en-US": "Theme" },
  login: { "zh-CN": "登录", "en-US": "Log In" },
  register: { "zh-CN": "注册", "en-US": "Sign Up" },
  profileCenter: { "zh-CN": "个人中心", "en-US": "Profile" },
  settingsCenter: { "zh-CN": "设置中心", "en-US": "Settings" },
  changePassword: { "zh-CN": "修改密码", "en-US": "Change Password" },
  logout: { "zh-CN": "退出登录", "en-US": "Log Out" },
  teacherRoleHint: { "zh-CN": "教师工作视图已启用", "en-US": "Teacher workspace is active" },
  studentRoleHint: { "zh-CN": "学生学习视图已启用", "en-US": "Student workspace is active" },
  adminRoleHint: { "zh-CN": "管理员全局管理视图已启用", "en-US": "Admin global workspace is active" },
  quickTheme: { "zh-CN": "快速外观切换", "en-US": "Quick Theme Switch" },
  enterSettings: { "zh-CN": "进入设置中心", "en-US": "Open Settings" },
  close: { "zh-CN": "关闭", "en-US": "Close" },
  teacher: { "zh-CN": "教师", "en-US": "Teacher" },
  student: { "zh-CN": "学生", "en-US": "Student" },
  admin: { "zh-CN": "管理员", "en-US": "Admin" },
};

export function t(language: string | undefined, key: keyof typeof dict) {
  const lang = language === "en-US" ? "en-US" : "zh-CN";
  return dict[key][lang];
}

export function pick(language: string | undefined, zh: string, en: string) {
  return language === "en-US" ? en : zh;
}
