import { expect, test, type Page } from "@playwright/test";

const runId = `${Date.now()}`;
const teacherAccount = `teacher_ui_${runId}`;
const teacherPasswordInitial = `Teacher!${runId}`;
const teacherPasswordUpdated = `Teacher#${runId}`;
const teacherDisplayName = `教师原子测试${runId}`;

const studentAccount = `student_ui_${runId}`;
const studentPassword = `Student!${runId}`;
const studentDisplayName = `学生原子测试${runId}`;

const adminCreatedAccount = `admin_created_${runId}`;
const adminCreatedPassword = `Admin!${runId}`;

const courseName = `原子功能课程${runId}`;
const className = `原子测试班${runId}`;
const assignmentTitle = `原子作业${runId}`;
const folderName = `原子归档${runId}`;
const materialUpdateTitle = `课件更新${runId}`;
const discussionMessage = `讨论区原子消息 ${runId}`;
const questionText = `请解释 TCP 三次握手与四次挥手的区别 ${runId}`;
const materialRequestText = `请共享本节课讲义 ${runId}`;
const teacherReplyText = `教师补充说明：TCP 建连与断连的状态迁移不同 ${runId}`;

async function waitForAuthEntry(page: Page) {
  const loginButton = page.getByRole("button", { name: /^(登录|Log In)$/ });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.waitForTimeout(1500);
    if (await loginButton.count()) {
      await expect(loginButton).toBeVisible();
      return;
    }
    await page.reload();
  }
  await expect(loginButton).toBeVisible();
}

async function openAuth(page: Page, mode: "登录" | "注册", role: "教师" | "学生" | "管理员") {
  await page.goto("/");
  await waitForAuthEntry(page);
  const triggerName = mode === "登录" ? /^(登录|Log In)$/ : /^(注册|Sign Up)$/;
  await page.getByRole("button", { name: triggerName }).click();
  const modal = page.locator("div.fixed.inset-0").last();
  await expect(modal.getByRole("heading", { name: "登录平台账号" })).toBeVisible();
  if (mode === "注册") {
    await modal.getByRole("button", { name: "注册" }).click();
    await expect(modal.getByRole("heading", { name: "注册平台账号" })).toBeVisible();
  }
  await modal.getByRole("button", { name: role }).click();
}

async function registerTeacher(page: Page) {
  await openAuth(page, "注册", "教师");
  await page.getByPlaceholder("建议使用学号、工号或易记账号").fill(teacherAccount);
  await page.getByPlaceholder("请输入密码").fill(teacherPasswordInitial);
  await page.getByPlaceholder("请再次输入密码").fill(teacherPasswordInitial);
  await page.getByPlaceholder("请输入真实姓名").fill(teacherDisplayName);
  await page.getByLabel("工号").fill(`T${runId}`);
  await page.getByLabel("学院").fill("计算机学院");
  await page.getByLabel("专业方向").fill("网络工程");
  await page.getByLabel("所属教研室").fill("网络教研室");
  await page.getByLabel("教学组").fill("原子测试组");
  await page.getByLabel("岗位称谓").fill("讲师");
  await page.getByLabel("关联班级").fill(className);
  await page.getByRole("button", { name: "完成注册" }).click();
  await page.waitForURL(/\/teacher$/);
  await expect(page.getByRole("link", { name: "智能课程设计", exact: true })).toBeVisible();
}

async function registerStudent(page: Page) {
  await openAuth(page, "注册", "学生");
  await page.getByPlaceholder("建议使用学号、工号或易记账号").fill(studentAccount);
  await page.getByPlaceholder("请输入密码").fill(studentPassword);
  await page.getByPlaceholder("请再次输入密码").fill(studentPassword);
  await page.getByPlaceholder("请输入真实姓名").fill(studentDisplayName);
  await page.getByLabel("学号").fill(`S${runId}`);
  await page.getByLabel("学院").fill("计算机学院");
  await page.getByLabel("专业").fill("计算机科学与技术");
  await page.getByLabel("年级").fill("2026级");
  await page.getByLabel("班级").fill(className);
  await page.getByRole("button", { name: "完成注册" }).click();
  await page.waitForURL(/\/student$/);
  await expect(page.getByRole("link", { name: "课程专属 AI 助教", exact: true })).toBeVisible();
}

async function login(page: Page, role: "教师" | "学生" | "管理员", account: string, password: string) {
  await openAuth(page, "登录", role);
  await page.getByPlaceholder("建议使用学号、工号或易记账号").fill(account);
  await page.getByPlaceholder("请输入密码").fill(password);
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForFunction(() => Boolean(window.localStorage.getItem("hit-agent-token")));
  const expectedPath = role === "管理员" ? /\/admin\/users$/ : role === "教师" ? /\/teacher$/ : /\/student$/;
  await expect(page).toHaveURL(expectedPath);
}

async function logout(page: Page) {
  await page.goto("/settings");
  const logoutButton = page.getByRole("button", { name: /退出登录|Log Out/ });
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();
  await expect
    .poll(async () => await page.evaluate(() => window.localStorage.getItem("hit-agent-token")))
    .toBeNull();
  await expect(page).toHaveURL(/\/$/);
  await waitForAuthEntry(page);
}

test.describe.serial("atomic feature verification", () => {
  test("auth routing and admin user management", async ({ page }) => {
    await registerTeacher(page);
    await logout(page);

    await registerStudent(page);
    await logout(page);

    await login(page, "管理员", "admin_demo", "Admin123!");
    await expect(page.getByRole("heading", { name: "用户管理与角色权限控制" })).toBeVisible();

    await page.getByLabel("账号").fill(adminCreatedAccount);
    await page.getByLabel("密码").fill(adminCreatedPassword);
    await page.getByLabel("显示名").fill(`管理员创建${runId}`);
    await page.getByLabel("姓名").fill(`管理员创建${runId}`);
    await page.getByLabel("班级 / 教研室").fill(className);
    await page.getByLabel("学院").fill("计算机学院");
    await page.getByLabel("邮箱").fill(`admin_created_${runId}@example.com`);
    await page.getByRole("button", { name: "创建用户" }).click();
    await expect(page.getByText("用户创建成功。")).toBeVisible();
    await expect(page.getByText(adminCreatedAccount)).toBeVisible();

    await page.getByPlaceholder("搜索账号、姓名、班级、邮箱").fill(adminCreatedAccount);
    await page.getByRole("button", { name: "搜索" }).click();
    await expect(page.getByText(adminCreatedAccount)).toBeVisible();
    await page.getByText(adminCreatedAccount).locator("..").locator("..").getByRole("button", { name: "删除" }).click();
    await expect(page.getByText("用户已删除。")).toBeVisible();
    await expect(page.getByText(adminCreatedAccount)).toHaveCount(0);

    await logout(page);
  });

  test("teacher profile settings course lesson-pack ai-config and material-update", async ({ page }) => {
    await login(page, "教师", teacherAccount, teacherPasswordInitial);
    await expect(page.getByRole("link", { name: "智能课程设计", exact: true })).toBeVisible();

    await page.goto("/profile");
    await page.getByRole("button", { name: "森林风格" }).click();
    await page.getByLabel("个人简介").fill(`教师资料原子验证 ${runId}`);
    await page.getByLabel("关联班级").fill(className);
    await page.getByRole("button", { name: "保存个人资料" }).click();
    await expect(page.getByText("个人资料已保存")).toBeVisible();

    await page.goto("/settings");
    await page.getByRole("button", { name: "夜间模式" }).click();
    await page.getByRole("button", { name: "绿色" }).click();
    await page.getByRole("button", { name: "衬线字体" }).click();
    await page.getByRole("button", { name: "保存设置" }).click();
    await expect(page.getByText("外观与语言设置已保存")).toBeVisible();

    await page.locator("input[type='password']").nth(0).fill(teacherPasswordInitial);
    await page.locator("input[type='password']").nth(1).fill(teacherPasswordUpdated);
    await page.locator("input[type='password']").nth(2).fill(teacherPasswordUpdated);
    await page.getByRole("button", { name: "更新密码" }).click();

    await logout(page);
    await login(page, "教师", teacherAccount, teacherPasswordUpdated);
    await expect(page.getByRole("link", { name: "智能课程设计", exact: true })).toBeVisible();

    await page.goto("/teacher/course");
    await page.getByLabel("课程名称").fill(courseName);
    await page.getByLabel("授课对象").fill("本科生");
    await page.getByLabel("授课班级").fill(className);
    await page.getByLabel("学生水平").fill("中等");
    await page.getByLabel("当前章节").fill("运输层");
    await page.getByLabel("课程目标").fill("理解 TCP 与 UDP 的差异");
    await page.getByLabel("拟融入的前沿方向").fill("智能网络调度");
    await page.getByRole("button", { name: "创建并生成课程包" }).click();
    await expect(page.getByRole("heading", { name: "生成课程包", exact: true })).toBeVisible();
    await expect(page.getByText("已完成生成")).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: /发布给学生|已发布给学生/ }).click();
    await expect(page.getByRole("button", { name: "已发布给学生" })).toBeVisible();

    await page.goto("/teacher/ai-config");
    await page.getByRole("combobox").nth(0).selectOption({ label: courseName });
    await page.getByRole("combobox").nth(1).selectOption("启发型");
    await page.getByRole("button", { name: "保存 AI 助教配置" }).click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.getByRole("combobox").nth(0).selectOption({ label: courseName });
    await expect(page.getByRole("combobox").nth(1)).toHaveValue("启发型");

    await page.goto("/teacher/material-update");
    await page.getByLabel("所属课程").selectOption({ label: courseName });
    await page.getByLabel("更新任务标题").fill(materialUpdateTitle);
    await page.getByLabel("补充说明").fill("补充近两年的协议演进案例");
    await page.getByLabel("材料正文（可选）").fill("原有内容主要介绍 TCP/IP 基础概念。");
    await page.getByRole("button", { name: "生成更新建议", exact: true }).click();
    await expect(page.getByRole("heading", { name: materialUpdateTitle, exact: true })).toBeVisible({ timeout: 30000 });

    await logout(page);
  });

  test("teacher materials assignments and feedback setup", async ({ page }) => {
    await login(page, "教师", teacherAccount, teacherPasswordUpdated);
    await expect(page.getByRole("link", { name: "智能课程设计", exact: true })).toBeVisible();

    await page.goto("/teacher/materials");
    await page.getByLabel("所属课程").selectOption({ label: courseName });
    await page.locator("label:has-text('选择文件') input[type='file']").setInputFiles({
      name: `lesson-${runId}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(`lesson material ${runId}`),
    });
    await expect(page.getByText("资料上传成功。")).toBeVisible({ timeout: 30000 });
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "共享到学生端" }).click();
    await expect(page.getByText("资料已共享到学生端。")).toBeVisible();

    await page.goto("/teacher/assignments");
    await page.getByLabel("所属课程").selectOption({ label: courseName });
    await page.getByLabel("面向班级").selectOption({ label: className });
    await page.getByLabel("作业标题").fill(assignmentTitle);
    await page.getByLabel("作业说明").fill("说明 TCP 与 UDP 的关键差异。");
    await page.getByLabel("截止日期").fill("2026-04-30T23:59");
    await page.getByLabel("附件要求").fill("txt 或 pdf");
    await page.getByLabel("提交格式要求").fill("单文件");
    await page.getByLabel("评分说明").fill("重点看结构和准确性");
    await page.getByRole("button", { name: "发布作业" }).click();
    await expect(page.getByText("作业已发布。")).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: assignmentTitle })).toBeVisible();

    await page.goto("/teacher/feedback");
    await page.getByLabel("所属课程").selectOption({ label: courseName });
    await page.getByLabel("对应课次 / 课程包").selectOption({ index: 1 });
    await page.getByRole("button", { name: "手动触发反馈问卷" }).click();
    await expect(page.getByText("问卷实例已创建。")).toBeVisible({ timeout: 30000 });

    await logout(page);
  });

  test("student materials qa history assignments feedback weakness and discussions", async ({ page }) => {
    await login(page, "学生", studentAccount, studentPassword);
    await page.waitForURL(/\/student$/);
    await expect(page.getByRole("link", { name: "课程专属 AI 助教", exact: true })).toBeVisible();

    await page.goto("/student/materials");
    await page.getByLabel("当前课程").selectOption({ label: courseName });
    await expect(page.getByText("最近共享")).toBeVisible();
    await page.getByRole("textbox").fill(materialRequestText);
    await page.getByRole("button", { name: "发送资料请求" }).click();
    await expect(page.getByText("资料请求已发送给教师")).toBeVisible();

    await page.goto("/student/qa");
    await page.getByLabel("所属课程").selectOption({ label: courseName });
    await page.getByRole("button", { name: "由教师回答" }).click();
    await page.getByRole("textbox").nth(0).fill(questionText);
    await page.getByRole("button", { name: "提交问题" }).click();
    await expect(page.getByText(/问题已发送给教师|AI 已即时回答|问题已提交/)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(questionText)).toBeVisible();

    await page.goto("/student/questions");
    await page.getByLabel("选择课程").selectOption({ label: courseName });
    await expect(page.getByRole("heading", { name: "按课程与文件夹整理高价值问答" })).toBeVisible();
    await page.getByPlaceholder(/新建文件夹名称/).fill(folderName);
    await page.getByRole("button", { name: "创建文件夹" }).click();
    await expect(page.getByText(folderName)).toBeVisible();

    await page.goto("/student/assignments");
    await expect(page.getByText(assignmentTitle)).toBeVisible();
    await page.getByRole("button", { name: "确认收到" }).click();
    await page.locator("label:has-text('选择提交文件') input[type='file']").setInputFiles({
      name: `homework-${runId}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(`assignment answer ${runId}`),
    });
    await page.getByRole("button", { name: /提交作业|重新提交/ }).click();
    await expect(page.getByText("作业已提交")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("AI 辅助批改参考")).toBeVisible();

    await page.goto("/student/feedback");
    await page.getByRole("button", { name: "5 分" }).first().click();
    const textareas = page.locator("textarea");
    await textareas.last().fill(`匿名反馈建议 ${runId}`);
    await page.getByRole("button", { name: "提交匿名反馈" }).first().click();
    await expect(page.getByText("匿名反馈已提交")).toBeVisible({ timeout: 30000 });

    await page.goto("/student/weakness");
    await page.getByRole("button", { name: /重新分析|Refresh Analysis/ }).click();
    await expect(page.getByText(/按课程查看薄弱点分析|View Weakness Analysis by Course/)).toBeVisible();

    await page.goto("/student/discussions");
    await expect(page.getByRole("heading", { name: "围绕课程与班级的群聊式学习协作空间" })).toBeVisible();
    await page.getByPlaceholder(/输入消息/).fill(discussionMessage);
    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.getByText("消息已发送。").first()).toBeVisible();
    await expect(page.getByText(discussionMessage)).toBeVisible();

    await logout(page);
  });

  test("teacher question handling material request and feedback analytics", async ({ page }) => {
    await login(page, "教师", teacherAccount, teacherPasswordUpdated);
    await expect(page.getByRole("link", { name: "智能课程设计", exact: true })).toBeVisible();

    await page.goto("/teacher/materials");
    await page.getByLabel("所属课程").selectOption({ label: courseName });
    await expect(page.getByText(materialRequestText)).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "同意" }).click();

    await page.goto("/teacher/questions");
    await expect(page.getByText(questionText).first()).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: questionText }).click();
    await page.getByRole("textbox").fill(teacherReplyText);
    await page.getByRole("button", { name: "提交回复" }).click();
    await expect(page.getByText("教师回复已更新。")).toBeVisible({ timeout: 30000 });

    await page.goto("/teacher/feedback");
    await page.getByRole("button", { name: "手动触发反馈问卷" }).click();
    await expect(page.getByText("问卷实例已创建")).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "查看统计结果" }).click();
    await expect(page.getByText("已加载匿名反馈统计结果。")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("参与人数")).toBeVisible();
  });
});
