from __future__ import annotations

from datetime import datetime
from typing import Dict, List
from uuid import uuid4

from ..models.schemas import AnalyticsReport, Course, LessonPack, QAResponse

DEMO_COURSE_ID = "demo-course-001"
DEMO_LESSON_PACK_ID = "demo-lp-001"
DEMO_CREATED_AT = "2026-04-02T10:00:00"

DEMO_COURSE = Course(
    id=DEMO_COURSE_ID,
    name="计算机网络",
    audience="大三本科生",
    student_level="中等偏上",
    chapter="第五章 传输层协议",
    objectives="理解 TCP/UDP 区别，掌握拥塞控制，并引出 QUIC 与 HTTP/3 的前沿演进。",
    duration_minutes=90,
    frontier_direction="QUIC 协议与 HTTP/3",
    owner_user_id="",
    created_at=DEMO_CREATED_AT,
)

DEMO_LESSON_PACK = LessonPack(
    id=DEMO_LESSON_PACK_ID,
    course_id=DEMO_COURSE_ID,
    version=1,
    status="published",
    payload={
        "teaching_objectives": [
            "理解 TCP 拥塞控制的核心阶段与问题背景",
            "掌握 QUIC 相比传统 TCP 的关键改进",
            "能够对比 HTTP/2 与 HTTP/3 的性能差异与适用场景",
        ],
        "prerequisites": [
            "已掌握 TCP 与 UDP 的基本概念",
            "了解应用层 HTTP 协议的基本工作方式",
        ],
        "main_thread": "从 TCP 传输控制问题出发，引入 QUIC 的设计动机，再对比 HTTP/2 与 HTTP/3。",
        "frontier_topic": {
            "name": "QUIC 协议与 HTTP/3",
            "insert_position": "在 TCP 拥塞控制讲解结束后引入，作为前沿拓展内容。",
            "time_suggestion": "20 分钟",
        },
        "time_allocation": [
            {"segment": "TCP 拥塞控制回顾", "minutes": 25},
            {"segment": "TCP 在现代网络中的局限", "minutes": 10},
            {"segment": "QUIC 协议原理与改进", "minutes": 20},
            {"segment": "HTTP/3 性能对比", "minutes": 15},
            {"segment": "课堂讨论与提问", "minutes": 10},
            {"segment": "总结与课后任务", "minutes": 10},
        ],
        "ppt_outline": [
            "传输层演进：从 TCP 到 QUIC",
            "TCP 拥塞控制四阶段回顾",
            "TCP 在现代应用中的瓶颈",
            "QUIC 的设计目标与核心机制",
            "QUIC 与 TCP 的差异对比",
            "HTTP/3 架构与性能提升",
            "案例：浏览器与 CDN 的 QUIC 实践",
            "课堂讨论题",
        ],
        "teacher_tips": [
            "可结合抓包截图展示 QUIC 握手过程。",
            "讨论时引导学生思考 TCP 为什么难以平滑演进。",
        ],
        "discussion_questions": [
            "QUIC 能否完全替代 TCP？为什么？",
            "在移动网络场景下，QUIC 的优势是否更明显？",
        ],
        "after_class_tasks": [
            "阅读 RFC 9000 的导言部分，总结 QUIC 的设计目标。",
            "对比一个 HTTP/2 与 HTTP/3 站点的网络性能表现。",
        ],
    },
    created_at=DEMO_CREATED_AT,
)

_DEMO_QA_LOG: List[Dict[str, object]] = [
    {
        "question": "QUIC 为什么选择基于 UDP，而不是直接修改 TCP？",
        "answer": "因为 TCP 在内核中实现且受中间设备兼容性限制，直接演进成本高。QUIC 基于 UDP 可以在用户态快速迭代，同时保留可靠传输和拥塞控制能力。",
        "in_scope": True,
    },
    {
        "question": "HTTP/3 一定比 HTTP/2 更快吗？",
        "answer": "不一定。在低延迟、稳定网络中差异可能不大，但在高丢包或移动网络场景下，HTTP/3 通常更有优势。",
        "in_scope": True,
    },
    {
        "question": "量子计算是什么？",
        "answer": "这个问题超出了当前课程包范围。当前课程主要围绕传输层协议、QUIC 与 HTTP/3 展开。",
        "in_scope": False,
    },
]


def get_demo_course() -> Course:
    return DEMO_COURSE



def get_demo_lesson_pack() -> LessonPack:
    return DEMO_LESSON_PACK



def get_demo_qa_log() -> List[Dict[str, object]]:
    return _DEMO_QA_LOG



def mock_generate_lesson_pack(course: Course) -> LessonPack:
    created_at = datetime.now().isoformat()
    return LessonPack(
        id=f"lp-{uuid4().hex[:8]}",
        course_id=course.id,
        version=1,
        status="draft",
        payload={
            "teaching_objectives": [
                f"掌握 {course.chapter} 的核心概念",
                f"理解 {course.frontier_direction} 与课程内容的关联",
                "能够结合案例分析新技术对传统方案的改进",
            ],
            "prerequisites": [f"已完成 {course.chapter} 前置知识学习"],
            "main_thread": f"从 {course.chapter} 基础知识出发，引入 {course.frontier_direction}。",
            "frontier_topic": {
                "name": course.frontier_direction,
                "insert_position": "章节核心内容之后",
                "time_suggestion": "20 分钟",
            },
            "ppt_outline": [
                f"{course.chapter} 与 {course.frontier_direction}",
                "基础知识回顾",
                "核心概念讲解",
                "前沿拓展与案例分析",
                "讨论与课后任务",
            ],
        },
        created_at=created_at,
    )



def mock_student_qa(question: str, lesson_pack: LessonPack) -> QAResponse:
    topic = lesson_pack.payload.get("frontier_topic", {}).get("name", "当前课程主题")
    return QAResponse(
        answer=f"关于“{question}”，建议结合当前课时重点“{topic}”理解。系统给出的这条回答仅为演示环境下的保底返回。",
        evidence=["基于演示课程包内容生成"],
        in_scope=True,
    )



def mock_analytics(lesson_pack_id: str) -> AnalyticsReport:
    return AnalyticsReport(
        lesson_pack_id=lesson_pack_id,
        total_questions=len(_DEMO_QA_LOG),
        anonymous_questions=1,
        identified_questions=2,
        high_freq_topics=["QUIC 与 TCP 对比", "HTTP/3 性能表现"],
        confused_concepts=["0-RTT 与重放风险", "HTTP/3 并非所有场景都更快"],
        knowledge_gaps=["TLS 1.3 基础", "移动网络中的协议选择"],
        teaching_suggestions=[
            "下一次授课可补充 TLS 1.3 的前置知识。",
            "增加抓包演示，帮助学生理解 QUIC 握手与多路复用。",
        ],
        recent_questions=[
            {
                "created_at": "2026-04-02T10:20:00",
                "question": "QUIC 为什么基于 UDP？",
                "in_scope": True,
                "anonymous": False,
                "student_display_name": "演示学生",
                "student_grade": "2023级",
                "student_major": "计算机科学与技术",
            },
            {
                "created_at": "2026-04-02T10:28:00",
                "question": "HTTP/3 一定比 HTTP/2 快吗？",
                "in_scope": True,
                "anonymous": True,
                "student_display_name": "匿名学生",
                "student_grade": "",
                "student_major": "",
            },
        ],
    )
