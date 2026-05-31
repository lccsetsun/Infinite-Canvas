import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

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
  showNotice: (message: string) => void;
}

const PROMPT_EDITOR_TITLE = "提示词编辑";

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

export default function PreviewModal({ preview, onClose, onPreviewChange, onUpdateNodeText, showNotice }: PreviewModalProps) {
  const isRemoteAsset = preview.content.startsWith("http");
  const isPromptEditor = preview.title === PROMPT_EDITOR_TITLE;

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

  const downloadAsset = async () => {
    try {
      const response = await fetch(preview.content);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-studio-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showNotice("下载已开始");
    } catch {
      window.open(preview.content, "_blank");
      showNotice("正在新窗口打开下载");
    }
  };

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
            {isRemoteAsset ? (
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
                    {preview.content.match(/\.(mp4|webm|ogg)$/i) || preview.content.includes("mixkit") ? (
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

            {isRemoteAsset && (
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
              {isRemoteAsset ? "复制链接" : "复制全文"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
