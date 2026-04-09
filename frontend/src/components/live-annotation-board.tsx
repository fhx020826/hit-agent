"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, api, type AnnotationStroke, type LiveShareRecord, type MaterialItem } from "@/lib/api";

const TOOL_OPTIONS = [
  { key: "pen", label: "钢笔", alpha: 1 },
  { key: "pencil", label: "铅笔", alpha: 0.68 },
  { key: "ballpen", label: "圆珠笔", alpha: 0.9 },
  { key: "highlighter", label: "荧光笔", alpha: 0.28 },
  { key: "flash", label: "速消笔", alpha: 0.92 },
];

function isPdfMaterial(material: MaterialItem | null) {
  if (!material) return false;
  const filename = material.filename.toLowerCase();
  const fileType = (material.file_type || "").toLowerCase();
  return filename.endsWith(".pdf") || fileType.includes("pdf");
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<{ x: number; y: number }[]>([]);
  const syncTimerRef = useRef<number | null>(null);
  const [page, setPage] = useState(share.current_page || 1);
  const pageRef = useRef(page);
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#ef4444");
  const [lineWidth, setLineWidth] = useState(4);
  const [drawing, setDrawing] = useState<{ x: number; y: number }[]>([]);
  const [message, setMessage] = useState("");
  const [viewerUrl, setViewerUrl] = useState("");
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");

  const appendStroke = (stroke: AnnotationStroke) => {
    setStrokes((prev) => (prev.some((item) => item.id === stroke.id) ? prev : [...prev, stroke]));
  };

  const syncPageToAudience = (nextPage: number) => {
    if (!teacherMode) return;
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      void api.updateLiveSharePage(share.id, nextPage).catch(() => undefined);
    }, 180);
  };

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

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
        setPage(payload.share.current_page);
      }
      if (payload.event === "share_ended") {
        setMessage("教师已结束共享。");
      }
    };
    const timer = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, 15000);
    return () => {
      window.clearInterval(timer);
      ws.close();
    };
  }, [share.id]);

  useEffect(() => () => {
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
  }, []);

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
      context.globalAlpha = meta?.alpha ?? 1;
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.line_width;
      context.lineCap = "round";
      context.lineJoin = "round";
      const points = stroke.points_data || [];
      if (points.length > 0) {
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        context.stroke();
      }
      context.restore();
    });

    if (drawing.length > 1) {
      const meta = TOOL_OPTIONS.find((item) => item.key === tool);
      context.save();
      context.globalAlpha = meta?.alpha ?? 1;
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      context.moveTo(drawing[0].x, drawing[0].y);
      drawing.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
      context.restore();
    }
  }, [color, drawing, lineWidth, strokes, tool]);

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    if (!material?.download_url) return;

    queueMicrotask(() => {
      if (!active) return;
      setViewerLoading(true);
      setViewerError("");
    });
    api.fetchProtectedFile(material.download_url, material.filename).then((file) => {
      if (!active) {
        URL.revokeObjectURL(file.objectUrl);
        return;
      }
      objectUrl = file.objectUrl;
      setViewerUrl(file.objectUrl);
    }).catch((error) => {
      if (!active) return;
      setViewerUrl("");
      setViewerError(error instanceof Error ? error.message : "资料加载失败");
    }).finally(() => {
      if (active) setViewerLoading(false);
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [material?.download_url, material?.filename]);

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const target = e.currentTarget || canvasRef.current;
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const saveStroke = async (points: { x: number; y: number }[]) => {
    if (!teacherMode || points.length < 2) return;
    try {
      const stroke = await api.createAnnotationStroke(share.id, {
        page_no: page,
        tool_type: tool,
        color,
        line_width: lineWidth,
        points_data: points,
        is_temporary: tool === "flash",
        expires_in_seconds: tool === "flash" ? 8 : undefined,
      });
      appendStroke(stroke);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "批注发送失败");
    }
  };

  const beginDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!teacherMode) return;
    const point = pointerPos(e);
    if (!point) return;
    drawingRef.current = [point];
    setDrawing(drawingRef.current);
  };

  const extendDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!teacherMode || drawingRef.current.length === 0) return;
    const point = pointerPos(e);
    if (!point) return;
    drawingRef.current = [...drawingRef.current, point];
    setDrawing(drawingRef.current);
  };

  const endDrawing = () => {
    if (!teacherMode || drawingRef.current.length === 0) return;
    const points = drawingRef.current;
    drawingRef.current = [];
    setDrawing([]);
    void saveStroke(points);
  };

  const updateCurrentPage = (nextPage: number, autoSync = false) => {
    const normalizedPage = Math.max(1, Math.floor(nextPage || 1));
    setPage(normalizedPage);
    if (autoSync) syncPageToAudience(normalizedPage);
  };

  const handleViewerWheel = (e: React.WheelEvent<HTMLDivElement | HTMLCanvasElement>) => {
    if (!teacherMode || !isPdfMaterial(material)) return;
    e.preventDefault();
    updateCurrentPage(page + (e.deltaY > 0 ? 1 : -1), true);
  };

  const handleOpenOriginal = async () => {
    if (!material) return;
    try {
      setMessage("");
      await api.openProtectedFile(material.download_url, material.filename);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "打开原始资料失败");
    }
  };

  const handleDownloadOriginal = async () => {
    if (!material) return;
    try {
      setMessage("");
      await api.downloadProtectedFile(material.download_url, material.filename);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "下载原始资料失败");
    }
  };

  const materialLabel = useMemo(() => material?.filename || `共享资料 ${share.material_id}`, [material, share.material_id]);
  const hasMaterial = Boolean(material?.download_url);
  const effectiveViewerUrl = hasMaterial ? viewerUrl : "";
  const effectiveViewerError = hasMaterial ? viewerError : "";
  const effectiveViewerLoading = hasMaterial ? viewerLoading : false;
  const pdfViewerUrl = useMemo(() => effectiveViewerUrl ? `${effectiveViewerUrl}#page=${page}&toolbar=0&navpanes=0&scrollbar=0` : "", [effectiveViewerUrl, page]);
  const canRenderPdf = useMemo(() => isPdfMaterial(material) && Boolean(effectiveViewerUrl), [effectiveViewerUrl, material]);

  return (
    <main className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-sm font-semibold text-slate-500">课堂同步展示</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">{materialLabel}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">当前为第 {page} 页。学生端会同步看到页码与批注，学生不能修改批注内容。</p>
          </div>
          {material ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void handleOpenOriginal()} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">打开原始资料</button>
              <button onClick={() => void handleDownloadOriginal()} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">下载文件</button>
            </div>
          ) : null}
        </div>

        <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white/80">
          <div className="relative aspect-[16/10] min-h-[34rem] bg-[linear-gradient(180deg,#fff,#f8fafc)]">
            {canRenderPdf ? (
              <iframe key={pdfViewerUrl} src={pdfViewerUrl} title={`${materialLabel} PDF 预览`} className="absolute inset-0 h-full w-full bg-white" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.08),transparent_26%),linear-gradient(180deg,#fff,#f8fafc)] px-6 text-center">
                <div className="rounded-[24px] border border-dashed border-slate-300 px-8 py-10">
                  <p className="text-sm font-semibold text-slate-500">{isPdfMaterial(material) ? "PDF 正在加载中" : "当前资料暂不支持内嵌预览"}</p>
                  <p className="mt-2 text-xl font-bold text-slate-700">{materialLabel}</p>
                  <p className="mt-2 text-sm text-slate-500">{isPdfMaterial(material) ? "如果加载较慢，请稍候片刻。" : "可以点击右上角按钮打开原始资料或下载后查看。"} </p>
                </div>
              </div>
            )}

            {effectiveViewerLoading ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-600">正在加载资料预览...</div>
              </div>
            ) : null}

            {effectiveViewerError ? (
              <div className="absolute inset-x-6 bottom-6 z-20 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                资料加载失败：{effectiveViewerError}
              </div>
            ) : null}

            <div className="absolute left-6 top-6 z-20 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">第 {page} 页</div>

            {canRenderPdf ? <div className="absolute inset-0 z-[5] bg-transparent" onWheel={handleViewerWheel} /> : null}

            <canvas
              ref={canvasRef}
              width={1280}
              height={800}
              className={`absolute inset-0 z-10 h-full w-full bg-transparent touch-none ${teacherMode ? "cursor-crosshair" : "pointer-events-none"}`}
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
          <p className="text-sm font-semibold text-slate-500">工具栏</p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">{teacherMode ? "教师批注工具" : "学生只读视图"}</h3>
          {teacherMode ? (
            <>
              <div className="mt-5 flex flex-wrap gap-2">
                {TOOL_OPTIONS.map((item) => (
                  <button key={item.key} onClick={() => setTool(item.key)} className={`rounded-full px-3 py-2 text-sm font-semibold ${tool === item.key ? "ui-pill-active" : "ui-pill"}`}>{item.label}</button>
                ))}
              </div>
              <div className="mt-5 space-y-4">
                <label className="block text-sm font-semibold text-slate-700">
                  颜色
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-2 h-11 w-full rounded-2xl border border-slate-300 bg-white p-2" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  线条粗细：{lineWidth}
                  <input type="range" min={2} max={18} value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} className="mt-2 w-full" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  切页
                  <input type="number" min={1} value={page} onChange={(e) => updateCurrentPage(Number(e.target.value) || 1)} className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => updateCurrentPage(page - 1, true)} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">上一页</button>
                  <button onClick={() => updateCurrentPage(page + 1, true)} className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">下一页</button>
                  <button onClick={() => void api.updateLiveSharePage(share.id, page)} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">同步当前页</button>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm leading-7 text-slate-600">当前页面为学生同步查看模式，只能看到教师切页与批注，不能编辑。为保证批注坐标与页码同步，PDF 在共享页中会锁定为教师控制翻页，不允许本地自由滚动。</p>
          )}
          {message ? <p className="mt-4 text-sm text-slate-500">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
