from __future__ import annotations

from app.models.schemas import Course
from app.services import llm_generation


def _demo_course() -> Course:
    return Course(
        id="course-demo",
        name="新能源汽车热安全",
        audience="2024级车辆工程",
        class_name="车辆2401",
        student_level="本科",
        chapter="动力电池热失控机理",
        objectives="理解热失控传播路径并能设计课堂互动。",
        duration_minutes=90,
        frontier_direction="电池热管理与热安全",
        owner_user_id="teacher-demo",
        created_at="2026-05-08T00:00:00",
    )


def test_generate_lesson_pack_normalizes_nested_payload(monkeypatch) -> None:
    monkeypatch.setattr(
        llm_generation,
        "_call_chat_model",
        lambda *args, **kwargs: {
            "success": True,
            "content": """
```json
{
  "teaching_objectives": {
    "knowledge_objectives": ["理解热失控链路", "识别热扩散诱因"],
    "ability_objectives": ["能够分析典型热安全案例"]
  },
  "prerequisites": {
    "required_knowledge": ["电池基础", "传热基础"]
  },
  "main_thread": {
    "narrative_arc": "从单体失效到整包热扩散的演化逻辑",
    "storyline_segments": [
      {"title": "热失控触发机制", "description": "识别内短路与外部滥用诱因"},
      {"title": "抑制策略", "description": "对比结构防护与热管理"}
    ]
  },
  "frontier_topic": {
    "topic_name": "新型电池包热管理",
    "subtopics": [{"name": "液冷与相变材料协同"}]
  },
  "time_allocation": {
    "segments": [
      {"phase": "导入", "duration_minutes": 10, "activities": ["案例引入"]},
      {"phase": "讲授", "duration_minutes": 35, "activities": ["机理讲解", "图示分析"]}
    ]
  },
  "ppt_outline": {
    "slides": [
      {"title": "热失控定义", "content": "概念与阶段"},
      {"title": "抑制策略", "content": "材料与结构"}
    ]
  },
  "discussion_questions": [{"question": "为什么热失控会级联传播？"}],
  "after_class_tasks": [{"task": "分析一起公开事故案例"}],
  "references": ["GB 38031-2025"]
}
```""",
        },
    )

    pack = llm_generation.generate_lesson_pack(_demo_course())

    assert pack.payload["frontier_topic"]["name"] == "新型电池包热管理"
    assert pack.payload["teaching_objectives"][0].startswith("knowledge objectives:")
    assert "热失控触发机制" in pack.payload["main_thread"]
    assert pack.payload["time_allocation"][0]["segment"] == "导入"
    assert pack.payload["ppt_outline"][0].startswith("热失控定义")
    assert pack.payload["discussion_questions"] == ["为什么热失控会级联传播？"]


def test_generate_lesson_pack_repairs_truncated_first_response(monkeypatch) -> None:
    calls: list[int] = []

    def fake_call(*args, **kwargs):
        calls.append(1)
        if len(calls) == 1:
            return {
                "success": True,
                "content": '{"teaching_objectives":["理解热失控"],"prerequisites":["电池基础"]',
            }
        return {
            "success": True,
            "content": """
{
  "teaching_objectives": ["理解热失控"],
  "prerequisites": ["电池基础"],
  "main_thread": "从诱因到防护策略",
  "frontier_topic": {"name": "热安全前沿", "insert_position": "核心知识之后", "time_suggestion": "15分钟"},
  "time_allocation": [{"segment": "导入", "minutes": "10"}],
  "ppt_outline": ["热失控定义", "传播路径", "防护策略"],
  "teacher_tips": ["结合真实案例讲解"],
  "case_materials": ["典型事故复盘"],
  "discussion_questions": ["热扩散为什么难以阻断？"],
  "after_class_tasks": ["整理一页事故分析卡片"],
  "extended_reading": ["动力电池热安全综述"],
  "risk_warning": ["避免把演示结论直接等同于工程定值"],
  "references": ["GB 38031-2025"]
}
""",
        }

    monkeypatch.setattr(llm_generation, "_call_chat_model", fake_call)

    pack = llm_generation.generate_lesson_pack(_demo_course())

    assert len(calls) == 2
    assert pack.payload["main_thread"] == "从诱因到防护策略"
    assert pack.payload["teacher_tips"] == ["结合真实案例讲解"]
