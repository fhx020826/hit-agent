import { expect, test, type Page } from "@playwright/test";

const runId = `${Date.now()}`;
const TOKEN_KEY = "hit-agent-token";
const API_PORT = process.env.PLAYWRIGHT_API_PORT || "8000";

const journeyTeacherAccount = `teacher_journey_${runId}`;
const journeyTeacherPassword = `Teacher!${runId}`;
const journeyTeacherDisplayName = `教师旅程验证${runId}`;

const journeyStudentAccount = `student_journey_${runId}`;
const journeyStudentPassword = `Student!${runId}`;
const journeyStudentDisplayName = `学生旅程验证${runId}`;

const journeyCourseName = `复杂旅程课程${runId}`;
const journeyClassName = `复杂旅程班${runId}`;
const journeyAssignmentTitle = `复杂旅程作业${runId}`;
const journeyQuestionText = `请说明滑动窗口、拥塞窗口与流量控制之间的关系 ${runId}`;
const journeyFolderName = `旅程归档 ${runId}`;
const journeyDiscussionMessage = `旅程讨论消息 ${runId}`;
const journeyMaterialRequestText = `请共享本节课的详细讲义与板书整理 ${runId}`;
const journeyTeacherReplyText = `教师旅程回复 ${runId}：滑动窗口负责发送边界，拥塞窗口受网络状态约束。`;
const journeyFeedbackText = `旅程匿名反馈 ${runId}：希望增加更多协议状态图。`;
const journeyMaterialName = `journey-material-${runId}.txt`;
const archiveQuestionText = `归档生命周期问题 ${runId}`;
const archiveFolderName = `归档生命周期 ${runId}`;

type PendingSurvey = {
  id: string;
  title: string;
  questions: Array<{
    id: string;
    type: "rating" | "choice" | "text";
    options?: string[];
  }>;
};

type SurveyAnalytics = {
  participation_count: number;
  text_feedback: string[];
};

type TeacherQuestion = {
  question_text: string;
  teacher_reply_status: string;
  teacher_answer_content: string;
};

type CourseSummary = {
  id: string;
  name: string;
};

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

async function registerTeacher(page: Page) {
  await openAuth(page, "注册", "教师");
  await page.getByPlaceholder("建议使用学号、工号或易记账号").fill(journeyTeacherAccount);
  await page.getByPlaceholder("请输入密码").fill(journeyTeacherPassword);
  await page.getByPlaceholder("请再次输入密码").fill(journeyTeacherPassword);
  await page.getByPlaceholder("请输入真实姓名").fill(journeyTeacherDisplayName);
  await page.getByLabel("工号").fill(`TJ${runId}`);
  await page.getByLabel("学院").fill("计算机学院");
  await page.getByLabel("专业方向").fill("智能网络");
  await page.getByLabel("所属教研室").fill("网络教研室");
  await page.getByLabel("教学组").fill("复杂旅程组");
  await page.getByLabel("岗位称谓").fill("讲师");
  await page.getByLabel("关联班级").fill(journeyClassName);
  await page.getByRole("button", { name: "完成注册" }).click();
  await page.waitForURL(/\/teacher$/);
}

async function registerStudent(page: Page) {
  await openAuth(page, "注册", "学生");
  await page.getByPlaceholder("建议使用学号、工号或易记账号").fill(journeyStudentAccount);
  await page.getByPlaceholder("请输入密码").fill(journeyStudentPassword);
  await page.getByPlaceholder("请再次输入密码").fill(journeyStudentPassword);
  await page.getByPlaceholder("请输入真实姓名").fill(journeyStudentDisplayName);
  await page.getByLabel("学号").fill(`SJ${runId}`);
  await page.getByLabel("学院").fill("计算机学院");
  await page.getByLabel("专业").fill("计算机科学与技术");
  await page.getByLabel("年级").fill("2026级");
  await page.getByLabel("班级").fill(journeyClassName);
  await page.getByRole("button", { name: "完成注册" }).click();
  await page.waitForURL(/\/student$/);
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

async function requestApi<T>(
  page: Page,
  path: string,
  options?: {
    method?: "GET" | "POST";
    body?: unknown;
  },
): Promise<T> {
  return page.evaluate(
    async ({ apiPath, tokenKey, apiPort, method, body }) => {
      const token = window.localStorage.getItem(tokenKey) || "";
      const headers = new Headers();
      if (body !== undefined) {
        headers.set("Content-Type", "application/json");
      }
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:${apiPort}${apiPath}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    },
    {
      apiPath: path,
      tokenKey: TOKEN_KEY,
      apiPort: API_PORT,
      method: options?.method || "GET",
      body: options?.body,
    },
  );
}

function buildSurveyAnswers(survey: PendingSurvey) {
  const answers: Record<string, unknown> = {};
  survey.questions.forEach((question) => {
    if (question.type === "rating") {
      answers[question.id] = 5;
      return;
    }
    if (question.type === "choice") {
      answers[question.id] = question.options?.[0] || "满意";
      return;
    }
    answers[question.id] = journeyFeedbackText;
  });
  return answers;
}

test.describe.serial("user journey verification", () => {
  test.describe.configure({ timeout: 300_000 });

  test("registered teacher and student complete a full teaching journey", async ({ page }) => {
    await registerTeacher(page);
    await logout(page);

    await registerStudent(page);
    await logout(page);

    await login(page, "教师", journeyTeacherAccount, journeyTeacherPassword);

    await page.goto("/teacher/course");
    await page.getByLabel("课程名称").fill(journeyCourseName);
    await page.getByLabel("授课对象").fill("本科生");
    await page.getByLabel("授课班级").fill(journeyClassName);
    await page.getByLabel("学生水平").fill("中等");
    await page.getByLabel("当前章节").fill("传输层");
    await page.getByLabel("课程目标").fill("理解窗口控制与网络拥塞之间的关系");
    await page.getByLabel("拟融入的前沿方向").fill("智能拥塞控制");
    await page.getByRole("button", { name: "创建并生成课程包" }).click();
    await expect(page.getByText("已完成生成")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /发布给学生|已发布给学生/ }).click();
    await expect(page.getByRole("button", { name: "已发布给学生" })).toBeVisible();

    await page.goto("/teacher/ai-config");
    await page.getByRole("combobox").nth(0).selectOption({ label: journeyCourseName });
    await page.getByRole("combobox").nth(1).selectOption("启发型");
    await page.getByRole("button", { name: /保存配置|保存 AI 助教配置|Save Setup/ }).click();
    await page.waitForTimeout(1500);

    await page.goto("/teacher/materials");
    await expect(page.getByText(/教学资料库|Teaching Materials/).first()).toBeVisible({ timeout: 30_000 });
    await page.getByLabel(/所属课程|Course/).selectOption({ label: journeyCourseName });
    await page.locator("label:has-text('选择文件') input[type='file']").setInputFiles({
      name: journeyMaterialName,
      mimeType: "text/plain",
      buffer: Buffer.from(`journey material ${runId}`),
    });
    await expect(page.getByText("资料上传成功。")).toBeVisible({ timeout: 30_000 });
    const materialCard = page.locator("div.rounded-2xl").filter({ hasText: journeyMaterialName }).first();
    await expect(materialCard).toBeVisible();
    await materialCard.locator("input[type='checkbox']").check();
    await page.getByRole("button", { name: "共享到学生端" }).click();
    await expect(page.getByText("资料已共享到学生端。")).toBeVisible();

    await page.goto("/teacher/assignments");
    await page.getByLabel("所属课程").selectOption({ label: journeyCourseName });
    await page.getByLabel("面向班级").selectOption({ label: journeyClassName });
    await page.getByLabel("作业标题").fill(journeyAssignmentTitle);
    await page.getByLabel("作业说明").fill("比较滑动窗口、拥塞窗口与接收窗口的职责。");
    await page.getByLabel("截止日期").fill("2026-05-01T23:59");
    await page.getByLabel("附件要求").fill("txt 或 pdf");
    await page.getByLabel("提交格式要求").fill("单文件");
    await page.getByLabel("评分说明").fill("重点考察术语准确性和因果关系。");
    await page.getByRole("button", { name: "发布作业" }).click();
    await expect(page.getByText("作业已发布。")).toBeVisible({ timeout: 30_000 });

    await page.goto("/teacher/feedback");
    await page.getByLabel("所属课程").selectOption({ label: journeyCourseName });
    await page.getByLabel("对应课次 / 课程包").selectOption({ index: 1 });
    const createSurveyResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/feedback/instances"),
    );
    await page.getByRole("button", { name: "手动触发反馈问卷" }).click();
    await expect(page.getByText("问卷实例已创建。")).toBeVisible({ timeout: 30_000 });
    const surveyId = ((await (await createSurveyResponse).json()) as { id: string }).id;
    expect(surveyId).toBeTruthy();

    await logout(page);

    await login(page, "学生", journeyStudentAccount, journeyStudentPassword);

    await page.goto("/student/materials");
    await page.getByLabel("当前课程").selectOption({ label: journeyCourseName });
    await expect(page.getByText(journeyMaterialName)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("textbox").fill(journeyMaterialRequestText);
    await page.getByRole("button", { name: "发送资料请求" }).click();
    await expect(page.getByText("资料请求已发送给教师")).toBeVisible();

    await page.goto("/student/qa");
    await page.getByLabel("所属课程").selectOption({ label: journeyCourseName });
    await page.getByRole("button", { name: "由教师回答" }).click();
    await page.getByRole("textbox").nth(0).fill(journeyQuestionText);
    await page.getByRole("button", { name: "提交问题" }).click();
    await expect(page.getByText(/问题已发送给教师|问题已提交/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(journeyQuestionText)).toBeVisible();

    await page.goto("/student/questions");
    await page.getByLabel("选择课程").selectOption({ label: journeyCourseName });
    await page.getByPlaceholder(/新建文件夹名称/).fill(journeyFolderName);
    await page.getByRole("button", { name: "创建文件夹" }).click();
    await expect(page.getByRole("button", { name: new RegExp(journeyFolderName) }).first()).toBeVisible();
    await page.getByRole("button", { name: "全部问答" }).click();
    const questionCard = page.locator("article").filter({ hasText: journeyQuestionText }).first();
    await expect(questionCard).toBeVisible({ timeout: 30_000 });
    await questionCard.getByRole("button", { name: "加入收藏" }).click();
    await expect(questionCard.getByText("已收藏")).toBeVisible();
    await questionCard.getByRole("combobox").selectOption({ label: journeyFolderName });
    await expect(questionCard.locator("span").filter({ hasText: journeyFolderName }).first()).toBeVisible();

    await page.goto("/student/assignments");
    const assignmentCard = page.locator("div.section-card").filter({
      has: page.getByRole("heading", { name: journeyAssignmentTitle, exact: true }),
    }).first();
    await expect(assignmentCard).toBeVisible({ timeout: 30_000 });
    const confirmButton = assignmentCard.getByRole("button", { name: "确认收到" });
    if (await confirmButton.count()) {
      await confirmButton.click();
    }
    await assignmentCard.locator("label:has-text('选择提交文件') input[type='file']").setInputFiles({
      name: `journey-homework-${runId}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(`journey homework ${runId}`),
    });
    await assignmentCard.getByRole("button", { name: /提交作业|重新提交/ }).click();
    await expect(page.getByText("作业已提交")).toBeVisible({ timeout: 30_000 });
    await expect(assignmentCard.getByText("AI 辅助批改参考")).toBeVisible();

    await page.goto("/student/feedback");
    await expect(page.getByRole("heading", { name: "课后自愿填写，不向教师暴露个人身份" })).toBeVisible();
    const pendingSurveys = await requestApi<PendingSurvey[]>(page, "/api/feedback/pending");
    const targetSurvey = pendingSurveys.find((survey) => survey.id === surveyId);
    expect(targetSurvey).toBeTruthy();
    await requestApi(page, `/api/feedback/instances/${surveyId}/submit`, {
      method: "POST",
      body: { answers: buildSurveyAnswers(targetSurvey as PendingSurvey) },
    });
    const pendingAfterSubmit = await requestApi<PendingSurvey[]>(page, "/api/feedback/pending");
    expect(pendingAfterSubmit.some((survey) => survey.id === surveyId)).toBe(false);

    await page.goto("/student/discussions");
    await page.getByPlaceholder(/输入消息/).fill(journeyDiscussionMessage);
    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.getByText("消息已发送。").first()).toBeVisible();
    await expect(page.getByText(journeyDiscussionMessage)).toBeVisible();

    await page.goto("/student/weakness");
    await page.getByRole("button", { name: /重新分析|Refresh Analysis/ }).click();
    await expect(page.getByText(/按课程查看薄弱点分析|View Weakness Analysis by Course/)).toBeVisible();

    await logout(page);

    await login(page, "教师", journeyTeacherAccount, journeyTeacherPassword);

    await page.goto("/teacher/materials");
    await expect(page.getByText(/教学资料库|Teaching Materials/).first()).toBeVisible({ timeout: 30_000 });
    await page.getByLabel(/所属课程|Course/).selectOption({ label: journeyCourseName });
    await expect(page.getByText(journeyMaterialRequestText)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "同意" }).click();

    await page.goto("/teacher/questions");
    await expect(page.getByText(journeyQuestionText).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: journeyQuestionText }).click();
    await page.getByRole("textbox").fill(journeyTeacherReplyText);
    await page.getByRole("button", { name: "提交回复" }).click();
    await expect(page.getByText("教师回复已更新。")).toBeVisible({ timeout: 30_000 });

    const teacherQuestions = await requestApi<TeacherQuestion[]>(page, "/api/qa/teacher/questions");
    const handledQuestion = teacherQuestions.find((item) => item.question_text === journeyQuestionText);
    expect(handledQuestion?.teacher_reply_status).toBe("replied");
    expect(handledQuestion?.teacher_answer_content).toContain(journeyTeacherReplyText);

    const analytics = await requestApi<SurveyAnalytics>(page, `/api/feedback/analytics/${surveyId}`);
    expect(analytics.participation_count).toBeGreaterThan(0);
    expect(analytics.text_feedback).toContain(journeyFeedbackText);
  });

  test("student question archive lifecycle works end to end", async ({ page }) => {
    await login(page, "学生", "student_demo", "Student123!");

    const courses = await requestApi<CourseSummary[]>(page, "/api/courses");
    const targetCourse = courses.find((course) => course.name === "计算机网络") || courses[courses.length - 1] || courses[0];
    expect(targetCourse).toBeTruthy();

    await page.goto("/student/qa");
    await page.getByLabel("所属课程").selectOption(targetCourse.id);
    await page.getByRole("button", { name: "由教师回答" }).click();
    await page.getByRole("textbox").nth(0).fill(archiveQuestionText);
    await page.getByRole("button", { name: "提交问题" }).click();
    await expect(page.getByText(/问题已发送给教师|问题已提交/)).toBeVisible({ timeout: 30_000 });

    await page.goto("/student/questions");
    await page.getByLabel("选择课程").selectOption(targetCourse.id);
    await page.getByPlaceholder(/新建文件夹名称/).fill(archiveFolderName);
    await page.getByRole("button", { name: "创建文件夹" }).click();
    await expect(page.getByRole("button", { name: new RegExp(archiveFolderName) }).first()).toBeVisible();
    await page.getByRole("button", { name: "全部问答" }).click();

    const archiveCard = page.locator("article").filter({ hasText: archiveQuestionText }).first();
    await expect(archiveCard).toBeVisible({ timeout: 30_000 });
    await archiveCard.getByRole("button", { name: "加入收藏" }).click();
    await expect(archiveCard.getByText("已收藏")).toBeVisible();
    await archiveCard.getByRole("combobox").selectOption({ label: archiveFolderName });
    await expect(archiveCard.locator("span").filter({ hasText: archiveFolderName }).first()).toBeVisible();

    await page.getByRole("button", { name: new RegExp(archiveFolderName) }).first().click();
    await page.getByPlaceholder(/搜索问题、AI 回答、教师回复或文件夹名称/).fill(archiveQuestionText);
    await expect(page.locator("article").filter({ hasText: archiveQuestionText })).toHaveCount(1);

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await archiveCard.getByRole("button", { name: "删除记录" }).click();
    await expect(page.getByText("问答记录已删除。")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("article").filter({ hasText: archiveQuestionText })).toHaveCount(0);

    const folderButton = page.getByRole("button", { name: new RegExp(archiveFolderName) }).first();
    await folderButton.locator("xpath=following-sibling::button[1]").click();
    await expect(page.getByRole("button", { name: new RegExp(archiveFolderName) })).toHaveCount(0);

    await logout(page);
  });
});
