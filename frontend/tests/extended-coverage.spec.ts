import { expect, test, type Page } from "@playwright/test";

const runId = `${Date.now()}`;
const advancedQuestion = `扩展问题中心问题 ${runId}`;
const discussionMessage = `扩展讨论消息 ${runId}`;
const liveMaterialName = `live-share-${runId}.txt`;
const TOKEN_KEY = "hit-agent-token";
const API_PORT = process.env.PLAYWRIGHT_API_PORT || "8000";

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
  await expect(modal).toBeVisible();
  if (mode === "注册") {
    await modal.getByRole("button", { name: "注册" }).click();
  }
  await modal.getByRole("button", { name: role }).click();
}

async function login(page: Page, role: "教师" | "学生" | "管理员", account: string, password: string) {
  await openAuth(page, "登录", role);
  await page.getByPlaceholder("建议使用学号、工号或易记账号").fill(account);
  await page.getByPlaceholder("请输入密码").fill(password);
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForFunction((tokenKey) => Boolean(window.localStorage.getItem(tokenKey)), TOKEN_KEY);
  const expectedPath = role === "管理员" ? /\/admin\/users$/ : role === "教师" ? /\/teacher$/ : /\/student$/;
  await expect(page).toHaveURL(expectedPath);
}

async function logout(page: Page) {
  await page.goto("/settings");
  const logoutButton = page.getByRole("button", { name: /退出登录|Log Out/ });
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();
  await expect
    .poll(async () => await page.evaluate((tokenKey) => window.localStorage.getItem(tokenKey), TOKEN_KEY))
    .toBeNull();
  await expect(page).toHaveURL(/\/$/);
  await waitForAuthEntry(page);
}

async function fetchApi<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(
    async ({ apiPath, tokenKey, apiPort }) => {
      const token = window.localStorage.getItem(tokenKey) || "";
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:${apiPort}${apiPath}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    { apiPath: path, tokenKey: TOKEN_KEY, apiPort: API_PORT },
  );
}

test.describe.serial("extended coverage verification", () => {
  test("legacy redirects admin filter teacher settings profile assignment review and analytics pages", async ({ page }) => {
    test.slow();
    await page.goto("/teacher/register");
    await expect(page).toHaveURL(/\/$/);
    await waitForAuthEntry(page);

    await page.goto("/student/register");
    await expect(page).toHaveURL(/\/$/);
    await waitForAuthEntry(page);

    await login(page, "管理员", "admin_demo", "Admin123!");
    await page.goto("/admin/users");
    await expect(page.getByText("用户管理与角色权限控制")).toBeVisible();
    await page.getByLabel("角色筛选").selectOption("teacher");
    await page.getByRole("button", { name: "搜索" }).click();
    await expect(page.getByText("teacher_demo")).toBeVisible();
    await expect(page.getByText("student_demo")).toHaveCount(0);
    await logout(page);

    await login(page, "教师", "teacher_demo", "Teacher123!");
    const teacherCourses = await fetchApi<Array<{ id: string; name: string }>>(page, "/api/courses");
    const primaryCourse = teacherCourses[0];
    expect(primaryCourse).toBeTruthy();
    const lessonPacks = await fetchApi<Array<{ id: string; course_id: string }>>(
      page,
      `/api/lesson-packs?course_id=${encodeURIComponent(primaryCourse.id)}`,
    );
    const primaryLessonPack = lessonPacks[0];
    expect(primaryLessonPack).toBeTruthy();

    await page.goto("/teacher/settings");
    await expect(page).toHaveURL(/\/settings$/);
    await page.getByRole("button", { name: "English" }).click();
    await page.getByRole("button", { name: "Tech" }).click();
    await page.getByRole("button", { name: "Save Settings" }).click();
    await expect(page.getByText("Theme and language settings have been saved")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Account, Language and Theme Settings" })).toBeVisible();

    await page.goto("/profile");
    await page.getByRole("button", { name: "Forest" }).click();
    await page.locator("label:has-text('Upload Image') input[type='file']").setInputFiles({
      name: `avatar-${runId}.png`,
      mimeType: "image/png",
      buffer: Buffer.from("\x89PNG\r\n\x1a\nextended-avatar"),
    });
    await expect(page.getByText("Avatar updated")).toBeVisible();
    await page.getByLabel("Biography").fill(`Extended coverage profile ${runId}`);
    await page.getByRole("button", { name: "Save Profile" }).click();
    await expect(page.getByText("Profile saved")).toBeVisible();

    await page.goto("/teacher/assignment-review");
    await page.locator("form select").first().selectOption(primaryCourse.id);
    await page.getByLabel(/任务标题|Task Title/).fill(`扩展批改 ${runId}`);
    await page.getByLabel(/学生提交内容|Student Submission/).fill("这是一份用于扩展覆盖的作业正文。");
    await page.getByRole("button", { name: /生成辅助批改参考|Generate Review Notes/ }).click();
    await expect(page.getByText(/整体评价|Overall Summary/)).toBeVisible({ timeout: 30000 });

    await page.goto(`/teacher/lesson-pack/${primaryLessonPack.id}`);
    await expect(page.getByRole("heading", { name: /课程包详情|Lesson Pack/ })).toBeVisible();
    await page.getByRole("link", { name: /查看复盘|Open Review/ }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher/review\\?lp_id=${primaryLessonPack.id}`));
    await expect(page.getByText(/教师复盘|Teacher Review/)).toBeVisible();
    await expect(page.getByText(/高频问题|High-frequency Topics/)).toBeVisible();

    await page.goto("/settings");
    await page.getByRole("button", { name: "中文" }).click();
    await page.getByRole("button", { name: "简洁风" }).click();
    await page.getByRole("button", { name: "保存设置" }).click();
    await expect(page.getByText("外观与语言设置已保存")).toBeVisible();
    await logout(page);

    await login(page, "学生", "student_demo", "Student123!");
    await page.goto("/student/settings");
    await expect(page).toHaveURL(/\/settings$/);
    await logout(page);
  });

  test("teacher question center advanced filters and discussion advanced interactions", async ({ page }) => {
    test.slow();
    await login(page, "教师", "teacher_demo", "Teacher123!");
    await page.goto("/teacher/questions");
    const allCoursesButton = page.getByRole("button", { name: "全部课程" });
    const teacherCourseFilterGroup = allCoursesButton.locator("..");
    const firstTeacherCourseFilter = teacherCourseFilterGroup.getByRole("button").nth(1);
    await expect(firstTeacherCourseFilter).toBeVisible();
    const teacherVisibleCourseName = (await firstTeacherCourseFilter.textContent())?.trim() || "";
    expect(teacherVisibleCourseName).toBeTruthy();
    await logout(page);

    await login(page, "学生", "student_demo", "Student123!");
    const studentCourses = await fetchApi<Array<{ id: string; name: string }>>(page, "/api/courses");
    const targetCourse = studentCourses.find((item) => item.name === teacherVisibleCourseName) || studentCourses[0];
    expect(targetCourse).toBeTruthy();
    await page.goto("/student/qa");
    await page.getByLabel("所属课程").selectOption(targetCourse.id);
    await page.getByRole("button", { name: "由教师回答" }).click();
    await page.getByRole("textbox").nth(0).fill(advancedQuestion);
    await page.getByRole("button", { name: "提交问题" }).click();
    await expect(page.getByText(/问题已发送给教师|问题已提交/)).toBeVisible({ timeout: 30000 });

    await page.goto("/student/discussions");
    await page.locator("label:has-text('上传图片 / 文档') input[type='file']").setInputFiles({
      name: `discussion-${runId}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from("discussion attachment for extended coverage"),
    });
    await expect(page.getByText("附件上传成功。")).toBeVisible();
    await page.getByPlaceholder(/输入消息/).fill(discussionMessage);
    await page.getByLabel("匿名发送").check();
    await page.getByLabel("请 AI 回答").check();
    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.getByText("消息已发送。")).toBeVisible();
    await expect(page.getByText(discussionMessage)).toBeVisible();
    await page.getByPlaceholder("按关键词搜索聊天内容").fill(discussionMessage);
    await page.getByRole("button", { name: "搜索消息" }).click();
    const searchPanel = page.getByText("聊天记录查询").locator("..");
    await expect(searchPanel.locator("p.line-clamp-2").filter({ hasText: discussionMessage })).toBeVisible();
    await logout(page);

    await login(page, "教师", "teacher_demo", "Teacher123!");
    await page.goto("/teacher/questions");
    await expect(page.getByText("学生提问反馈中心")).toBeVisible();
    const currentAllCoursesButton = page.getByRole("button", { name: "全部课程" });
    const statusFilterGroup = page.getByRole("button", { name: "全部状态" }).locator("..");
    await statusFilterGroup.getByRole("button", { name: "全部状态", exact: true }).click();
    await statusFilterGroup.getByRole("button", { name: "待处理", exact: true }).click();
    await page.getByRole("button", { name: teacherVisibleCourseName }).click();
    await currentAllCoursesButton.click();
    await page.getByRole("button", { name: advancedQuestion }).click();
    const notificationAction = page.getByRole("button", { name: /标记已读|撤回已读/ }).first();
    await notificationAction.click();
    await expect(page.getByRole("button", { name: /标记已读|撤回已读/ }).first()).toBeVisible();
    await page.getByRole("button", { name: "关闭问题" }).click();
    await expect.poll(async () => {
      const teacherQuestions = await fetchApi<Array<{ question_text: string; teacher_reply_status: string }>>(
        page,
        "/api/qa/teacher/questions",
      );
      return teacherQuestions.find((item) => item.question_text === advancedQuestion)?.teacher_reply_status || "";
    }).toBe("closed");
    await statusFilterGroup.getByRole("button", { name: "已关闭", exact: true }).click();
    await page.getByRole("button", { name: advancedQuestion }).click();
    await page.getByRole("button", { name: "重新设为待处理" }).click();
    await expect.poll(async () => {
      const teacherQuestions = await fetchApi<Array<{ question_text: string; teacher_reply_status: string }>>(
        page,
        "/api/qa/teacher/questions",
      );
      return teacherQuestions.find((item) => item.question_text === advancedQuestion)?.teacher_reply_status || "";
    }).toBe("pending");
    await statusFilterGroup.getByRole("button", { name: "待处理", exact: true }).click();
    await page.getByRole("button", { name: advancedQuestion }).click();
    await page.getByPlaceholder(/请输入教师回复内容/).fill(`扩展教师回复 ${runId}`);
    await page.getByRole("button", { name: "提交回复" }).click();
    const updatedTeacherQuestions = await fetchApi<Array<{ question_text: string; teacher_reply_status: string; teacher_answer_content: string }>>(
      page,
      "/api/qa/teacher/questions",
    );
    const updatedQuestion = updatedTeacherQuestions.find((item) => item.question_text === advancedQuestion);
    expect(updatedQuestion?.teacher_reply_status).toBe("replied");
    expect(updatedQuestion?.teacher_answer_content).toContain(`扩展教师回复 ${runId}`);
    await logout(page);
  });

  test("teacher and student live share pages sync in real browser", async ({ browser }) => {
    test.slow();
    const teacherContext = await browser.newContext();
    const studentContext = await browser.newContext();
    const teacherPage = await teacherContext.newPage();
    const studentPage = await studentContext.newPage();

    await login(teacherPage, "教师", "teacher_demo", "Teacher123!");
    const teacherCourses = await fetchApi<Array<{ id: string; name: string }>>(teacherPage, "/api/courses");
    const primaryCourse = teacherCourses[0];
    expect(primaryCourse).toBeTruthy();
    await teacherPage.goto("/teacher/materials");
    await teacherPage.getByLabel("所属课程").selectOption(primaryCourse.id);
    await teacherPage.locator("label:has-text('选择文件') input[type='file']").setInputFiles({
      name: liveMaterialName,
      mimeType: "text/plain",
      buffer: Buffer.from(`live material body ${runId}`),
    });
    await expect(teacherPage.getByText("资料上传成功。")).toBeVisible({ timeout: 30000 });

    const materialCard = teacherPage.getByText(liveMaterialName, { exact: true }).locator("xpath=ancestor::div[2]");
    await expect(materialCard).toBeVisible();
    await materialCard.getByRole("button", { name: "开始共享展示" }).click();
    await expect(teacherPage).toHaveURL(/\/teacher\/materials\/live\//);
    await expect(teacherPage.getByText("教师批注工具")).toBeVisible();

    await login(studentPage, "学生", "student_demo", "Student123!");
    await studentPage.goto("/student/materials");
    await studentPage.getByLabel("当前课程").selectOption(primaryCourse.id);
    await expect(studentPage.getByText("教师正在共享课堂内容")).toBeVisible({ timeout: 30000 });
    await studentPage.getByRole("button", { name: "进入同步查看" }).click();
    await expect(studentPage).toHaveURL(/\/student\/materials\/live\//);
    await expect(studentPage.getByText("学生只读视图")).toBeVisible();

    await teacherPage.getByRole("button", { name: "下一页" }).click();
    await expect(studentPage.getByText("第 2 页", { exact: true })).toBeVisible({ timeout: 30000 });

    await teacherPage.getByRole("button", { name: "结束共享不保存" }).click();
    await expect(studentPage.getByText("教师已结束共享。")).toBeVisible({ timeout: 30000 });

    await teacherContext.close();
    await studentContext.close();
  });
});
