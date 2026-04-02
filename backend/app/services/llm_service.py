"""LLM 服务：通过智谱 AI (GLM-5) 提供真实的 AI 能力。"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional

import httpx

from ..models.schemas import Course, LessonPack, QAResponse, AnalyticsReport

# ── 配置 ──────────────────────────────────────────────────

ZHIPU_API_KEY = os.getenv(
    "ZHIPU_API_KEY",
    "31624c7b2c5a4ca3b05594dbec2e510b.h9BwHeGu5J6I1fwH",
)
ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
# GLM-5 有思维链，消耗大；glm-4-flash 快速廉价
MODEL_FAST = "glm-5"
MODEL_SMART = "glm-5"

# 代理配置：延迟读取（main.py 启动时会设置 env）
def _get_proxy():
    return os.getenv("https_proxy") or os.getenv("HTTPS_PROXY") or os.getenv("http_proxy") or os.getenv("HTTP_PROXY")


def _get_http_client():
    """创建带代理的 httpx 客户端。"""
    proxy = _get_proxy()
    if proxy:
        return httpx.Client(proxies=proxy, timeout=120)
    return httpx.Client(timeout=120)


def _call_llm(system_prompt: str, user_prompt: str, max_tokens: int = 4096, use_smart: bool = False) -> Optional[str]:
    """调用智谱 API，返回文本内容。失败返回 None。"""
    model = MODEL_SMART if use_smart else MODEL_FAST
    try:
        client = _get_http_client()
        resp = client.post(
            ZHIPU_BASE_URL,
            headers={
                "Authorization": f"Bearer {ZHIPU_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.7,
                "max_tokens": max_tokens,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"].get("content", "")
        return content if content else None
    except Exception as e:
        print(f"[LLM 调用失败] {e}")
        return None


def _extract_json(text: str) -> Optional[Dict]:
    """从 LLM 返回文本中提取 JSON。"""
    # 尝试直接解析
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass
    # 尝试提取 ```json ... ``` 块
    import re
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except (json.JSONDecodeError, TypeError):
            pass
    # 尝试找 { ... }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except (json.JSONDecodeError, TypeError):
            pass
    return None


# ── 课时包生成 ────────────────────────────────────────────

LP_SYSTEM_PROMPT = """你是一位资深高校教学设计顾问。你的任务是根据教师提供的课程信息，生成一个结构化的"课时包"方案，将前沿知识融入课程教学。

你必须返回一个 JSON 对象，严格包含以下字段：
{
  "teaching_objectives": ["教学目标1", "教学目标2", ...],
  "prerequisites": ["先修要求1", ...],
  "main_thread": "课程主线描述（一段话）",
  "frontier_topic": {
    "name": "前沿主题名称",
    "insert_position": "建议插入位置",
    "time_suggestion": "建议用时（如：20分钟）"
  },
  "time_allocation": [
    {"segment": "教学环节名称", "minutes": 数字},
    ...
  ],
  "ppt_outline": ["PPT第1页标题", "PPT第2页标题", ...],
  "teacher_tips": ["教学建议1", ...],
  "case_materials": ["案例素材1", ...],
  "discussion_questions": ["讨论题1", ...],
  "after_class_tasks": ["课后任务1", ...],
  "extended_reading": ["延伸阅读1", ...],
  "risk_warning": "风险提示",
  "references": ["参考文献1", ...]
}

要求：
1. 所有内容必须紧扣课程章节和前沿方向
2. 时间分配总和应接近课时总时长
3. 讨论题要能激发学生批判性思考
4. 案例素材要真实、可查
5. 只返回 JSON，不要其他文字"""


def generate_lesson_pack(course: Course) -> LessonPack:
    """基于课程画像调用 LLM 生成课时包。失败时回退到 mock。"""
    user_prompt = (
        f"请为以下课程生成一个课时包方案：\n\n"
        f"课程名称：{course.name}\n"
        f"授课对象：{course.audience}\n"
        f"学生水平：{course.student_level}\n"
        f"当前章节：{course.chapter}\n"
        f"课程目标：{course.objectives}\n"
        f"课时时长：{course.duration_minutes} 分钟\n"
        f"拟引入的前沿方向：{course.frontier_direction}\n\n"
        f"请生成完整的结构化课时包。"
    )

    lp_id = f"lp-{uuid.uuid4().hex[:8]}"
    result_text = _call_llm(LP_SYSTEM_PROMPT, user_prompt, max_tokens=4096, use_smart=False)
    payload = _extract_json(result_text) if result_text else None

    if payload is None:
        # 回退到 mock
        from .mock_data import mock_generate_lesson_pack
        print("[LLM 生成失败，使用 mock 回退]")
        return mock_generate_lesson_pack(course)

    return LessonPack(
        id=lp_id,
        course_id=course.id,
        version=1,
        status="draft",
        payload=payload,
    )


# ── 学生问答 ──────────────────────────────────────────────

QA_SYSTEM_TEMPLATE = """你是一位耐心的课程助教，专门帮助学生理解课程内容。

当前课时包信息：
- 课程主线：{main_thread}
- 前沿主题：{frontier_name}
- 教学目标：{objectives}

你的职责：
1. 回答学生关于课时内容的问题
2. 回答必须紧扣课时包范围，不要过度扩展
3. 如果学生的问题与课时无关，请礼貌告知超出范围
4. 尽量结合前沿主题进行解释
5. 用通俗易懂的语言回答

你必须返回一个 JSON 对象：
{{
  "answer": "你的回答",
  "evidence": ["回答依据1", "回答依据2"],
  "in_scope": true或false
}}"""


def student_qa(question: str, lesson_pack: LessonPack) -> QAResponse:
    """学生问答：基于课时包上下文回答问题。"""
    ft = lesson_pack.payload.get("frontier_topic", {})
    objectives = lesson_pack.payload.get("teaching_objectives", [])
    main_thread = lesson_pack.payload.get("main_thread", "")

    system_prompt = QA_SYSTEM_TEMPLATE.format(
        main_thread=main_thread,
        frontier_name=ft.get("name", "未知"),
        objectives="；".join(objectives) if objectives else "暂无",
    )

    result_text = _call_llm(system_prompt, question, max_tokens=1024)
    data = _extract_json(result_text) if result_text else None

    if data and "answer" in data:
        return QAResponse(
            answer=data["answer"],
            evidence=data.get("evidence", []),
            in_scope=data.get("in_scope", True),
        )

    # 回退到 mock
    from .mock_data import mock_student_qa
    print("[LLM QA 失败，使用 mock 回退]")
    return mock_student_qa(question, lesson_pack)


# ── 教师复盘分析 ──────────────────────────────────────────

ANALYTICS_SYSTEM_PROMPT = """你是一位教学分析师，帮助教师分析学生提问数据并提供教学改进建议。

你需要分析以下学生问答日志，提取关键洞察。

你必须返回一个 JSON 对象：
{
  "high_freq_topics": ["高频主题1", "高频主题2", ...],
  "confused_concepts": ["易混淆概念1", ...],
  "knowledge_gaps": ["知识盲区1", ...],
  "teaching_suggestions": ["教学建议1", ...]
}

要求：
1. 高频主题：从问答中提取出现频率最高的话题
2. 易混淆概念：找出学生容易混淆或误解的知识点
3. 知识盲区：识别学生普遍缺乏但本应掌握的前置知识
4. 教学建议：针对发现的问题给出具体的、可操作的教学改进建议
5. 只返回 JSON"""


def analytics_from_qa_logs(lesson_pack_id: str, qa_logs: List[Dict]) -> AnalyticsReport:
    """基于真实问答日志调用 LLM 进行分析。"""
    if not qa_logs:
        from .mock_data import mock_analytics
        return mock_analytics(lesson_pack_id)

    # 构造问答摘要（限制长度）
    qa_summary_lines = []
    for i, log in enumerate(qa_logs[:30]):  # 最多取 30 条
        q = log.get("question", "")
        a = log.get("answer", "")
        in_scope = log.get("in_scope", 1)
        qa_summary_lines.append(
            f"{i + 1}. [{'范围内' if in_scope else '超出范围'}] Q: {q[:100]}\n   A: {a[:150]}"
        )

    user_prompt = (
        f"课时包ID: {lesson_pack_id}\n"
        f"学生提问总数: {len(qa_logs)}\n\n"
        f"以下是学生问答日志摘要：\n\n"
        + "\n".join(qa_summary_lines)
        + "\n\n请分析以上数据并返回结构化结果。"
    )

    result_text = _call_llm(ANALYTICS_SYSTEM_PROMPT, user_prompt, max_tokens=2048)
    data = _extract_json(result_text) if result_text else None

    if data:
        return AnalyticsReport(
            lesson_pack_id=lesson_pack_id,
            total_questions=len(qa_logs),
            high_freq_topics=data.get("high_freq_topics", []),
            confused_concepts=data.get("confused_concepts", []),
            knowledge_gaps=data.get("knowledge_gaps", []),
            teaching_suggestions=data.get("teaching_suggestions", []),
        )

    # 回退到 mock
    from .mock_data import mock_analytics
    report = mock_analytics(lesson_pack_id)
    report.total_questions = len(qa_logs)
    print("[LLM 分析失败，使用 mock 回退]")
    return report
