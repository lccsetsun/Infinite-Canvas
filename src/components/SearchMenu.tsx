import React, { useEffect, useRef } from "react";
import { FileText, Sparkles, Video, ChevronRight, Image as ImageIcon, Film, Music2, Loader2 } from "lucide-react";
import { NodeClass } from "../types";
import { motion } from "motion/react";
import { uploadFileToOss } from "../features/resource/ossApi";

interface SearchMenuProps {
  x: number;
  y: number;
  isContextMenu?: boolean;
  onAddNode: (type: NodeClass, x: number, y: number, initialProps?: Record<string, any>) => void;
  onClose: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  onNotice?: (message: string) => void;
}

type SearchMenuAction = NodeClass | "upload_image" | "upload_video";

const MenuItem = ({
  onClick,
  icon: Icon,
  label,
  description,
  colorClass,
  disabled = false,
  loading = false,
}: {
  onClick: () => void;
  icon: any;
  label: string;
  description: string;
  colorClass: string;
  disabled?: boolean;
  loading?: boolean;
}) => (
  <motion.button
    whileHover={disabled ? undefined : { x: 4, backgroundColor: "rgba(255, 255, 255, 0.03)" }}
    whileTap={disabled ? undefined : { scale: 0.98 }}
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex w-full items-center rounded-xl border border-transparent p-2 text-left transition-all group hover:border-white/5 disabled:cursor-not-allowed disabled:opacity-60"
  >
    <div className={`rounded-lg bg-white/5 p-2 ${colorClass} transition-transform group-hover:scale-110`}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
    </div>
    <div className="ml-3 flex-1">
      <div className="text-[13px] font-bold text-gray-200 transition-colors group-hover:text-white">{label}</div>
      <div className="text-[10px] text-gray-500 transition-colors group-hover:text-gray-400">{description}</div>
    </div>
    <ChevronRight className="h-3.5 w-3.5 -translate-x-2 text-gray-600 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
  </motion.button>
);

export default function SearchMenu({
  x,
  y,
  isContextMenu,
  onAddNode,
  onClose,
  onHoverStart,
  onHoverEnd,
  onNotice,
}: SearchMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingType, setUploadingType] = React.useState<"upload_image" | "upload_video" | null>(null);

  useEffect(() => {
    const handlePointerDownOutside = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointerDownOutside);
    return () => document.removeEventListener("pointerdown", handlePointerDownOutside);
  }, [onClose]);

  const handleSelect = (type: SearchMenuAction) => {
    if (uploadingType) return;
    if (type === "upload_image") {
      imageInputRef.current?.click();
      return;
    }
    if (type === "upload_video") {
      videoInputRef.current?.click();
      return;
    }
    onAddNode(type, x, y);
    onClose();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, type: "upload_image" | "upload_video") => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const isImage = type === "upload_image";
    const nodeType: NodeClass = isImage ? "image_node" : "video_node";
    const propKey = isImage ? "imageUrl" : "videoUrl";
    setUploadingType(type);

    try {
      const asset = await uploadFileToOss(file);
      onAddNode(nodeType, x, y, {
        [propKey]: asset.url,
        __uploadedAssetUrl: asset.url,
        __uploadedAssetKind: isImage ? "image" : "video",
        __uploadedAssetName: file.name,
      });
      onNotice?.(`${isImage ? "图片" : "视频"}已上传到 OSS`);
      onClose();
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : "文件上传失败");
    } finally {
      setUploadingType(null);
    }
  };

  const style: React.CSSProperties = isContextMenu ? { left: x, top: y } : { left: 96, top: 24 };

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="pointer-events-auto absolute z-[110] select-none"
      style={style}
      onMouseEnter={onHoverStart}
      onMouseLeave={isContextMenu ? undefined : onHoverEnd}
    >
      <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(event) => void handleFileChange(event, "upload_image")} />
      <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={(event) => void handleFileChange(event, "upload_video")} />

      <div
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        className={`${isContextMenu ? "" : "ml-[12px]"} flex w-[280px] flex-col gap-4 rounded-[24px] border border-white/10 bg-[#0d1117]/90 p-5 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-2xl`}
      >
        <div className="space-y-4">
          <section>
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="font-sans text-[10px] font-black uppercase tracking-[0.15em] text-indigo-400">基础节点</span>
              <div className="ml-4 h-px flex-1 bg-gradient-to-r from-indigo-500/30 to-transparent" />
            </div>
            <div className="flex flex-col gap-0.5">
              <MenuItem onClick={() => handleSelect("text_node")} icon={FileText} label="文本处理" description="输入提示词并获取 AI 响应" colorClass="text-amber-400 group-hover:text-amber-300" disabled={Boolean(uploadingType)} />
              <MenuItem onClick={() => handleSelect("image_node")} icon={Sparkles} label="图像生成" description="通过文本生成高质量图像" colorClass="text-indigo-400 group-hover:text-indigo-300" disabled={Boolean(uploadingType)} />
              <MenuItem onClick={() => handleSelect("video_node")} icon={Video} label="视频创作" description="生成动态视频内容" colorClass="text-rose-400 group-hover:text-rose-300" disabled={Boolean(uploadingType)} />
              <MenuItem onClick={() => handleSelect("audio_node")} icon={Music2} label="音频生成" description="生成语音、音乐或音效" colorClass="text-amber-400 group-hover:text-amber-300" disabled={Boolean(uploadingType)} />
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="font-sans text-[10px] font-black uppercase tracking-[0.15em] text-emerald-400">本地资源</span>
              <div className="ml-4 h-px flex-1 bg-gradient-to-r from-emerald-500/30 to-transparent" />
            </div>
            <div className="flex flex-col gap-0.5">
              <MenuItem
                onClick={() => handleSelect("upload_image")}
                icon={ImageIcon}
                label={uploadingType === "upload_image" ? "正在上传图片" : "上传图片"}
                description={uploadingType === "upload_image" ? "正在发送到 OSS..." : "从本地导入图片素材"}
                colorClass="text-cyan-400 group-hover:text-cyan-300"
                disabled={Boolean(uploadingType)}
                loading={uploadingType === "upload_image"}
              />
              <MenuItem
                onClick={() => handleSelect("upload_video")}
                icon={Film}
                label={uploadingType === "upload_video" ? "正在上传视频" : "上传视频"}
                description={uploadingType === "upload_video" ? "正在发送到 OSS..." : "从本地导入视频素材"}
                colorClass="text-teal-400 group-hover:text-teal-300"
                disabled={Boolean(uploadingType)}
                loading={uploadingType === "upload_video"}
              />
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
