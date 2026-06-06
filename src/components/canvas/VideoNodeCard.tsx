import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Camera, ChevronUp, Download, Eye, Film, Loader2, Pause, Play, Plus, ScanSearch, Volume2, VolumeX } from "lucide-react";
import { GraphNode, VideoFrameAnalysisOverview, VideoFrameAnalysisSegment } from "../../types";
import { findResolvedStringInput } from "../../utils/resolvedInputs";
import { shouldShowInlinePortHandles } from "../../utils/portHandleVisibility";
import { getNodeWidth, VIDEO_NODE_WIDTH } from "./geometry";
import { Tooltip } from "../common/Tooltip";
import { downloadMediaAsset, extensionFromAssetUrl, isLocalBrowserAsset } from "../../utils/mediaAssets";

interface VideoNodeCardProps {
  node: GraphNode;
  selected: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (event: React.PointerEvent, node: GraphNode) => void;
  onUpdateProperty?: (nodeId: string, key: string, value: unknown) => void;
  onUpdateData?: (nodeId: string, data: Partial<GraphNode["data"]>) => void;
  onPreview?: (content: string, title?: string, nodeId?: string, items?: string[], currentIndex?: number) => void;
  onAnalyzeVideo?: (node: GraphNode, segments: VideoFrameAnalysisSegment[], overview: VideoFrameAnalysisOverview) => Promise<void> | void;
  resolvedInputs?: Record<string, unknown>;
  onRun?: (nodeId: string) => void;
  isLinkingOnCanvas?: boolean;
  linkFromNodeId?: string | null;
  linkFromOutputIndex?: number | null;
  linkToNodeId?: string | null;
  linkToInputIndex?: number | null;
  onBeginCanvasLink?: (nodeId: string, outputIndex: number, clientX: number, clientY: number) => void;
  onFinishCanvasLink?: (nodeId?: string, inputIndex?: number) => void;
  onHoverCanvasLinkTarget?: (nodeId: string, inputIndex: number) => void;
  onLeaveCanvasLinkTarget?: (nodeId: string, inputIndex: number) => void;
  getCanvasLinkTargetIssue?: (nodeId: string, inputIndex: number) => string | null;
}

const RESULT_VIDEO_MAX_HEIGHT = 390;
const RATIO_OPTIONS = ["16:9", "9:16", "4:3", "3:4", "1:1"];
const DURATION_OPTIONS = ["6s", "10s"];
const RESOLUTION_OPTIONS = ["768P", "1080P"];
const MINIMAX_VIDEO_MODEL = "MiniMax-Hailuo-2.3";

function parseAspectRatio(ratio: string): number {
  const [w, h] = ratio.split(":").map((value) => Number.parseFloat(value));
  if (!Number.isFinite(w) || !Number.isFinite(h) || h <= 0) return 16 / 9;
  return w / h;
}

function fitVideoSize(naturalSize: { width: number; height: number } | null, aspectRatio: string, maxWidth: number, maxHeight: number) {
  if (naturalSize && naturalSize.width > 0 && naturalSize.height > 0) {
    const scale = Math.min(maxWidth / naturalSize.width, maxHeight / naturalSize.height, 1);
    return {
      width: Math.round(naturalSize.width * scale),
      height: Math.round(naturalSize.height * scale),
    };
  }

  const ratio = parseAspectRatio(aspectRatio);
  if (ratio >= maxWidth / maxHeight) return { width: maxWidth, height: Math.round(maxWidth / ratio) };
  return { width: Math.round(maxHeight * ratio), height: maxHeight };
}

function getFrameAnalysisTileSize(video: HTMLVideoElement) {
  const sourceWidth = video.videoWidth || 16;
  const sourceHeight = video.videoHeight || 9;
  const aspect = sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : 16 / 9;
  const longSide = 176;
  if (aspect >= 1) {
    return {
      width: longSide,
      height: Math.max(72, Math.round(longSide / aspect)),
    };
  }
  return {
    width: Math.max(72, Math.round(longSide * aspect)),
    height: longSide,
  };
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function cycleValue<T>(values: T[], current: T): T {
  const index = values.indexOf(current);
  return values[(index + 1) % values.length] ?? values[0];
}

function VideoNodeCardImpl({
  node,
  selected,
  onSelect,
  onDelete: _onDelete,
  onDuplicate: _onDuplicate,
  onDragStart,
  onUpdateProperty,
  onUpdateData,
  onPreview,
  onAnalyzeVideo,
  resolvedInputs,
  onRun,
  isLinkingOnCanvas,
  linkFromNodeId,
  linkFromOutputIndex,
  linkToNodeId,
  linkToInputIndex,
  onBeginCanvasLink,
  onFinishCanvasLink,
  onHoverCanvasLinkTarget,
  onLeaveCanvasLinkTarget,
  getCanvasLinkTargetIssue,
}: VideoNodeCardProps) {
  const isRunning = node.data?.loading === true;
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [mediaDuration, setMediaDuration] = React.useState(0);
  const [muted, setMuted] = React.useState(false);
  const [frameMenuOpen, setFrameMenuOpen] = React.useState(false);
  const [isAnalyzingFrames, setIsAnalyzingFrames] = React.useState(false);
  const previewNodeRef = React.useRef<HTMLDivElement | null>(null);
  const mediaFrameRef = React.useRef<HTMLDivElement | null>(null);
  const [naturalVideoSize, setNaturalVideoSize] = React.useState<{ width: number; height: number } | null>(() => {
    const width = node.data?.videoNaturalWidth;
    const height = node.data?.videoNaturalHeight;
    return typeof width === "number" && typeof height === "number" ? { width, height } : null;
  });
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const upstreamPrompt = findResolvedStringInput(resolvedInputs, ["prompt", "text", "视频提示词", "用户提示词"]);
  const promptText = upstreamPrompt?.value || (node.properties.text as string) || "";
  const videoUrl = (node.data?.videoUrl as string) || (node.properties.videoUrl as string) || "";
  const aspectRatio = (node.properties.aspect_ratio as string) || "16:9";
  const resolution = (node.properties.resolution as string) || "768P";
  const duration = (node.properties.duration as string) || "6s";
  const audioEnabled = node.properties.audio !== false;
  const nodeBadgeTitle = node.title === "视频节点" || node.title === "视频" ? "视频节点 1" : node.title;
  const nodeBadgeMatch = nodeBadgeTitle.match(/^(.*?)(\s+\d+)$/);
  const nodeWidth = getNodeWidth(node);
  const resultVideoSize = React.useMemo(
    () => fitVideoSize(naturalVideoSize, aspectRatio, VIDEO_NODE_WIDTH, RESULT_VIDEO_MAX_HEIGHT),
    [aspectRatio, naturalVideoSize],
  );
  const naturalSizeLabel =
    naturalVideoSize && naturalVideoSize.width > 0 && naturalVideoSize.height > 0
      ? `${naturalVideoSize.width} × ${naturalVideoSize.height}`
      : `${resultVideoSize.width} × ${resultVideoSize.height}`;

  React.useEffect(() => {
    const width = node.data?.videoNaturalWidth;
    const height = node.data?.videoNaturalHeight;
    setNaturalVideoSize(typeof width === "number" && typeof height === "number" ? { width, height } : null);
  }, [node.data?.videoNaturalHeight, node.data?.videoNaturalWidth, videoUrl]);

  React.useEffect(() => {
    if (!videoUrl || !previewNodeRef.current) return;

    const syncNodeBounds = () => {
      const nextWidth = Math.round(previewNodeRef.current?.offsetWidth ?? 0);
      const nextHeight = Math.round(previewNodeRef.current?.offsetHeight ?? 0);
      const nextPortCenterY = Math.round((mediaFrameRef.current?.offsetTop ?? 0) + (mediaFrameRef.current?.offsetHeight ?? 0) / 2);
      if (
        nextWidth > 0 &&
        nextHeight > 0 &&
        (node.data?.videoNodeWidth !== nextWidth || node.data?.videoNodeHeight !== nextHeight || node.data?.videoPortCenterY !== nextPortCenterY)
      ) {
        onUpdateData?.(node.id, {
          videoNodeWidth: nextWidth,
          videoNodeHeight: nextHeight,
          videoPortCenterY: nextPortCenterY,
        });
      }
    };

    syncNodeBounds();
    const frame = window.requestAnimationFrame(syncNodeBounds);
    return () => window.cancelAnimationFrame(frame);
  }, [node.data?.videoNodeHeight, node.data?.videoNodeWidth, node.id, onUpdateData, resultVideoSize.height, resultVideoSize.width, videoUrl]);

  const handleRun = () => {
    if (isRunning) return;
    onRun?.(node.id);
  };

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  };

  const seekTo = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  };

  const captureFrame = async (mode: "current" | "first" | "last") => {
    const video = videoRef.current;
    if (!video || video.readyState < 1) return;

    const targetTime = mode === "first" ? 0 : mode === "last" ? Math.max(0, video.duration - 0.05) : video.currentTime;
    const draw = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || resultVideoSize.width;
      canvas.height = video.videoHeight || resultVideoSize.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      onUpdateData?.(node.id, { videoFrameUrl: canvas.toDataURL("image/png") });
    };

    if (Math.abs(video.currentTime - targetTime) < 0.02) {
      draw();
      setFrameMenuOpen(false);
      return;
    }

    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);
      video.currentTime = targetTime;
    });
    draw();
    setFrameMenuOpen(false);
  };

  const downloadVideo = () => {
    if (!videoUrl) return;
    const extension = extensionFromAssetUrl(videoUrl, "mp4");
    const filename = `${nodeBadgeTitle.replace(/\s+/g, "-") || "video-node"}-${Date.now()}.${extension}`;
    void downloadMediaAsset(videoUrl, filename);
  };

  const seekVideo = (video: HTMLVideoElement, time: number) =>
    new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("视频跳帧超时"));
      }, 8000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
      };
      const onSeeked = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("视频跳帧失败"));
      };
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onError);
      video.currentTime = Math.min(Math.max(time, 0), Math.max(video.duration - 0.05, 0));
    });

  const analyzeFrames = async () => {
    if (!videoUrl || isAnalyzingFrames) return;
    setIsAnalyzingFrames(true);
    let objectUrl = "";
    try {
      if (!isLocalBrowserAsset(videoUrl)) {
        const assetResponse = await fetch(`/api/download-asset?url=${encodeURIComponent(videoUrl)}&filename=frame-analysis.mp4`);
        if (!assetResponse.ok) throw new Error("无法读取视频文件");
        const blob = await assetResponse.blob();
        objectUrl = URL.createObjectURL(blob);
      }
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.src = objectUrl || videoUrl;
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        await new Promise<void>((resolve) => {
          const onLoaded = () => {
            video.removeEventListener("loadedmetadata", onLoaded);
            resolve();
          };
          video.addEventListener("loadedmetadata", onLoaded);
          video.load();
        });
      }

      const durationSeconds = Math.max(video.duration || 15, 1);
      const segmentLength = 15;
      const segmentCount = Math.max(1, Math.ceil(durationSeconds / segmentLength));
      const frameCount: number = 15;
      const columns = 5;
      const rows = 3;
      const { width: tileWidth, height: tileHeight } = getFrameAnalysisTileSize(video);
      video.pause();

      const segments: VideoFrameAnalysisSegment[] = [];
      const segmentCanvases: HTMLCanvasElement[] = [];
      for (let index = 0; index < segmentCount; index += 1) {
        const start = index * segmentLength;
        const end = Math.min(durationSeconds, start + segmentLength);
        const canvas = document.createElement("canvas");
        canvas.width = columns * tileWidth;
        canvas.height = rows * tileHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("无法创建逐帧分析画布");

        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
          const progress = frameCount === 1 ? 0 : frameIndex / (frameCount - 1);
          const sampleAt = start + Math.max(0.05, (end - start) * progress - 0.02);
          await seekVideo(video, sampleAt);
          const x = (frameIndex % columns) * tileWidth;
          const y = Math.floor(frameIndex / columns) * tileHeight;
          ctx.drawImage(video, x, y, tileWidth, tileHeight);
        }

        segmentCanvases.push(canvas);
        segments.push({
          title: `分段${index + 1}_${Math.round(start)}-${Math.round(end)}秒`,
          start,
          end,
          imageUrl: canvas.toDataURL("image/jpeg", 0.86),
          width: canvas.width,
          height: canvas.height,
          frameCount,
        });
      }

      const overviewCanvas = document.createElement("canvas");
      overviewCanvas.width = segmentCanvases[0]?.width || columns * tileWidth;
      overviewCanvas.height = segmentCanvases.reduce((sum, canvas) => sum + canvas.height, 0) || rows * tileHeight;
      const overviewCtx = overviewCanvas.getContext("2d");
      if (!overviewCtx) throw new Error("无法创建完整逐帧总览画布");
      overviewCtx.fillStyle = "#000000";
      overviewCtx.fillRect(0, 0, overviewCanvas.width, overviewCanvas.height);
      let offsetY = 0;
      for (const canvas of segmentCanvases) {
        overviewCtx.drawImage(canvas, 0, offsetY);
        offsetY += canvas.height;
      }

      await onAnalyzeVideo?.(node, segments, {
        imageUrl: overviewCanvas.toDataURL("image/jpeg", 0.86),
        width: overviewCanvas.width,
        height: overviewCanvas.height,
        frameCount: segments.reduce((sum, segment) => sum + segment.frameCount, 0),
      });
    } catch (error) {
      onUpdateData?.(node.id, { error: error instanceof Error ? error.message : "逐帧分析失败" });
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setIsAnalyzingFrames(false);
    }
  };

  const portHandles = (
    <AnimatePresence>
      {shouldShowInlinePortHandles({ isHovered, isLinkingOnCanvas, selected }) && (
        <>
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="absolute -left-11 z-10 -translate-y-1/2"
            style={{ top: node.data?.videoPortCenterY ?? "50%" }}
          >
            <div
              role="button"
              tabIndex={-1}
              data-node-action="true"
              data-port-role="input"
              data-node-id={node.id}
              data-port-index={0}
              className={`canvas-port-handle flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 hover:scale-110 ${
                isLinkingOnCanvas && linkToNodeId === node.id && linkToInputIndex === 0 ? "canvas-port-input canvas-port-hot scale-110" : "canvas-port-input"
              }`}
              onPointerEnter={() => onHoverCanvasLinkTarget?.(node.id, 0)}
              onPointerLeave={() => onLeaveCanvasLinkTarget?.(node.id, 0)}
              onPointerUp={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onFinishCanvasLink?.(node.id, 0);
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              title={getCanvasLinkTargetIssue?.(node.id, 0) || "输入端口: 点击此处完成连线"}
            >
              <Plus className="h-4 w-4 pointer-events-none" />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="absolute -right-11 z-10 -translate-y-1/2"
            style={{ top: node.data?.videoPortCenterY ?? "50%" }}
          >
            <div
              role="button"
              tabIndex={-1}
              data-node-action="true"
              data-port-role="output"
              data-node-id={node.id}
              data-port-index={0}
              className={`canvas-port-handle flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 hover:scale-110 ${
                isLinkingOnCanvas && linkFromNodeId === node.id && linkFromOutputIndex === 0 ? "canvas-port-output canvas-port-active scale-110" : "canvas-port-output"
              }`}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                onBeginCanvasLink?.(node.id, 0, e.clientX, e.clientY);
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              title="输出端口: 按住并拖拽进行连线 (支持多条输出)"
            >
              <Plus className="h-4 w-4 pointer-events-none" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (videoUrl && !isRunning) {
    return (
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        className="absolute text-left"
        style={{ width: resultVideoSize.width }}
        ref={previewNodeRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <motion.div
          onPointerDown={(e) => {
            if (e.button !== 0) {
              e.stopPropagation();
              return;
            }
            const target = e.target as HTMLElement;
            if (!target.closest("[data-node-action='true']")) onDragStart(e, node);
            else e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(e);
          }}
          className="group relative cursor-grab active:cursor-grabbing"
          style={{ width: resultVideoSize.width }}
        >
          {portHandles}
          <AnimatePresence>
            {selected && (
              <motion.div
                data-node-action="true"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="absolute left-1/2 top-0 z-40 flex h-14 -translate-x-1/2 -translate-y-[calc(100%+18px)] items-center gap-2 rounded-[20px] border border-slate-500/18 bg-[#121923]/95 px-4 shadow-[0_18px_44px_-24px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <Tooltip content="下载视频" position="top">
                  <button
                    type="button"
                    onClick={downloadVideo}
                    className="flex h-9 w-9 items-center justify-center rounded-[12px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </Tooltip>
                <div className="mx-1 h-7 w-px bg-slate-500/22" />
                <Tooltip content="逐帧分析" position="top">
                  <button
                    type="button"
                    onClick={analyzeFrames}
                    disabled={isAnalyzingFrames}
                    className="flex h-9 w-9 items-center justify-center rounded-[12px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100 disabled:cursor-wait disabled:text-cyan-200"
                  >
                    {isAnalyzingFrames ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanSearch className="h-5 w-5" />}
                  </button>
                </Tooltip>
                <div className="mx-1 h-7 w-px bg-slate-500/22" />
                <Tooltip content="全屏预览" position="top">
                  <button
                    type="button"
                    onClick={() => onPreview?.(videoUrl, "视频节点预览", node.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-[12px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mb-2 flex items-center justify-between gap-4 text-slate-300/82 drop-shadow-[0_1px_10px_rgba(15,23,42,0.9)]">
            <div className="flex min-w-0 items-center gap-1.5">
              <Film className="h-4 w-4 shrink-0 text-slate-300/72" />
              <span className="truncate text-[15px] font-medium tracking-tight">
                {nodeBadgeMatch ? (
                  <>
                    <span>{nodeBadgeMatch[1]}</span>
                    <span className="text-slate-200/72">{nodeBadgeMatch[2]}</span>
                  </>
                ) : (
                  nodeBadgeTitle
                )}
              </span>
            </div>
            <span className="shrink-0 text-[12px] font-medium tabular-nums text-slate-400/72">{naturalSizeLabel}</span>
          </div>
          <div ref={mediaFrameRef} className={`relative overflow-hidden rounded-[8px] bg-black ${selected ? "shadow-[0_0_0_1.5px_rgba(192,132,252,0.58),0_0_0_6px_rgba(139,92,246,0.14),0_0_38px_rgba(109,40,217,0.18)]" : ""}`} style={{ width: resultVideoSize.width, height: resultVideoSize.height }}>
            <video
              ref={videoRef}
              src={videoUrl}
              className="block h-full w-full object-contain"
              muted={muted || !audioEnabled}
              playsInline
              onLoadedMetadata={(e) => {
                const video = e.currentTarget;
                const naturalSize = { width: video.videoWidth || resultVideoSize.width, height: video.videoHeight || resultVideoSize.height };
                const displaySize = fitVideoSize(naturalSize, aspectRatio, VIDEO_NODE_WIDTH, RESULT_VIDEO_MAX_HEIGHT);
                setNaturalVideoSize(naturalSize);
                setMediaDuration(video.duration || 0);
                if (
                  node.data?.videoNaturalWidth !== naturalSize.width ||
                  node.data?.videoNaturalHeight !== naturalSize.height ||
                  node.data?.videoDisplayWidth !== displaySize.width ||
                  node.data?.videoDisplayHeight !== displaySize.height
                ) {
                  onUpdateData?.(node.id, {
                    videoNaturalWidth: naturalSize.width,
                    videoNaturalHeight: naturalSize.height,
                    videoDisplayWidth: displaySize.width,
                    videoDisplayHeight: displaySize.height,
                  });
                }
              }}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onDurationChange={(e) => setMediaDuration(e.currentTarget.duration || 0)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              draggable={false}
            />
            <div
              data-node-action="true"
              className="absolute inset-x-0 bottom-0 flex h-11 items-center gap-3 rounded-b-[8px] bg-black/92 px-4 text-white shadow-[0_-14px_32px_-26px_rgba(0,0,0,0.95)]"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" onClick={togglePlay} className="flex h-8 w-8 items-center justify-center text-white" title={isPlaying ? "暂停" : "播放"}>
                {isPlaying ? <Pause className="h-6 w-6 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
              </button>
              <span className="w-10 text-[13px] font-medium tabular-nums">{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={Math.max(mediaDuration, 0.01)}
                step={0.01}
                value={Math.min(currentTime, Math.max(mediaDuration, 0.01))}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="h-1 flex-1 cursor-pointer accent-white"
              />
              <span className="w-10 text-right text-[13px] font-medium tabular-nums">{formatTime(mediaDuration)}</span>
              <button
                type="button"
                onClick={() => setMuted((value) => !value)}
                className="flex h-8 w-8 items-center justify-center text-white"
                title={muted || !audioEnabled ? "打开声音" : "静音"}
              >
                {muted || !audioEnabled ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFrameMenuOpen((open) => !open)}
                  className="flex h-8 w-8 items-center justify-center text-white"
                  title="点击截取当前帧"
                >
                  <Camera className="h-5 w-5" />
                </button>
                <AnimatePresence>
                  {frameMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      className="absolute bottom-11 right-0 w-[132px] overflow-hidden rounded-[8px] bg-[#1f1d1a]/96 py-2 text-[13px] text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)]"
                    >
                      <button type="button" className="block w-full px-4 py-2 text-left hover:bg-white/10" onClick={() => captureFrame("first")}>
                        截取首帧
                      </button>
                      <button type="button" className="block w-full px-4 py-2 text-left hover:bg-white/10" onClick={() => captureFrame("last")}>
                        截取尾帧
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.96, opacity: 0 }}
      transition={{ type: "spring", damping: 22, stiffness: 280 }}
      className="absolute text-left"
      style={{ width: nodeWidth }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        onPointerDown={(e) => {
          if (e.button !== 0) {
            e.stopPropagation();
            return;
          }
          const target = e.target as HTMLElement;
          if (!target.closest("[data-node-action='true']") && !target.closest("textarea,button,input")) onDragStart(e, node);
          else e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(e);
        }}
        className={`group node-card relative cursor-grab rounded-[18px] border bg-[#121723]/88 shadow-[0_28px_80px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl transition-all duration-300 active:cursor-grabbing ${
          selected
            ? "border-violet-300/26 -translate-y-[1px] shadow-[0_40px_100px_-34px_rgba(0,0,0,0.98),0_0_0_1px_rgba(196,181,253,0.2),0_0_0_7px_rgba(139,92,246,0.08),0_0_48px_rgba(109,40,217,0.18)]"
            : "border-[#2b3142]/90 hover:border-slate-300/35"
        }`}
        style={{ width: nodeWidth, minHeight: 290 }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[18px] bg-gradient-to-r from-transparent via-slate-100/25 to-transparent" />
        <div className="pointer-events-none absolute inset-0 rounded-[18px] bg-[radial-gradient(circle_at_28%_0%,rgba(129,140,248,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_34%)]" />
        {isRunning && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
            <div className="absolute inset-0 -translate-x-full animate-[text-node-shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-cyan-200/12 to-transparent" />
          </div>
        )}
        {portHandles}
        <div className="absolute -top-8 left-0 z-30 flex items-center gap-1.5 text-slate-300/82 drop-shadow-[0_1px_10px_rgba(15,23,42,0.9)]">
          <Film className="h-4 w-4 text-cyan-100/58" />
          <span className="text-[15px] font-medium tracking-tight">
            {nodeBadgeMatch ? (
              <>
                <span>{nodeBadgeMatch[1]}</span>
                <span className="text-emerald-200/72">{nodeBadgeMatch[2]}</span>
              </>
            ) : (
              nodeBadgeTitle
            )}
          </span>
        </div>
        <div className="relative px-5 pb-5 pt-8">
          {isRunning ? (
            <div className="flex min-h-[250px] flex-col items-center justify-center gap-5 text-slate-300/60">
              <Loader2 className="h-10 w-10 animate-spin" />
              <div className="text-center">
                <div className="text-[13px] text-slate-100/80">正在生成视频</div>
                <div className="mt-2 text-[11px] text-slate-400/60">MiniMax 正在构建动态画面</div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[250px] flex-col items-center justify-center">
              <div className="mb-8 flex h-[96px] w-[96px] items-center justify-center rounded-[28px] bg-slate-950/[0.12] text-cyan-50/[0.2] shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_22px_55px_-40px_rgba(129,140,248,0.55)] backdrop-blur-sm">
                <Play className="ml-1.5 h-14 w-14" strokeWidth={1.55} />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {(isHovered || selected) && !videoUrl && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            data-node-action="true"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(e);
            }}
            className="relative node-card left-1/2 mt-5 w-[620px] -translate-x-1/2 rounded-[18px] border border-[#2b3142]/90 bg-[#121723]/88 px-4 pb-3 pt-3 shadow-[0_28px_70px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-100/22 to-transparent" />
            <textarea
              value={upstreamPrompt ? "" : promptText}
              onChange={(e) => onUpdateProperty?.(node.id, "text", e.target.value)}
              disabled={!!upstreamPrompt}
              placeholder={upstreamPrompt ? `已由上游节点 (${upstreamPrompt.key}) 提供提示词` : "描述你想要生成的视频内容"}
              className="h-[92px] w-full resize-none bg-transparent px-1 text-[15px] leading-7 text-slate-100/88 outline-none placeholder:text-slate-400/42 disabled:cursor-not-allowed disabled:text-slate-400/45 custom-scrollbar"
            />
            <div className="mt-3 flex items-center gap-2 border-t border-cyan-100/8 pt-3">
              <div className="flex h-10 min-w-[172px] items-center gap-2 rounded-[14px] border border-cyan-100/8 bg-slate-950/18 px-3 text-[13px] font-medium text-cyan-50/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                <Film className="h-3.5 w-3.5 text-cyan-100/50" />
                <span>{MINIMAX_VIDEO_MODEL}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateProperty?.(node.id, "aspect_ratio", cycleValue(RATIO_OPTIONS, aspectRatio));
                }}
                className="inline-flex h-10 min-w-[108px] items-center justify-center gap-2 rounded-[14px] border border-cyan-100/8 bg-slate-950/18 px-3 text-[13px] font-medium text-cyan-50/76 transition-colors hover:border-cyan-100/18 hover:bg-cyan-100/[0.045]"
              >
                <span>{aspectRatio}</span>
                <ChevronUp className="h-3.5 w-3.5 rotate-180 text-slate-300/55" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateProperty?.(node.id, "duration", cycleValue(DURATION_OPTIONS, duration));
                }}
                className="inline-flex h-10 min-w-[80px] items-center justify-center rounded-[14px] border border-cyan-100/8 bg-slate-950/18 px-3 text-[13px] font-medium text-cyan-50/68 transition-colors hover:border-cyan-100/18 hover:bg-cyan-100/[0.045]"
              >
                {duration}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateProperty?.(node.id, "resolution", cycleValue(RESOLUTION_OPTIONS, resolution));
                }}
                className="inline-flex h-10 min-w-[88px] items-center justify-center rounded-[14px] border border-cyan-100/8 bg-slate-950/18 px-3 text-[13px] font-medium text-cyan-50/68 transition-colors hover:border-cyan-100/18 hover:bg-cyan-100/[0.045]"
              >
                {resolution}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateProperty?.(node.id, "audio", !audioEnabled);
                }}
                className="inline-flex h-10 min-w-[74px] items-center justify-center rounded-[14px] border border-cyan-100/8 bg-slate-950/18 px-3 text-[13px] font-medium text-cyan-50/68 transition-colors hover:border-cyan-100/18 hover:bg-cyan-100/[0.045]"
              >
                {audioEnabled ? "音频开" : "音频关"}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRun();
                }}
                disabled={isRunning || (!upstreamPrompt && !promptText.trim())}
                className={`ml-auto flex h-10 w-10 items-center justify-center rounded-[14px] transition-all ${
                  isRunning || (!upstreamPrompt && !promptText.trim())
                    ? "cursor-not-allowed border border-cyan-100/6 bg-slate-200/8 text-slate-200/28"
                    : "bg-cyan-50 text-[#0f172a] shadow-[0_14px_30px_-18px_rgba(103,232,249,0.9)] hover:bg-white"
                }`}
              >
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const VideoNodeCard = React.memo(VideoNodeCardImpl, (prev, next) => prev.node === next.node && prev.selected === next.selected);

export default VideoNodeCard;
