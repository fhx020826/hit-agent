"""Mock 数据服务：为 MVP 提供固定的演示数据与 mock AI 返回值。"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Dict, List

from ..models.schemas import (
    Course, LessonPack, QAResponse, AnalyticsReport,
)

# ── 固定演示课程 ──────────────────────────────────────────

DEMO_COURSE_ID = "demo-course-001"

DEMO_COURSE = Course(
    id=DEMO_COURSE_ID,
    name="计算机网络",
    audience="大三本科生",
    student_level="中等偏上",
    chapter="第五章 传输层协议",
    objectives="理解 TCP/UDP 区别，掌握 TCP 拥塞控制机制",
    duration_minutes=90,
    frontier_direction="QUIC 协议与 HTTP/3",
)

DEMO_LESSON_PACK_ID = "demo-lp-001"

DEMO_LESSON_PACK = LessonPack(
    id=DEMO_LESSON_PACK_ID,
    course_id=DEMO_COURSE_ID,
    version=1,
    status="published",
    payload={
        "teaching_objectives": [
            "理解 TCP 拥塞控制的四阶段：慢启动、拥塞避免、快重传、快恢复",
            "掌握 QUIC 协议相比 TCP 的核心改进",
            "能对比分析 HTTP/2 与 HTTP/3 的性能差异",
        ],
        "prerequisites": [
            "已掌握 TCP 可靠传输的基本机制",
            "了解 UDP 的特点与应用场景",
            "熟悉应用层 HTTP 协议的基本工作方式",
        ],
        "main_thread": "从 TCP 拥塞控制的问题出发 → 引入 QUIC 的设计动机 → 对比分析 HTTP/2 与 HTTP/3",
        "frontier_topic": {
            "name": "QUIC 协议与 HTTP/3",
            "insert_position": "在 TCP 拥塞控制讲完后引入，作为 '下一代传输协议' 拓展",
            "time_suggestion": "20 分钟",
        },
        "time_allocation": [
            {"segment": "TCP 拥塞控制回顾", "minutes": 25},
            {"segment": "TCP 的局限性讨论", "minutes": 10},
            {"segment": "QUIC 协议原理与改进", "minutes": 20},
            {"segment": "HTTP/3 性能对比分析", "minutes": 15},
            {"segment": "课堂讨论与提问", "minutes": 10},
            {"segment": "总结与课后任务布置", "minutes": 10},
        ],
        "ppt_outline": [
            "封面：传输层演进 — 从 TCP 到 QUIC",
            "TCP 拥塞控制四阶段回顾",
            "TCP 在现代网络中的瓶颈",
            "QUIC：设计目标与核心特性",
            "QUIC vs TCP：多路复用与队头阻塞",
            "HTTP/3 架构与性能提升",
            "案例：Google 与 Cloudflare 的 QUIC 实践",
            "课堂讨论题",
            "课后任务与延伸阅读",
        ],
        "teacher_tips": [
            "QUIC 的 0-RTT 建连是亮点，可结合实际抓包截图演示",
            "讨论时可引导学生思考 '为什么 TCP 难以演进'",
            "如有时间可简单展示 Wireshark 中 QUIC 报文",
        ],
        "case_materials": [
            "Google Chrome QUIC 部署数据：50% 连接延迟降低",
            "Cloudflare HTTP/3 全面上线案例",
            "IETF RFC 9000 QUIC 协议规范概述",
        ],
        "discussion_questions": [
            "QUIC 能否完全取代 TCP？为什么？",
            "在移动网络环境下，QUIC 的优势是否更明显？",
            "如果你来设计下一代传输协议，还会做什么改进？",
        ],
        "after_class_tasks": [
            "阅读 RFC 9000 的第 1-3 节，总结 QUIC 的三大设计目标",
            "使用浏览器开发者工具对比访问 HTTP/2 和 HTTP/3 网站的性能差异",
        ],
        "extended_reading": [
            "RFC 9000: QUIC: A UDP-Based Multiplexed and Secure Transport",
            "HTTP/3 RFC 9114",
            "Cloudflare 博客: The road to QUIC",
        ],
        "risk_warning": "QUIC 涉及较多加密知识，如学生未学过 TLS 基础，建议简化加密相关内容，聚焦传输层改进",
        "references": [
            "《计算机网络：自顶向下方法》第3章",
            "RFC 9000, RFC 9114",
            "James Mishra et al., 'QUIC: A New Transport Protocol for the Internet'",
        ],
    },
    created_at=datetime(2026, 4, 2, 10, 0),
)

# ── Mock 问答 ─────────────────────────────────────────────

_DEMO_QA_LOG: List[Dict] = [
    {"question": "QUIC 为什么选择基于 UDP 而不是直接改进 TCP？", "answer": "TCP 存在中间设备僵化问题，NAT 和防火墙会丢弃未知 TCP 选项，而 UDP 穿透性更好。此外，TCP 的拥塞控制在内核中实现，升级困难，QUIC 在用户态实现可以快速迭代。", "in_scope": True},
    {"question": "QUIC 的 0-RTT 是怎么实现的？", "answer": "0-RTT 依赖之前连接中缓存的服务器配置信息和预共享密钥。客户端在首次连接后会缓存服务器的传输参数，后续连接时直接使用缓存信息发送加密数据，无需等待握手完成。但 0-RTT 存在重放攻击风险，仅适用于幂等请求。", "in_scope": True},
    {"question": "HTTP/3 一定比 HTTP/2 快吗？", "answer": "不一定。在低延迟、稳定的网络环境下，HTTP/2 和 HTTP/3 性能差异不大。HTTP/3 的优势主要体现在高延迟、丢包率较高的网络环境中，尤其是移动网络场景。此外，HTTP/3 的 UDP 流量在某些网络中可能被限速或阻止。", "in_scope": True},
    {"question": "队头阻塞具体是什么意思？", "answer": "队头阻塞（Head-of-Line Blocking）指在多路复用中，一个流的丢包会阻塞其他所有流的处理。HTTP/2 基于 TCP，一个 TCP 包丢失会阻塞所有流；而 HTTP/3 基于 QUIC，每个流独立，一个流的丢包不影响其他流。", "in_scope": True},
    {"question": "量子计算是什么？", "answer": "这个问题超出了当前课时包的范围（传输层协议与 QUIC）。建议你在相关课程中查找量子计算相关内容。", "in_scope": False},
    {"question": "QUIC 的拥塞控制和 TCP 有区别吗？", "answer": "QUIC 的拥塞控制算法在原理上与 TCP 类似（如使用 Cubic 或 BBR），但由于 QUIC 在用户态实现，可以更灵活地切换算法、实验新机制。此外，QUIC 的连接迁移功能使得网络切换时不必重置拥塞窗口。", "in_scope": True},
]


def get_demo_course() -> Course:
    return DEMO_COURSE


def get_demo_lesson_pack() -> LessonPack:
    return DEMO_LESSON_PACK


def get_demo_qa_log() -> List[Dict]:
    return _DEMO_QA_LOG


# ── Mock AI 生成 ──────────────────────────────────────────

def mock_generate_lesson_pack(course: Course) -> LessonPack:
    """模拟课时包生成：课程名+前沿方向组合生成固定结构。"""
    lp_id = f"lp-{uuid.uuid4().hex[:8]}"
    return LessonPack(
        id=lp_id,
        course_id=course.id,
        version=1,
        status="draft",
        payload={
            "teaching_objectives": [
                f"掌握 {course.chapter} 的核心概念",
                f"理解 {course.frontier_direction} 与课程内容的关联",
                "能够运用所学知识分析实际案例",
            ],
            "prerequisites": [f"已完成 {course.chapter} 之前章节的学习"],
            "main_thread": f"从{course.chapter}基础知识出发 → 引入{course.frontier_direction}",
            "frontier_topic": {
                "name": course.frontier_direction,
                "insert_position": "章节核心内容讲完后引入",
                "time_suggestion": "20 分钟",
            },
            "time_allocation": [
                {"segment": "基础知识回顾", "minutes": 20},
                {"segment": "核心内容讲解", "minutes": 25},
                {"segment": f"前沿拓展：{course.frontier_direction}", "minutes": 20},
                {"segment": "课堂讨论", "minutes": 15},
                {"segment": "总结与任务布置", "minutes": 10},
            ],
            "ppt_outline": [
                f"封面：{course.chapter} — {course.frontier_direction}",
                "基础知识回顾",
                "核心概念讲解",
                f"前沿拓展：{course.frontier_direction}",
                "案例分析与讨论",
                "总结与课后任务",
            ],
            "teacher_tips": ["结合实际案例讲解", "鼓励学生参与讨论"],
            "case_materials": ["待根据前沿资料补充"],
            "discussion_questions": [
                f"{course.frontier_direction}对传统方法的主要改进是什么？",
            ],
            "after_class_tasks": ["阅读相关前沿文献并撰写摘要"],
            "extended_reading": [],
            "risk_warning": "",
            "references": [],
        },
    )


def mock_student_qa(question: str, lesson_pack: LessonPack) -> QAResponse:
    """模拟学生问答：基于课时包内容生成回答。"""
    return QAResponse(
        answer=f"关于「{question}」，这是一个很好的问题。基于当前课时内容，建议从以下角度理解：结合课时中关于{lesson_pack.payload.get('frontier_topic', {}).get('name', '前沿主题')}的讨论进行思考。具体内容请参考教师发布的课时资料。",
        evidence=["基于当前课时包内容生成"],
        in_scope=True,
    )


def mock_analytics(lesson_pack_id: str) -> AnalyticsReport:
    """模拟教师复盘报告。"""
    return AnalyticsReport(
        lesson_pack_id=lesson_pack_id,
        total_questions=len(_DEMO_QA_LOG),
        high_freq_topics=[
            "QUIC vs TCP 的核心区别",
            "0-RTT 连接建立机制",
            "队头阻塞问题",
        ],
        confused_concepts=[
            "0-RTT 与重放攻击风险的关系",
            "HTTP/3 并非在所有场景都快于 HTTP/2",
        ],
        knowledge_gaps=[
            "QUIC 加密机制（学生缺乏 TLS 基础）",
            "UDP 在企业网络中的部署限制",
        ],
        teaching_suggestions=[
            "下次课补充 TLS 1.3 基础知识，帮助学生理解 QUIC 加密",
            "增加一次抓包实验，让学生直观感受 QUIC 与 TCP 的差异",
            "对'HTTP/3 一定更快'的误解做专门澄清",
        ],
    )
