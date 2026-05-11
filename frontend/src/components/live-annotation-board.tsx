"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { API_BASE, api, type AnnotationStroke, type LiveShareRecord, type MaterialItem } from "@/lib/api";
import { pick } from "@/lib/i18n";

const TOOL_OPTIONS = [
  { key: "pen", label: "钢笔", alpha: 1 },
  { key: "pencil", label: "铅笔", alpha: 0.68 },
  { key: "ballpen", label: "圆珠笔", alpha: 0.9 },
  { key: "highlighter", label: "荧光笔", alpha: 0.28 },
  { key: "flash", label: "速消笔", alpha: 0.92 },
];

const CANVAS_BASE_WIDTH = 1280;
const CANVAS_BASE_HEIGHT = 800;

function toolHint(tool: string, language: string) {
  if (tool === "eraser") {
    return language === "en-US" ? "Erase existing annotation strokes" : "橡皮擦除，擦掉已有批注轨迹";
  }
  const zh = {
    pen: "标准书写，线条清晰稳重",
    pencil: "铅笔质感，更轻更细，适合草稿",
    ballpen: "圆珠笔风格，边缘更硬朗",
    highlighter: "荧光笔标记，半透明加粗",
    flash: "临时强调线，数秒后自动淡出",
  } as const;
  const en = {
    pen: "Standard pen with stable clear strokes",
    pencil: "Lighter thinner draft-like strokes",
    ballpen: "Sharper ballpoint-like annotation",
    highlighter: "Semi-transparent thick highlight",
    flash: "Temporary emphasis that fades out",
  } as const;
  if (language === "en-US") return en[tool as keyof typeof en] || en.pen;
  return zh[tool as keyof typeof zh] || zh.pen;
}

function applyToolStyle(
  context: CanvasRenderingContext2D,
  tool: string,
  color: string,
  lineWidth: number,
  alpha: number,
) {
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = alpha;
  context.strokeStyle = color;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.setLineDash([]);

  if (tool === "pencil") {
    context.lineWidth = Math.max(1, lineWidth * 0.75);
    context.globalAlpha = Math.min(alpha, 0.58);
    return;
  }
  if (tool === "ballpen") {
    context.lineWidth = Math.max(1, lineWidth * 0.92);
    context.globalAlpha = Math.min(1, alpha * 0.95);
    context.shadowColor = "rgba(15,23,42,0.18)";
    context.shadowBlur = 0.8;
    return;
  }
  if (tool === "eraser") {
    // True erasing on annotation layer
    context.globalCompositeOperation = "destination-out";
    context.lineWidth = Math.max(10, lineWidth * 2.8);
    context.globalAlpha = 1;
    context.lineCap = "round";
    context.lineJoin = "round";
    return;
  }
  if (tool === "highlighter") {
    context.globalCompositeOperation = "multiply";
    context.lineWidth = Math.max(4, lineWidth * 2.4);
    context.globalAlpha = Math.min(alpha, 0.24);
    context.lineCap = "square";
    context.lineJoin = "miter";
    return;
  }
  if (tool === "flash") {
    context.lineWidth = Math.max(2, lineWidth * 1.3);
    context.globalAlpha = Math.min(1, alpha * 0.9);
    context.setLineDash([10, 8]);
    return;
  }

  context.lineWidth = lineWidth;
}

function isPdfMaterial(material: MaterialItem | null) {
  if (!material) return false;
  const filename = material.filename.toLowerCase();
  const fileType = (material.file_type || "").toLowerCase();
  return filename.endsWith(".pdf") || fileType.includes("pdf");
}

function toCanvasPoint(point: { x: number; y: number }, width: number, height: number) {
  if (point.x >= 0 && point.x <= 1.2 && point.y >= 0 && point.y <= 1.2) {
    return { x: point.x * width, y: point.y * height };
  }
  return point;
}

export function LiveAnnotationBoard({
  share,
  material,
  teacherMode,
}: {
  share: LiveShareRecord;
  material: MaterialItem | null;
  teacherMode: boolean;
}) {
  const { language } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<{ x: number; y: number }[]>([]);
  const syncTimerRef = useRef<number | null>(null);
  const pageCommitTimerRef = useRef<number | null>(null);
  const pendingPageRef = useRef(share.current_page || 1);
  const pendingSyncRef = useRef(false);
  const wheelLockRef = useRef(false);
  const localPageSyncRef = useRef<{ page: number; ts: number }>({ page: share.current_page || 1, ts: 0 });
  const [page, setPage] = useState(share.current_page || 1);
  const [viewerPage, setViewerPage] = useState(share.current_page || 1);
  const pageRef = useRef(page);
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [tool, setTool] = useState("pen");
  const [interactionMode, setInteractionMode] = useState<"annotate" | "browse">("annotate");
  const [color, setColor] = useState("#ef4444");
  const [lineWidth, setLineWidth] = useState(4);
  const [drawing, setDrawing] = useState<{ x: number; y: number }[]>([]);
  const [message, setMessage] = useState("");
  const [viewerBlob, setViewerBlob] = useState<Blob | null>(null);
  const [viewerFrameSrc, setViewerFrameSrc] = useState("");
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");
  const maxPage = useMemo(() => {
    const total = Number(material?.page_count || 0);
    return Number.isFinite(total) && total > 0 ? Math.floor(total) : null;
  }, [material?.page_count]);
  const [switchingPage, setSwitchingPage] = useState(false);
  const pdfMaterial = useMemo(() => isPdfMaterial(material), [material]);
  const annotationEnabled = teacherMode && interactionMode === "annotate";
  const canvasCapturesViewer = annotationEnabled || !teacherMode;
  const clampPage = useCallback((value: number) => {
    const minSafe = Math.max(1, Math.floor(value || 1));
    if (!maxPage) return minSafe;
    return Math.min(minSafe, maxPage);
  }, [maxPage]);
  const viewerAspectRatio = useMemo(() => {
    if (!pdfMaterial) return 16 / 10;
    const ratio = Number(material?.page_aspect_ratio || 0);
    if (Number.isFinite(ratio) && ratio >= 0.5 && ratio <= 2.4) return ratio;
    return 1 / Math.SQRT2;
  }, [material?.page_aspect_ratio, pdfMaterial]);
  const canvasSize = useMemo(() => {
    let width = viewerAspectRatio >= 1 ? 1600 : 1280;
    let height = Math.round(width / viewerAspectRatio);
    if (height > 2200) {
      height = 2200;
      width = Math.round(height * viewerAspectRatio);
    }
    if (height < 900) {
      height = 900;
      width = Math.round(height * viewerAspectRatio);
    }
    return { width, height };
  }, [viewerAspectRatio]);

  const appendStroke = (stroke: AnnotationStroke) => {
    setStrokes((prev) => (prev.some((item) => item.id === stroke.id) ? prev : [...prev, stroke]));
  };

  const syncPageToAudience = (nextPage: number) => {
    if (!teacherMode) return;
    localPageSyncRef.current = { page: nextPage, ts: Date.now() };
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      void api.updateLiveSharePage(share.id, nextPage).catch(() => undefined);
    }, 180);
  };

  useEffect(() => {
    pageRef.current = page;
    pendingPageRef.current = page;
  }, [page]);

  useEffect(() => {
    const initialPage = clampPage(share.current_page || 1);
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (pageCommitTimerRef.current) window.clearTimeout(pageCommitTimerRef.current);
      pendingSyncRef.current = false;
      pendingPageRef.current = initialPage;
      localPageSyncRef.current = { page: initialPage, ts: 0 };
      wheelLockRef.current = false;
      drawingRef.current = [];
      setDrawing([]);
      setStrokes([]);
      setPage(initialPage);
      setViewerPage(initialPage);
      setSwitchingPage(pdfMaterial);
    });
    return () => {
      active = false;
    };
  }, [clampPage, pdfMaterial, share.current_page, share.id]);

  useEffect(() => {
    if (!maxPage) return;
    const corrected = clampPage(pageRef.current);
    if (corrected === pageRef.current) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      pendingPageRef.current = corrected;
      setStrokes([]);
      setPage(corrected);
      setViewerPage(corrected);
      setSwitchingPage(pdfMaterial);
      if (teacherMode) {
        void api.updateLiveSharePage(share.id, corrected).catch(() => undefined);
      }
    });
    return () => {
      active = false;
    };
  }, [clampPage, maxPage, pdfMaterial, share.id, teacherMode]);

  useEffect(() => {
    api.listAnnotations(share.id, page).then(setStrokes).catch(() => setStrokes([]));
  }, [share.id, page]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const base = API_BASE.replace(/^http/, protocol);
    const ws = new WebSocket(`${base}/api/materials/live/${share.id}/ws`);
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.event === "annotation_created" && payload.annotation.page_no === pageRef.current) {
        appendStroke(payload.annotation);
      }
      if (payload.event === "page_changed") {
        const nextPage = clampPage(Number(payload.share.current_page || 1));
        const localSync = localPageSyncRef.current;
        const isLocalEcho = teacherMode && localSync.page === nextPage && Date.now() - localSync.ts < 900;
        if (!isLocalEcho && nextPage !== pageRef.current) {
          if (pageCommitTimerRef.current) window.clearTimeout(pageCommitTimerRef.current);
          pendingSyncRef.current = false;
          pendingPageRef.current = nextPage;
          setStrokes([]);
          setSwitchingPage(pdfMaterial);
          setPage(nextPage);
          setViewerPage(nextPage);
        }
      }
      if (payload.event === "share_ended") {
        setMessage(pick(language, "教师已结束共享。", "The teacher has ended the live session."));
      }
    };
    const timer = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, 15000);
    return () => {
      window.clearInterval(timer);
      ws.close();
    };
  }, [clampPage, language, pdfMaterial, share.id, teacherMode]);

  useEffect(() => () => {
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    if (pageCommitTimerRef.current) window.clearTimeout(pageCommitTimerRef.current);
  }, []);

  useEffect(() => {
    if (interactionMode === "browse") {
      if (pageCommitTimerRef.current) window.clearTimeout(pageCommitTimerRef.current);
      setViewerPage(pageRef.current);
      setSwitchingPage(false);
    }
  }, [interactionMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    const now = Date.now();
    strokes.forEach((stroke) => {
      if (stroke.is_temporary && stroke.expires_at && new Date(stroke.expires_at).getTime() < now) return;
      const meta = TOOL_OPTIONS.find((item) => item.key === stroke.tool_type);
      context.save();
      applyToolStyle(context, stroke.tool_type, stroke.color, stroke.line_width, meta?.alpha ?? 1);
      const points = stroke.points_data || [];
      const mappedPoints = points.map((point) => toCanvasPoint(point, canvas.width, canvas.height));
      if (mappedPoints.length > 0) {
        context.beginPath();
        context.moveTo(mappedPoints[0].x, mappedPoints[0].y);
        mappedPoints.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        context.stroke();
      }
      context.restore();
    });

    if (drawing.length > 1) {
      const meta = TOOL_OPTIONS.find((item) => item.key === tool);
      context.save();
      applyToolStyle(context, tool, color, lineWidth, meta?.alpha ?? 1);
      context.beginPath();
      context.moveTo(drawing[0].x, drawing[0].y);
      drawing.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
      context.restore();
    }
  }, [color, drawing, lineWidth, strokes, tool]);

  useEffect(() => {
    let active = true;
    if (!pdfMaterial || !material?.id) {
      queueMicrotask(() => {
        if (!active) return;
        setViewerBlob(null);
        setViewerFrameSrc("");
        setViewerLoading(false);
        setViewerError("");
      });
      return () => {
        active = false;
      };
    }

    queueMicrotask(() => {
      if (!active) return;
      setViewerLoading(true);
      setViewerError("");
      setViewerBlob(null);
      setViewerFrameSrc("");
    });
    api.fetchProtectedFile(`/api/materials/file/${material.id}/pages/${viewerPage}`, `${material.filename}-page-${viewerPage}.pdf`).then((file) => {
      if (!active) {
        URL.revokeObjectURL(file.objectUrl);
        return;
      }
      URL.revokeObjectURL(file.objectUrl);
      setViewerBlob(file.blob);
    }).catch((error) => {
      if (!active) return;
      setViewerBlob(null);
      setViewerFrameSrc("");
      setViewerError(error instanceof Error ? error.message : pick(language, "资料加载失败", "Failed to load the material"));
    }).finally(() => {
      if (active) setViewerLoading(false);
    });

    return () => {
      active = false;
    };
  }, [language, material?.filename, material?.id, pdfMaterial, viewerPage]);

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const target = e.currentTarget || canvasRef.current;
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    const scaleX = rect.width > 0 ? target.width / rect.width : 1;
    const scaleY = rect.height > 0 ? target.height / rect.height : 1;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const saveStroke = async (points: { x: number; y: number }[]) => {
    if (!teacherMode || points.length < 2) return;
    const width = canvasRef.current?.width || CANVAS_BASE_WIDTH;
    const height = canvasRef.current?.height || CANVAS_BASE_HEIGHT;
    const normalizedPoints = points.map((point) => ({
      x: Number((point.x / Math.max(width, 1)).toFixed(6)),
      y: Number((point.y / Math.max(height, 1)).toFixed(6)),
    }));
    try {
      const stroke = await api.createAnnotationStroke(share.id, {
        page_no: page,
        tool_type: tool,
        color,
        line_width: lineWidth,
        points_data: normalizedPoints,
        is_temporary: tool === "flash",
        expires_in_seconds: tool === "flash" ? 8 : undefined,
      });
      appendStroke(stroke);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "批注发送失败", "Failed to send the annotation"));
    }
  };

  const beginDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (switchingPage) return;
    if (!annotationEnabled) return;
    const point = pointerPos(e);
    if (!point) return;
    drawingRef.current = [point];
    setDrawing(drawingRef.current);
  };

  const extendDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (switchingPage) return;
    if (!annotationEnabled || drawingRef.current.length === 0) return;
    const point = pointerPos(e);
    if (!point) return;
    drawingRef.current = [...drawingRef.current, point];
    setDrawing(drawingRef.current);
  };

  const endDrawing = () => {
    if (!annotationEnabled || drawingRef.current.length === 0) return;
    const points = drawingRef.current;
    drawingRef.current = [];
    setDrawing([]);
    void saveStroke(points);
  };

  const updateCurrentPage = (nextPage: number, autoSync = false) => {
    const normalizedPage = clampPage(nextPage);
    if (normalizedPage === pageRef.current && normalizedPage === pendingPageRef.current) return;

    const shouldDelayCommit = interactionMode === "annotate" && teacherMode && pdfMaterial;
    if (!shouldDelayCommit) {
      if (pageCommitTimerRef.current) window.clearTimeout(pageCommitTimerRef.current);
      pendingSyncRef.current = false;
      pendingPageRef.current = normalizedPage;
      setStrokes([]);
      setSwitchingPage(pdfMaterial);
      setPage(normalizedPage);
      setViewerPage(normalizedPage);
      if (autoSync) syncPageToAudience(normalizedPage);
      return;
    }

    pendingPageRef.current = normalizedPage;
    pendingSyncRef.current = pendingSyncRef.current || autoSync;
    setSwitchingPage(true);
    if (pageCommitTimerRef.current) window.clearTimeout(pageCommitTimerRef.current);
    pageCommitTimerRef.current = window.setTimeout(() => {
      const committedPage = pendingPageRef.current;
      const shouldSync = pendingSyncRef.current;
      pendingSyncRef.current = false;
      setStrokes([]);
      setPage(committedPage);
      setViewerPage(committedPage);
      if (shouldSync) syncPageToAudience(committedPage);
    }, 220);
  };

  const handleViewerWheel = (e: React.WheelEvent<HTMLDivElement | HTMLCanvasElement>) => {
    if (!pdfMaterial) return;
    e.preventDefault();
    if (!teacherMode) return;
    if (drawingRef.current.length > 0 || wheelLockRef.current) return;
    const raw = Math.abs(e.deltaY) > 0 ? e.deltaY : e.deltaX;
    const direction = raw > 0 ? 1 : -1;
    const basePage = switchingPage ? pendingPageRef.current : pageRef.current;
    const nextPage = clampPage(basePage + direction);
    if (nextPage === basePage) return;
    wheelLockRef.current = true;
    updateCurrentPage(nextPage, true);
    window.setTimeout(() => {
      wheelLockRef.current = false;
    }, 140);
  };

  const handleOpenOriginal = async () => {
    if (!material) return;
    try {
      setMessage("");
      await api.openProtectedFile(material.download_url, material.filename);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "打开原始资料失败", "Failed to open the original material"));
    }
  };

  const handleDownloadOriginal = async () => {
    if (!material) return;
    try {
      setMessage("");
      await api.downloadProtectedFile(material.download_url, material.filename);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "下载原始资料失败", "Failed to download the original material"));
    }
  };

  const materialLabel = useMemo(() => material?.filename || pick(language, `共享资料 ${share.material_id}`, `Shared material ${share.material_id}`), [language, material, share.material_id]);
  const hasMaterial = Boolean(material?.download_url);
  const effectiveViewerBlob = hasMaterial ? viewerBlob : null;
  const effectiveViewerError = hasMaterial ? viewerError : "";
  const effectiveViewerLoading = hasMaterial ? viewerLoading : false;
  const canRenderPdf = useMemo(() => pdfMaterial && Boolean(effectiveViewerBlob), [effectiveViewerBlob, pdfMaterial]);
  const viewerFrameStyle = useMemo(() => ({
    aspectRatio: String(viewerAspectRatio),
    minHeight: viewerAspectRatio < 1 ? "42rem" : "34rem",
  }), [viewerAspectRatio]);
  const canvasOverlayStyle = useMemo(() => ({
    right: annotationEnabled && canRenderPdf ? "18px" : "0px",
  }), [annotationEnabled, canRenderPdf]);
  const handleViewerLoaded = () => {
    if (viewerFrameSrc === "about:blank") return;
    setSwitchingPage(false);
  };

  useEffect(() => {
    if (!canRenderPdf || !effectiveViewerBlob) {
      queueMicrotask(() => setViewerFrameSrc(""));
      return;
    }
    let active = true;
    let pageObjectUrl = "";
    queueMicrotask(() => {
      if (!active) return;
      setViewerFrameSrc("about:blank");
    });
    const timer = window.setTimeout(() => {
      if (!active) return;
      pageObjectUrl = URL.createObjectURL(effectiveViewerBlob);
      setViewerFrameSrc(`${pageObjectUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH,0`);
    }, 24);
    return () => {
      active = false;
      window.clearTimeout(timer);
      if (pageObjectUrl) URL.revokeObjectURL(pageObjectUrl);
    };
  }, [canRenderPdf, effectiveViewerBlob, viewerPage]);

  return (
    <main className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-sm font-semibold text-slate-500">{pick(language, "课堂同步展示", "Live Class View")}</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">{materialLabel}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{pick(language, `当前为第 ${page}${maxPage ? ` / ${maxPage}` : ""} 页。学生端会同步看到页码与批注，学生不能修改批注内容。`, `You are on page ${page}${maxPage ? ` / ${maxPage}` : ""}. Students see the same page and annotations but cannot edit them.`)}</p>
          </div>
          {material ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void handleOpenOriginal()} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">{pick(language, "打开原始资料", "Open Original")}</button>
              <button onClick={() => void handleDownloadOriginal()} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">{pick(language, "下载文件", "Download File")}</button>
            </div>
          ) : null}
        </div>

        <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white/80">
          <div className="relative w-full bg-[linear-gradient(180deg,#fff,#f8fafc)]" style={viewerFrameStyle}>
            {canRenderPdf ? (
              <iframe
                key={viewerFrameSrc || "pdf-viewer"}
                src={viewerFrameSrc || "about:blank"}
                title={`${materialLabel} PDF 预览`}
                className="absolute inset-0 h-full w-full bg-white"
                onLoad={handleViewerLoaded}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.08),transparent_26%),linear-gradient(180deg,#fff,#f8fafc)] px-6 text-center">
                <div className="rounded-[24px] border border-dashed border-slate-300 px-8 py-10">
                  <p className="text-sm font-semibold text-slate-500">{pdfMaterial ? pick(language, "PDF 正在加载中", "Loading PDF") : pick(language, "当前资料暂不支持内嵌预览", "This material does not support embedded preview")}</p>
                  <p className="mt-2 text-xl font-bold text-slate-700">{materialLabel}</p>
                  <p className="mt-2 text-sm text-slate-500">{pdfMaterial ? pick(language, "如果加载较慢，请稍候片刻。", "If loading is slow, please wait a moment.") : pick(language, "可以点击右上角按钮打开原始资料或下载后查看。", "Use the top-right actions to open or download the original file.")} </p>
                </div>
              </div>
            )}

            {effectiveViewerLoading ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-600">{pick(language, "正在加载资料预览...", "Loading preview...")}</div>
              </div>
            ) : null}

            {teacherMode && interactionMode === "annotate" && switchingPage && canRenderPdf ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/35">
                <div className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
                  {pick(language, "正在切页...", "Switching page...")}
                </div>
              </div>
            ) : null}

            {effectiveViewerError ? (
              <div className="absolute inset-x-6 bottom-6 z-20 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {pick(language, "资料加载失败：", "Preview failed: ")}{effectiveViewerError}
              </div>
            ) : null}

            <div className="absolute left-6 top-6 z-20 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">{pick(language, `第 ${page}${maxPage ? ` / ${maxPage}` : ""} 页`, `Page ${page}${maxPage ? ` / ${maxPage}` : ""}`)}</div>

            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              style={canvasOverlayStyle}
              className={`absolute inset-y-0 left-0 z-10 h-full bg-transparent touch-none ${canvasCapturesViewer ? "pointer-events-auto" : "pointer-events-none"} ${annotationEnabled ? "cursor-crosshair" : "cursor-default"}`}
              onWheel={handleViewerWheel}
              onPointerDown={beginDrawing}
              onPointerMove={extendDrawing}
              onPointerUp={endDrawing}
              onPointerLeave={endDrawing}
            />
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "工具栏", "Toolbar")}</p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">{teacherMode ? pick(language, "教师批注工具", "Teacher Annotation Tools") : pick(language, "学生只读视图", "Student Read-only View")}</h3>
          {teacherMode ? (
            <>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => setInteractionMode("annotate")}
                  className={`rounded-full px-3 py-2 text-sm font-semibold ${interactionMode === "annotate" ? "ui-pill-active" : "ui-pill"}`}
                >
                  {pick(language, "批注模式", "Annotate Mode")}
                </button>
                <button
                  onClick={() => setInteractionMode("browse")}
                  className={`rounded-full px-3 py-2 text-sm font-semibold ${interactionMode === "browse" ? "ui-pill-active" : "ui-pill"}`}
                >
                  {pick(language, "浏览模式", "Browse Mode")}
                </button>
              </div>
              <p className="mt-3 text-xs leading-6 text-slate-500">
                {interactionMode === "annotate"
                  ? pick(language, "批注模式下可用鼠标滚轮切页并直接书写批注。", "In annotate mode, mouse wheel changes pages and pen input is enabled.")
                  : pick(language, "浏览模式下可直接操作 PDF 右侧滚动条，避免误触画笔。", "In browse mode, you can use the PDF scrollbar directly and avoid accidental drawing.")}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {TOOL_OPTIONS.map((item) => (
                  <button key={item.key} onClick={() => setTool(item.key)} className={`rounded-full px-3 py-2 text-sm font-semibold ${tool === item.key ? "ui-pill-active" : "ui-pill"}`}>{item.label}</button>
                ))}
                <button
                  onClick={() => setTool("eraser")}
                  className={`rounded-full px-3 py-2 text-sm font-semibold ${tool === "eraser" ? "ui-pill-active" : "ui-pill"}`}
                >
                  {pick(language, "橡皮擦", "Eraser")}
                </button>
              </div>
              <div className="mt-5 space-y-4">
                <label className="block text-sm font-semibold text-slate-700">
                  {pick(language, "颜色", "Color")}
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-2 h-11 w-full rounded-2xl border border-slate-300 bg-white p-2" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  {pick(language, `线条粗细：${lineWidth}`, `Line width: ${lineWidth}`)}
                  <input type="range" min={2} max={18} value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} className="mt-2 w-full" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  {pick(language, "切页", "Page")}
                  <input type="number" min={1} max={maxPage || undefined} value={page} onChange={(e) => updateCurrentPage(Number(e.target.value) || 1)} className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
                </label>
                <p className="text-xs leading-6 text-slate-500">{toolHint(tool, language)}</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => updateCurrentPage(page - 1, true)} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">{pick(language, "上一页", "Previous")}</button>
                  <button onClick={() => updateCurrentPage(page + 1, true)} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">{pick(language, "下一页", "Next")}</button>
                  <button onClick={() => void api.updateLiveSharePage(share.id, page)} className="button-primary rounded-full px-4 py-2 text-sm font-semibold">{pick(language, "同步当前页", "Sync This Page")}</button>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm leading-7 text-slate-600">{pick(language, "当前页面为学生同步查看模式，只能看到教师切页与批注，不能编辑。为保证批注坐标与页码同步，PDF 在共享页中会锁定为教师控制翻页，不允许本地自由滚动。", "This is the student synchronized view. Students can only watch page changes and annotations. To keep coordinates and pages aligned, PDF paging stays under teacher control.")}</p>
          )}
          {message ? <p className="mt-4 text-sm text-slate-500">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
