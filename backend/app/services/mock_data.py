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


def _split_minutes(total_minutes: int) -> list[int]:
    safe_total = max(total_minutes or 90, 60)
    ratios = [10, 25, 25, 15, 15, 10]
    raw = [safe_total * ratio // 100 for ratio in ratios]
    raw[-1] += safe_total - sum(raw)
    return raw


def build_mock_lesson_pack_payload(course: Course) -> Dict[str, object]:
    chapter = course.chapter or "本章内容"
    frontier = course.frontier_direction or f"{chapter}相关前沿主题"
    audience = course.audience or course.class_name or "当前授课班级"
    level = course.student_level or "本科阶段"
    objective = course.objectives or f"掌握{chapter}核心知识"
    minutes = _split_minutes(course.duration_minutes or 90)
    time_allocation = [
        {"segment": "导入与学习诊断", "minutes": minutes[0], "objective": f"唤醒与{chapter}相关的前置知识"},
        {"segment": "核心概念建构", "minutes": minutes[1], "objective": f"建立{chapter}的概念框架与术语体系"},
        {"segment": "关键机制深讲", "minutes": minutes[2], "objective": f"突破{chapter}中的重点机制与分析方法"},
        {"segment": "前沿拓展与案例", "minutes": minutes[3], "objective": f"把{frontier}与章节知识连起来"},
        {"segment": "互动讨论与形成性评价", "minutes": minutes[4], "objective": "通过提问、讨论和即时检测确认理解程度"},
        {"segment": "总结与课后任务", "minutes": minutes[5], "objective": "形成课堂闭环并明确课后迁移任务"},
    ]
    return {
        "teaching_objectives": [
            f"掌握 {chapter} 的核心概念、关键机制与典型应用场景",
            f"理解 {frontier} 与当前章节之间的逻辑关联，而不是把前沿内容孤立看待",
            "能够结合课堂案例进行比较、解释和迁移应用",
        ],
        "prerequisites": [
            f"已学习与 {chapter} 相关的基础概念和前置章节知识",
            "具备基本的图示阅读、流程分析或案例讨论能力",
        ],
        "class_profile": {
            "audience": audience,
            "current_level": level,
            "likely_strengths": [
                "对课程主线知识具备一定基础，能够跟随教师完成概念梳理",
                "对贴近真实场景的案例和新技术话题具有较高兴趣",
            ],
            "likely_risks": [
                "容易只记结论，不清楚关键机制之间的因果关系",
                "在传统知识点与前沿主题之间缺少主动建立联系的意识",
            ],
        },
        "learning_diagnostics": [
            f"用 2 至 3 个快速问题诊断学生对 {chapter} 前置知识的掌握程度",
            "让学生先说出一个自己理解最模糊的点，作为课堂关注对象",
            "在正式展开前确认学生是否能描述本章知识与已有课程框架的关系",
        ],
        "key_concepts": [
            f"{chapter}的核心概念与术语边界",
            f"{chapter}中的关键机制、过程或约束条件",
            f"{frontier}与本章基础知识的映射关系",
        ],
        "teaching_difficulties": [
            f"帮助学生从“会背结论”过渡到“能解释{chapter}为什么这样设计”",
            f"避免把 {frontier} 仅仅讲成资讯补充，而是讲清它与章节核心机制的关联",
            "兼顾基础学生的理解节奏与高水平学生的深入追问",
        ],
        "main_thread": f"以“{objective}”为目标，从 {chapter} 的基本概念与关键机制出发，借助案例逐步过渡到 {frontier}，最终形成“基础知识 - 现实问题 - 前沿演进”的完整授课主线。",
        "frontier_topic": {
            "name": frontier,
            "insert_position": "放在章节核心机制讲清之后，引导学生用旧知识理解新问题",
            "time_suggestion": f"{minutes[3]} 分钟",
            "connection_to_core": f"强调 {frontier} 不是额外插入的话题，而是对 {chapter} 现实约束、性能瓶颈或应用演进的回应",
        },
        "time_allocation": time_allocation,
        "segment_plan": [
            "导入阶段：从一个真实现象、错误直觉或简短追问切入，先暴露学生已有理解。",
            f"核心讲解阶段：围绕 {chapter} 的概念、机制和作用边界逐层推进，不只给结论，要给出因果解释。",
            f"案例阶段：选取能够体现 {frontier} 价值的典型案例，让学生比较传统方案与新方案的差异。",
            "讨论与检测阶段：设计一到两个需要解释“为什么”的问题，而不只是选择题式确认。",
            "总结阶段：要求学生说出一个核心收获、一个仍有疑问的点和一个可迁移场景。",
        ],
        "ppt_outline": [
            f"{chapter}在整门课程中的位置与学习目标",
            "前置知识回顾与学习诊断",
            f"{chapter}核心概念与术语边界",
            f"{chapter}关键机制或流程讲解",
            "典型误区与易混点澄清",
            f"{frontier}的提出背景与核心思路",
            "基础知识与前沿主题的映射关系",
            "案例分析、课堂讨论与即时检测",
            "总结回收与课后任务说明",
        ],
        "board_plan": [
            "左侧板书：本节主线、核心概念与关键词。",
            "中部板书：关键机制的流程图、关系图或因果链。",
            f"右侧板书：{frontier} 与基础知识的一一对应、对比结论与学生高频疑问。",
        ],
        "teacher_tips": [
            "每讲完一个机制点后，用一句“为什么要这样设计”帮助学生建立解释框架。",
            "讨论前先给 30 秒独立思考时间，再组织同伴交流，能明显提升参与度。",
            "前沿内容不宜一次铺太多新名词，应始终拉回章节核心问题。",
        ],
        "case_materials": [
            f"选择一个能体现 {frontier} 实际价值的真实案例或工程场景。",
            f"准备一张对比图，展示 {chapter} 的传统处理方式与前沿方案的差异。",
            "如条件允许，可补充日志、抓包、系统截图或实验结果图表。",
        ],
        "interaction_plan": [
            "开场用诊断性提问确认前置知识，而不是直接进入长时间讲授。",
            "在关键机制讲解后安排一次“同桌互讲”，检查学生是否能用自己的话解释。",
            "在前沿拓展部分设置对比讨论，让学生判断新方案解决了什么旧问题、又带来了什么新权衡。",
        ],
        "discussion_questions": [
            f"{chapter} 中最容易被忽视但又决定效果的机制是什么？为什么？",
            f"如果只记住结论而不理解机制，在面对 {frontier} 时会出现哪些误判？",
            f"{frontier} 是否适合所有场景？它解决了什么问题，又引入了什么代价？",
        ],
        "assessment_plan": [
            "形成性评价：通过课堂追问、板演或口头复述检查学生是否真正理解关键机制。",
            "即时检测：设置 1 至 2 个需要解释原因的短题，而不只是判断对错。",
            "课后评价：要求学生完成一个小型对比分析或案例说明，观察其迁移应用能力。",
        ],
        "differentiation_support": {
            "foundation": [
                "给基础薄弱学生提供概念对照表、关键词提示和最小理解路径。",
                "在关键步骤处反复强调“现象 - 原因 - 结果”的基本链路。",
            ],
            "advanced": [
                f"鼓励基础较好的学生进一步分析 {frontier} 的设计权衡与边界条件。",
                "可追加开放式追问，让学生比较不同方案的适用场景。",
            ],
            "support_for_struggling": [
                "对理解吃力的学生优先保住核心概念、主线框架和一个典型案例。",
                "把复杂结论拆成更小的问题链，逐步确认学生在哪一步掉队。",
            ],
        },
        "after_class_tasks": [
            f"整理一页笔记，说明 {chapter} 的核心概念、关键机制和一个最容易混淆的点。",
            f"围绕 {frontier} 查找一个补充案例，写出它与本章知识的对应关系。",
        ],
        "extended_reading": [
            "推荐阅读教材对应章节、课程讲义与一篇入门级综述或技术报告。",
            f"建议补充关注与 {frontier} 相关的标准文档、实验报告或工程实践文章。",
        ],
        "common_misconceptions": [
            "把表面现象当成底层机制本身，导致只能记忆不能迁移。",
            f"把 {frontier} 当成独立热点，而没有回到本章核心问题去理解它。",
            "只会比较结果优劣，却说不清楚差异产生的原因。",
        ],
        "expected_outputs": [
            "学生能够用自己的话概括本节主线并解释关键机制。",
            "学生能够完成一次基础知识与前沿案例之间的对应分析。",
            "教师能够基于课堂反馈判断哪些概念需要在下次课继续补强。",
        ],
        "fallback_plan": [
            "如果学生前置知识明显不足，缩短前沿拓展时间，优先保住核心机制讲清讲透。",
            "如果课堂讨论参与度低，改用更具体的二选一对比问题先带动发言。",
            "如果时间不足，保留主线总结与课后任务说明，把延伸阅读放到课后补充。",
        ],
        "risk_warning": "需避免课程包只停留在大纲式描述，授课时应持续检查学生是否真正建立了“概念 - 机制 - 场景 - 前沿”的关联。",
        "references": [
            "课程教材对应章节",
            "课程讲义、实验资料与教师自备案例",
            f"与 {frontier} 相关的标准、综述或工程实践资料",
        ],
    }

DEMO_LESSON_PACK = LessonPack(
    id=DEMO_LESSON_PACK_ID,
    course_id=DEMO_COURSE_ID,
    version=1,
    status="published",
    payload=build_mock_lesson_pack_payload(DEMO_COURSE),
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
        payload=build_mock_lesson_pack_payload(course),
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
