from __future__ import annotations

import base64
import zipfile
from typing import List, Optional
from xml.etree import ElementTree as ET

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None


def _strip_xml_text(xml_bytes: bytes) -> str:
    try:
        root = ET.fromstring(xml_bytes)
    except Exception:
        return ""
    texts: List[str] = []
    for elem in root.iter():
        if elem.text and elem.text.strip():
            texts.append(elem.text.strip())
    return " ".join(texts)


def extract_text_from_file(file_path: str, file_type: str) -> tuple[str, str]:
    file_type = (file_type or "").lower()
    try:
        if file_type == ".pdf":
            if PdfReader is None:
                return "当前环境尚未安装 pypdf，PDF 已保存但无法提取文本。", "stored"
            reader = PdfReader(file_path)
            pages: List[str] = []
            for page in reader.pages[:80]:
                text = (page.extract_text() or "").strip()
                if text:
                    pages.append(text)
            merged = "\n".join(pages).strip()
            if merged:
                return merged[:12000], "parsed"
            return "PDF 已保存，但未提取到可用文本（可能为扫描件或图片型 PDF）。", "stored"
        if file_type in {".txt", ".md", ".csv", ".json"}:
            raw = open(file_path, "rb").read()
            for encoding in ["utf-8", "gbk", "utf-8-sig"]:
                try:
                    return raw.decode(encoding), "parsed"
                except Exception:
                    continue
            return raw.decode("utf-8", errors="replace"), "parsed"
        if file_type == ".docx":
            with zipfile.ZipFile(file_path) as zf:
                xml_bytes = zf.read("word/document.xml")
            text = _strip_xml_text(xml_bytes)
            return text[:12000], "parsed" if text else "unsupported"
        if file_type == ".pptx":
            texts: List[str] = []
            with zipfile.ZipFile(file_path) as zf:
                for name in sorted(zf.namelist()):
                    if name.startswith("ppt/slides/slide") and name.endswith(".xml"):
                        texts.append(_strip_xml_text(zf.read(name)))
            merged = "\n".join([text for text in texts if text])
            return merged[:12000], "parsed" if merged else "unsupported"
        if file_type == ".zip":
            with zipfile.ZipFile(file_path) as zf:
                file_names = [name for name in zf.namelist() if not name.endswith("/")][:50]
            return "压缩包内容列表：" + "；".join(file_names), "indexed"
        if file_type in {".jpg", ".jpeg", ".png", ".webp"}:
            return "图片已保存；若所选模型支持视觉理解，系统会尝试结合图片分析。", "image"
        if file_type in {".doc", ".ppt", ".rar"}:
            return f"当前版本已保存该文件，但暂未深度解析 {file_type} 内容。", "stored"
    except Exception as exc:
        return f"文件解析失败：{exc}", "failed"
    return f"当前版本已保存该文件，但暂未支持解析 {file_type or '该类型'} 内容。", "stored"


def build_data_url(file_path: str, file_type: str) -> Optional[str]:
    mime_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }
    mime = mime_map.get(file_type.lower())
    if not mime:
        return None
    try:
        raw = open(file_path, "rb").read()
        encoded = base64.b64encode(raw).decode("utf-8")
        return f"data:{mime};base64,{encoded}"
    except Exception:
        return None
