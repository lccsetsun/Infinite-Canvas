import { ChevronDown, ChevronLeft, ChevronRight, Download, Grid3X3, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { downloadMediaAsset, extensionFromAssetUrl, isPreviewableAsset } from "../../utils/mediaAssets";

export interface PreviewContent {
  content: string;
  title: string;
  nodeId?: string;
  items?: string[];
  currentIndex?: number;
}

interface PreviewModalProps {
  preview: PreviewContent;
  onClose: () => void;
  onPreviewChange: (preview: PreviewContent) => void;
  onUpdateNodeText: (nodeId: string, text: string) => void;
  onSplitImageGrid?: (nodeId: string, imageUrl: string, gridSize: number, cellIndex: number) => void;
  showNotice: (message: string) => void;
}

const PROMPT_EDITOR_TITLE = "提示词编辑";
const GRID_SPLIT_OPTIONS = [
  { label: "4宫格 (2x2)", size: 2 },
  { label: "9宫格 (3x3)", size: 3 },
  { label: "16宫格 (4x4)", size: 4 },
  { label: "25宫格 (5x5)", size: 5 },
];

function isVideoPreview(preview: PreviewContent): boolean {
  return (
    preview.title.includes("视频") ||
    /\.(mp4|webm|ogg|mov)(?=($|[?#]))/i.test(preview.content) ||
    preview.content.includes("mixkit")
  );
}

function renderMarkdown(text: string) {
  return text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="text-white font-bold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}

export default function PreviewModal({ preview, onClose, onPreviewChange, onUpdateNodeText, onSplitImageGrid, showNotice }: PreviewModalProps) {
  const isMediaAsset = isPreviewableAsset(preview.content);
  const isPromptEditor = preview.title === PROMPT_EDITOR_TITLE;
  const [gridMenuOpen, setGridMenuOpen] = useState(false);
  const [customGridOpen, setCustomGridOpen] = useState(false);
  const [activeGridSize, setActiveGridSize] = useState<number | null>(null);

  const showPrevious = () => {
    if (!preview.items?.length) return;
    const currentIndex = preview.currentIndex ?? 0;
    const nextIndex = (currentIndex - 1 + preview.items.length) % preview.items.length;
    onPreviewChange({
      ...preview,
      content: preview.items[nextIndex],
      currentIndex: nextIndex,
      title: preview.title.includes("#") ? preview.title.replace(/#\d+/, `#${nextIndex + 1}`) : preview.title,
    });
  };

  const showNext = () => {
    if (!preview.items?.length) return;
    const currentIndex = preview.currentIndex ?? 0;
    const nextIndex = (currentIndex + 1) % preview.items.length;
    onPreviewChange({
      ...preview,
      content: preview.items[nextIndex],
      currentIndex: nextIndex,
      title: preview.title.includes("#") ? preview.title.replace(/#\d+/, `#${nextIndex + 1}`) : preview.title,
    });
  };

  const downloadAsset = () => {
    try {
      const extension = extensionFromAssetUrl(preview.content, isVideoPreview(preview) ? "mp4" : "png");
      const filename = `ai-studio-${Date.now()}.${extension}`;
      void downloadMediaAsset(preview.content, filename);
      showNotice("下载已开始");
    } catch {
      showNotice("下载失败，请稍后重试");
    }
  };

  const splitGridCell = (gridSize: number, cellIndex: number) => {
    if (!preview.nodeId || !onSplitImageGrid) {
      showNotice("当前预览没有来源节点，无法生成子节点");
      return;
    }
    onSplitImageGrid(preview.nodeId, preview.content, gridSize, cellIndex);
    setGridMenuOpen(false);
    setCustomGridOpen(false);
    setActiveGridSize(null);
  };

  const renderGridOverlay = () => {
    if (!activeGridSize || isVideoPreview(preview) || !preview.nodeId || !onSplitImageGrid) return null;
    return (
      <div
        className="absolute inset-0 grid overflow-hidden rounded-[10px]"
        style={{
          gridTemplateColumns: `repeat(${activeGridSize}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${activeGridSize}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: activeGridSize * activeGridSize }, (_, index) => (
          <button
            key={index}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              splitGridCell(activeGridSize, index);
            }}
            className="min-h-0 min-w-0 border border-white/70 bg-white/0 transition-colors hover:bg-cyan-300/24 focus-visible:bg-cyan-300/24 focus-visible:outline-none"
            title={`切分第 ${index + 1} 格`}
          />
        ))}
      </div>
    );
  };

  if (isMediaAsset && !isPromptEditor) {
    const isVideo = isVideoPreview(preview);
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/94 p-8"
          onClick={onClose}
        >
          {!isVideo && preview.nodeId && onSplitImageGrid && (
            <div className="absolute left-6 top-6 z-30" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setGridMenuOpen((v) => !v)}
                className="flex h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold text-white/88 backdrop-blur-md transition-colors hover:bg-white/16"
              >
                <Grid3X3 className="h-5 w-5" />
                宫格切分
                <ChevronDown className="h-4 w-4" />
              </button>
              {gridMenuOpen && (
                <div className="absolute left-0 top-12 w-56 rounded-2xl border border-white/10 bg-[#2f2f2f]/96 p-2 text-white shadow-2xl backdrop-blur-xl">
                  {GRID_SPLIT_OPTIONS.map((option) => (
                    <button
                      key={option.size}
                      type="button"
                      onClick={() => {
                        setActiveGridSize(option.size);
                        setCustomGridOpen(false);
                      }}
                      className="block w-full rounded-xl px-3 py-3 text-left text-[15px] font-bold transition-colors hover:bg-white/10"
                    >
                      {option.label}
                    </button>
                  ))}
                  <div className="my-2 h-px bg-white/14" />
                  <div
                    className="relative"
                    onMouseEnter={() => setCustomGridOpen(true)}
                    onMouseLeave={() => setCustomGridOpen(false)}
                  >
                    <button
                      type="button"
                      onClick={() => setCustomGridOpen((v) => !v)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-[15px] font-bold transition-colors hover:bg-white/10"
                    >
                      自定义
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    {customGridOpen && (
                      <div className="absolute left-full top-0 ml-3 w-72 rounded-2xl border border-white/10 bg-[#343434]/96 p-5 shadow-2xl backdrop-blur-xl">
                        <div className="mb-4 text-sm font-bold text-white/56">自定义宫格</div>
                        <div className="grid grid-cols-5 gap-2">
                          {Array.from({ length: 25 }, (_, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => splitGridCell(5, index)}
                              className="aspect-square rounded-md bg-white/13 transition-colors hover:bg-cyan-300/35 focus-visible:bg-cyan-300/35 focus-visible:outline-none"
                              title={`切分第 ${index + 1} 格`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="absolute right-6 top-6 z-20 flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadAsset();
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/8 text-white/72 backdrop-blur-md transition-colors hover:bg-white/14 hover:text-white"
              title="下载"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/8 text-white/72 backdrop-blur-md transition-colors hover:bg-white/14 hover:text-white"
              title="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {preview.items && preview.items.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showPrevious();
                }}
                className="absolute left-6 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/8 text-white/70 backdrop-blur-md transition-colors hover:bg-white/14 hover:text-white"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showNext();
                }}
                className="absolute right-6 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/8 text-white/70 backdrop-blur-md transition-colors hover:bg-white/14 hover:text-white"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}

          <motion.div
            key={preview.content}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex h-full w-full items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {isVideo ? (
              <video src={preview.content} controls autoPlay className="max-h-full max-w-full rounded-[10px] object-contain" />
            ) : (
              <div className="relative max-h-full max-w-full">
                <img src={preview.content} alt="Preview" className="block max-h-[calc(100vh-4rem)] max-w-full rounded-[10px] object-contain" />
                {renderGridOverlay()}
              </div>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#000000]/60 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-3xl max-h-[80vh] bg-[#121723] border border-[#2b3142] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-14 px-6 border-b border-[#252c3a] flex items-center justify-between shrink-0 bg-[#161b29]">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              <span className="font-bold text-gray-100">{preview.title} - 完整内容</span>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
            {isMediaAsset ? (
              <div className="flex items-center justify-center min-h-[300px] relative group/viewer">
                {preview.items && preview.items.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showPrevious();
                      }}
                      className="absolute left-0 z-20 p-3 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 backdrop-blur-md transition-all opacity-0 group-hover/viewer:opacity-100 -translate-x-4 group-hover/viewer:translate-x-0"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showNext();
                      }}
                      className="absolute right-0 z-20 p-3 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 backdrop-blur-md transition-all opacity-0 group-hover/viewer:opacity-100 translate-x-4 group-hover/viewer:translate-x-0"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}

                <AnimatePresence mode="wait">
                  <motion.div
                    key={preview.content}
                    initial={{ opacity: 0, scale: 0.95, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: -20 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="w-full flex justify-center"
                  >
                    {isVideoPreview(preview) ? (
                      <video src={preview.content} controls autoPlay className="max-w-full max-h-[60vh] rounded-xl shadow-2xl border border-white/10" />
                    ) : (
                      <img src={preview.content} alt="Preview" className="max-w-full max-h-[60vh] rounded-xl shadow-2xl border border-white/10 object-contain" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            ) : isPromptEditor ? (
              <textarea
                value={preview.content}
                onChange={(e) => onPreviewChange({ ...preview, content: e.target.value })}
                placeholder="请输入提示词内容..."
                className="w-full h-[400px] bg-[#0d1117] border border-indigo-500/30 rounded-xl p-6 text-[15px] text-gray-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none leading-relaxed placeholder:text-gray-700 custom-scrollbar"
                autoFocus
              />
            ) : (
              <div className="text-[15px] text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">{renderMarkdown(preview.content)}</div>
            )}
          </div>

          <div className="h-14 px-6 border-t border-[#252c3a] flex items-center justify-end gap-3 shrink-0 bg-[#161b29]/50">
            {isPromptEditor && preview.nodeId && (
              <button
                onClick={() => {
                  onUpdateNodeText(preview.nodeId!, preview.content);
                  showNotice("提示词已保存");
                  onClose();
                }}
                className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                保存修改
              </button>
            )}

            {isMediaAsset && (
              <button onClick={downloadAsset} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-bold transition-all flex items-center gap-2">
                <Download className="w-4 h-4" />
                下载文件
              </button>
            )}

            <button
              onClick={() => {
                navigator.clipboard.writeText(preview.content);
                showNotice("内容已复制到剪贴板");
              }}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                isPromptEditor ? "bg-white/5 hover:bg-white/10 text-gray-300" : "bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20"
              }`}
            >
              {isMediaAsset ? "复制链接" : "复制全文"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
