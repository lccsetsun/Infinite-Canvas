import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Trash2, 
  Plus, 
  RotateCcw, 
  HelpCircle, 
  FileCode, 
  Terminal as TermIcon, 
  ExternalLink,
  Layers,
  Sparkles,
  Info,
  Maximize2,
  Copy,
  FolderOpen,
  UserCheck,
  Flame,
  CheckCircle,
  AlertTriangle,
  UploadCloud,
  ChevronDown,
  Code,
  Sliders,
  PlaySquare,
  HelpCircle as HelpIcon,
  Download,
  Database,
  Video,
  X,
  FileText,
  Music,
  Globe,
  Upload,
  List,
  Image as ImageIcon,
  Grid,
  Tv,
  Eye
} from "lucide-react";
import { GraphNode, GraphLink, NodeClass, ExecutionLog, DataType } from "./types";
import { WORKFLOW_PRESETS, GET_PRESET_IMAGES, GET_PRESET_VIDEOS } from "./presets";
import CanvasGrid from "./components/CanvasGrid";
import SearchMenu from "./components/SearchMenu";
import TemplateCenter from "./components/TemplateCenter";

// Ports Datatype Color Scheme matching ComfyUI Vibe
export const DOT_COLORS: Record<DataType, string> = {
  STRING: "#a3e635", // Lime Green
  NUMBER: "#38bdf8", // Sky Blue
  IMAGE: "#c084fc",  // Orchid Purple
  VIDEO: "#f43f5e",  // Rose Pink for High-End Video
  MODEL: "#fb923c",  // Tiger Orange
  ANY: "#9ca3af",    // Slate Gray
};

export default function App() {
  // Main canvas states
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  
  // Canvas viewport translation & zoom
  const [pan, setPan] = useState({ x: 60, y: 100 });
  const [zoom, setZoom] = useState(0.9);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Quick searching menu
  const [showSearch, setShowSearch] = useState(false);
  const [searchPos, setSearchPos] = useState({ x: 0, y: 0 });

  // Server API states
  const [apiKeyAvailable, setApiKeyAvailable] = useState<boolean | null>(null);

  // Workflow running states
  const [isRunning, setIsRunning] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([
    {
      id: "log_initial",
      timestamp: new Date().toLocaleTimeString(),
      type: "info",
      message: "初始化：已经准备好构建您的潜空间工作流图纸。"
    }
  ]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);
  const [activePresetId, setActivePresetId] = useState("txt2img");
  const [activeSettingsId, setActiveSettingsId] = useState<string | null>(null);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showPiP, setShowPiP] = useState(true);
  const [pipSourceNodeId, setPipSourceNodeId] = useState<string>("auto");

  // Bezier Wiring visual states
  const [draggingLink, setDraggingLink] = useState<{
    fromNodeId: string;
    fromOutputIndex: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    type: DataType;
  } | null>(null);

  // Dragging individual node state
  const [draggingNode, setDraggingNode] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // DOM Refs
  const workspaceRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Check API Key on boot
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        setApiKeyAvailable(data.hasApiKey);
        if (!data.hasApiKey) {
          addLog("warning", "检测到服务端尚未配置 GEMINI_API_KEY。文生文等 AI 推理解析将可能受限！您可以点击顶部秘密柜并输入您的密钥。");
        } else {
          addLog("success", "已成功检测到服务端的 GEMINI_API_KEY，智能分析算子功能已全面解锁可用。");
        }
      })
      .catch((err) => {
        console.error("Health check failure:", err);
      });

    // Default Load Text-to-Image pipeline preset
    loadWorkflowPreset("txt2img");
  }, []);

  const loadWorkflowPreset = (id: string) => {
    const preset = WORKFLOW_PRESETS.find(p => p.id === id);
    if (preset) {
      const sanitizedNodes = JSON.parse(JSON.stringify(preset.nodes)).map((n: GraphNode) => {
        if (n.type === "video_viewer") {
          n.outputs = [
            { name: "逐帧分解图", type: "IMAGE" },
            { name: "时序视频流", type: "VIDEO" }
          ];
        }
        return n;
      });
      setNodes(sanitizedNodes);
      setLinks(JSON.parse(JSON.stringify(preset.links)));
      setActivePresetId(id);
      addLog("info", `已成功加载管线预置：${preset.name}`);
    }
  };

  const addLog = (type: "info" | "success" | "warning" | "error", message: string, nodeId?: string, title?: string) => {
    setLogs(prev => [
      ...prev,
      {
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp: new Date().toLocaleTimeString(),
        type,
        message,
        nodeId,
        nodeTitle: title
      }
    ].slice(-100));
  };

  // Canvas interaction actions
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan if clicking on empty background areas, omitting nodes, buttons, inputs or menus
    const target = e.target as HTMLElement;
    if (
      !target.closest(".graph-node") &&
      !target.closest(".search-menu") &&
      !target.closest("button") &&
      !target.closest("input") &&
      !target.closest("select") &&
      !target.closest("textarea")
    ) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    if (draggingNode) {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (rect) {
        const xInCanvas = (e.clientX - rect.left - pan.x) / zoom - draggingNode.offsetX;
        const yInCanvas = (e.clientY - rect.top - pan.y) / zoom - draggingNode.offsetY;
        
        // Snap coordinate grids to 10px increments
        const snap = 10;
        const snappedX = Math.round(xInCanvas / snap) * snap;
        const snappedY = Math.round(yInCanvas / snap) * snap;

        setNodes(prev => prev.map(n => n.id === draggingNode.id ? { ...n, x: snappedX, y: snappedY } : n));
      }
      return;
    }

    if (draggingLink && workspaceRef.current) {
      const rect = workspaceRef.current.getBoundingClientRect();
      setDraggingLink(prev => prev ? {
        ...prev,
        currentX: (e.clientX - rect.left - pan.x) / zoom,
        currentY: (e.clientY - rect.top - pan.y) / zoom
      } : null);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNode(null);
    setDraggingLink(null);
  };

  // 무극 mouse scale zoom controller
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.08;
    let newZoom = zoom;
    if (e.deltaY < 0) {
      newZoom = Math.min(zoom * zoomFactor, 2.0);
    } else {
      newZoom = Math.max(zoom / zoomFactor, 0.4);
    }
    setZoom(parseFloat(newZoom.toFixed(2)));
  };

  // Generate dynamically positioned nodes
  const spawnNode = (type: NodeClass, x: number, y: number) => {
    const id = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    let title = "自定义节点";
    let inputs: { name: string; type: DataType }[] = [];
    let outputs: { name: string; type: DataType }[] = [];
    let properties: Record<string, any> = {};

    switch (type) {
      case "string_input":
        title = "文本单一源 (Text Const)";
        outputs = [{ name: "文本字符串", type: "STRING" }];
        properties = { value: "输入常量文本..." };
        break;
      case "slider_input":
        title = "数值滑块控制器 (Number)";
        outputs = [{ name: "数值", type: "NUMBER" }];
        properties = { value: 10, min: 1, max: 100, step: 1 };
        break;
      case "load_image":
        title = "上传图像/加载源 (Image Frame)";
        outputs = [{ name: "图像", type: "IMAGE" }];
        properties = { imageUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=512&q=80" };
        break;
      case "clip_text":
        title = "CLIP 文本拼写/提示词 (M-Text)";
        outputs = [{ name: "文本字符串", type: "STRING" }];
        properties = { text: "输入大段微调提示词或反向词..." };
        break;
      case "gemini_assistant":
        title = "Gemini AI 推理引擎 (T2T)";
        inputs = [
          { name: "用户提示词", type: "STRING" },
          { name: "上下文参数", type: "NUMBER" }
        ];
        outputs = [{ name: "模型结果", type: "STRING" }];
        properties = { systemInstruction: "回答请尽量精炼并充满科技感" };
        break;
      case "prompt_enhancer":
        title = "Gemini 提示词扩推增强 (Enhancer)";
        inputs = [{ name: "简白词汇", type: "STRING" }];
        outputs = [{ name: "优化后提示词", type: "STRING" }];
        properties = {};
        break;
      case "ksampler":
        title = "核心数学采样器 (KSampler)";
        inputs = [
          { name: "正向提示词", type: "STRING" },
          { name: "负向提示词", type: "STRING" },
          { name: "去噪步数", type: "NUMBER" }
        ];
        outputs = [{ name: "图像结果", type: "IMAGE" }];
        properties = { seed: Math.floor(Math.random() * 100000), steps: 30, cfg: 7.5, sampler: "euler_ancestral" };
        break;
      case "text_to_video":
        title = "AI 视频合成扩散器 (T2V Synthesizer)";
        inputs = [
          { name: "视频提示词", type: "STRING" },
          { name: "视频帧率", type: "NUMBER" },
          { name: "视频时长", type: "NUMBER" }
        ];
        outputs = [{ name: "视频内容流", type: "VIDEO" }];
        properties = { motion_scale: 8.5, fps: 24, duration: 6, interpolation: "rife_flow" };
        break;
      case "math_node":
        title = "复合数学算子 (Math Operator)";
        inputs = [
          { name: "数值 A", type: "NUMBER" },
          { name: "数值 B", type: "NUMBER" }
        ];
        outputs = [{ name: "运算结果", type: "NUMBER" }];
        properties = { op: "+" };
        break;
      case "string_concat":
        title = "文本拼接拼接器 (Join)";
        inputs = [
          { name: "信息 A", type: "STRING" },
          { name: "信息 B", type: "STRING" }
        ];
        outputs = [{ name: "连接文本", type: "STRING" }];
        properties = { separator: " " };
        break;
      case "image_filter":
        title = "图像数字滤镜算子 (Filter)";
        inputs = [{ name: "输入图像", type: "IMAGE" }];
        outputs = [{ name: "输出图像", type: "IMAGE" }];
        properties = { filterType: "grayscale", intensity: 100 };
        break;
      case "vae_decode":
        title = "VAE 图像解码 (Save Image)";
        inputs = [{ name: "核心图像", type: "IMAGE" }];
        break;
      case "video_viewer":
        title = "时序视频预览播放器 (Decoder Player)";
        inputs = [{ name: "视频插帧输入", type: "VIDEO" }];
        outputs = [
          { name: "逐帧分解图", type: "IMAGE" },
          { name: "时序视频流", type: "VIDEO" }
        ];
        break;
    }

    const newNode: GraphNode = {
      id,
      type,
      title,
      x: Math.round(x),
      y: Math.round(y),
      inputs,
      outputs,
      properties,
      data: {}
    };

    setNodes(prev => [...prev, newNode]);
    addLog("success", `已在画布中添加算子: ${title}`);
  };

  // Right-click or double click menu triggers
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (rect) {
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const graphX = (clickX - pan.x) / zoom;
      const graphY = (clickY - pan.y) / zoom;
      setSearchPos({ x: clickX, y: clickY });
      setShowSearch(true);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const elementId = (e.target as HTMLElement).id;
    if (elementId === "canvas-grid" || elementId === "link-svg") {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (rect) {
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        setSearchPos({ x: clickX, y: clickY });
        setShowSearch(true);
      }
    }
  };

  // Socket wires link dragging
  const startDragLink = (e: React.MouseEvent, nodeId: string, index: number, isOutput: boolean, type: DataType) => {
    e.stopPropagation();
    e.preventDefault();
    if (!workspaceRef.current) return;
    
    const rect = workspaceRef.current.getBoundingClientRect();
    const pin = e.currentTarget.getBoundingClientRect();
    const pinX = (pin.left + pin.width / 2 - rect.left - pan.x) / zoom;
    const pinY = (pin.top + pin.height / 2 - rect.top - pan.y) / zoom;

    if (isOutput) {
      setDraggingLink({
        fromNodeId: nodeId,
        fromOutputIndex: index,
        startX: pinX,
        startY: pinY,
        currentX: pinX,
        currentY: pinY,
        type
      });
    } else {
      // Unlink connection targeting this slot
      setLinks(prev => prev.filter(l => !(l.toNodeId === nodeId && l.toInputIndex === index)));
    }
  };

  const completeDragLink = (e: React.MouseEvent, toNodeId: string, toInputIndex: number, type: DataType) => {
    e.stopPropagation();
    if (!draggingLink) return;

    // Check datatype compatibility
    const canConnect = draggingLink.type === "ANY" || type === "ANY" || draggingLink.type === type;
    if (!canConnect) {
      addLog("error", `数据流类型不兼容！无法将 ${draggingLink.type} 类型的输出连至 ${type} 类型的输入。`);
      setDraggingLink(null);
      return;
    }

    if (draggingLink.fromNodeId === toNodeId) {
      setDraggingLink(null);
      return;
    }

    // Overwrite existing wire targeted to the matching input socket index
    const cleanLinks = links.filter(l => !(l.toNodeId === toNodeId && l.toInputIndex === toInputIndex));

    const newLink: GraphLink = {
      id: `link_${Date.now()}`,
      fromNodeId: draggingLink.fromNodeId,
      fromOutputIndex: draggingLink.fromOutputIndex,
      toNodeId,
      toInputIndex
    };

    setLinks([...cleanLinks, newLink]);
    const sourceTitle = nodes.find(n => n.id === draggingLink.fromNodeId)?.title;
    const destTitle = nodes.find(n => n.id === toNodeId)?.title;
    addLog("success", `连接成功：[${sourceTitle}] → [${destTitle}]`);
    setDraggingLink(null);
  };

  // Property edit syncs
  const handlePropertyChange = (nodeId: string, key: string, value: any) => {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        return {
          ...n,
          properties: { ...n.properties, [key]: value }
        };
      }
      return n;
    }));
  };

  // Local device custom reference file loading
  const triggerImageUpload = (nodeId?: string) => {
    if (fileInputRef.current) {
      if (nodeId) {
        fileInputRef.current.dataset.targetNodeId = nodeId;
      } else {
        delete fileInputRef.current.dataset.targetNodeId;
      }
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const nodeId = e.target.dataset.targetNodeId;
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (nodeId) {
          setNodes(prev => prev.map(n => n.id === nodeId ? { 
            ...n, 
            properties: { ...n.properties, imageUrl: dataUrl } 
          } : n));
          addLog("success", `已成功加载外部图像文件并绑定至指定节点。`);
        } else {
          const xOffset = -pan.x / zoom + 150;
          const yOffset = -pan.y / zoom + 150;
          const id = `node_${Date.now()}`;
          const title = "本地图像参考源 (Local Image)";
          const newNode: GraphNode = {
            id,
            type: "load_image",
            title,
            x: Math.round(xOffset),
            y: Math.round(yOffset),
            inputs: [],
            outputs: [{ name: "图像", type: "IMAGE" }],
            properties: { imageUrl: dataUrl },
            data: {}
          };
          setNodes(prev => [...prev, newNode]);
          addLog("success", `外部图像上传成功！已在画布中为您生成可供连接的 🖼️ [${title}] 图片节点。`);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerVideoUpload = (nodeId?: string) => {
    if (videoInputRef.current) {
      if (nodeId) {
        videoInputRef.current.dataset.targetNodeId = nodeId;
      } else {
        delete videoInputRef.current.dataset.targetNodeId;
      }
      videoInputRef.current.value = "";
      videoInputRef.current.click();
    }
  };

  const runFrameAnalysis = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.properties?.videoUrl) {
      addLog("error", "视频节点数据为空，请先上传视频后再尝试逐帧解析运行。");
      return;
    }

    const videoUrl = node.properties.videoUrl;
    addLog("info", "🎞️ 启动极序切帧解析器，正在解析局部像素时序结构...", nodeId, node.title);

    // Initial node loading state in graph
    setNodes(prev => prev.map(n => n.id === nodeId ? {
      ...n,
      data: { ...n.data, loading: true, progress: 0 }
    } : n));

    const frameCount = 16;
    const times: number[] = [];
    const video = document.createElement("video");
    video.src = videoUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;

    // Fast completion cleanups
    let completed = false;
    const cleanup = () => {
      completed = true;
      video.pause();
      video.src = "";
      video.load();
    };

    const timeoutId = setTimeout(() => {
      if (!completed) {
        cleanup();
        setNodes(prev => prev.map(n => n.id === nodeId ? {
          ...n,
          data: { ...n.data, loading: false, progress: 0 }
        } : n));
        addLog("error", "视频解析通道超时或格式未被解码器支持，请重试。", nodeId, node.title);
      }
    }, 12000);

    video.onloadedmetadata = () => {
      const duration = video.duration || 5;
      const interval = duration / (frameCount + 1);
      for (let i = 1; i <= frameCount; i++) {
        times.push(i * interval);
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        clearTimeout(timeoutId);
        return;
      }

      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 360;

      // Draw collage: 4 x 4 frames matrix
      const thumbWidth = 140;
      const thumbHeight = Math.round((videoHeight / videoWidth) * thumbWidth);
      const cols = 4;
      const rows = 4;

      canvas.width = cols * thumbWidth + (cols - 1) * 3;
      canvas.height = rows * thumbHeight + (rows - 1) * 3;

      ctx.fillStyle = "#111115";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let currentIndex = 0;

      const captureNext = () => {
        if (currentIndex >= times.length) {
          // Finish collage export URL
          const storyboardUrl = canvas.toDataURL("image/jpeg", 0.85);
          cleanup();
          clearTimeout(timeoutId);

          setNodes(prev => {
            let nextNodes = prev.map(n => {
              if (n.id === nodeId) {
                return {
                  ...n,
                  properties: { ...n.properties, storyboardUrl },
                  data: { ...n.data, loading: false, progress: 100 }
                };
              }
              return n;
            });

            // Is there any active link from output socket with index 0 ?
            const hasLink = links.some(l => l.fromNodeId === nodeId && l.fromOutputIndex === 0);
            if (!hasLink) {
              const decodeNodeId = `node_${Date.now()}_vae`;
              const targetX = Math.round(node.x + 290);
              const targetY = Math.round(node.y);
              const decodeNode: GraphNode = {
                id: decodeNodeId,
                type: "vae_decode",
                title: "分段1_0-15秒_逐帧图 (Frames Grid)",
                x: targetX,
                y: targetY,
                inputs: [{ name: "核心图像", type: "IMAGE" }],
                outputs: [],
                properties: { imageUrl: storyboardUrl },
                data: {}
              };
              
              nextNodes.push(decodeNode);
              
              const newLinkId = `link_${Date.now()}`;
              const newLink: GraphLink = {
                id: newLinkId,
                fromNodeId: nodeId,
                fromOutputIndex: 0,
                toNodeId: decodeNodeId,
                toInputIndex: 0
              };
              setLinks(prevLinks => [...prevLinks, newLink]);
            } else {
              // Auto update connected image rendering receivers
              const linkedIds = links
                .filter(l => l.fromNodeId === nodeId && l.fromOutputIndex === 0)
                .map(l => l.toNodeId);
              nextNodes = nextNodes.map(n => {
                if (linkedIds.includes(n.id) && n.type === "vae_decode") {
                  return {
                    ...n,
                    properties: { ...n.properties, imageUrl: storyboardUrl }
                  };
                }
                return n;
              });
            }

            return nextNodes;
          });

          addLog("success", `✨ 逐帧切条提取大功告成！已合成精美 4x4 分段时序逐帧图像，其分辨率大小为 ${canvas.width}x${canvas.height}。`, nodeId, node.title);
          return;
        }

        video.currentTime = times[currentIndex];
      };

      video.onseeked = () => {
        const col = currentIndex % cols;
        const row = Math.floor(currentIndex / cols);
        const x = col * (thumbWidth + 3);
        const y = row * (thumbHeight + 3);

        ctx.drawImage(video, x, y, thumbWidth, thumbHeight);

        // Stamp timestamps on each slice
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.fillRect(x + 4, y + 4, 38, 12);
        ctx.font = "bold 8px monospace";
        ctx.fillStyle = "#f59e0b"; // Yellow Amber
        const stamp = times[currentIndex].toFixed(1);
        ctx.fillText(`+${stamp}s`, x + 6, y + 12);

        // progress percent calculator
        const pct = Math.round(((currentIndex + 1) / times.length) * 100);
        setNodes(prev => prev.map(n => n.id === nodeId ? {
          ...n,
          data: { ...n.data, progress: pct }
        } : n));

        currentIndex++;
        captureNext();
      };

      captureNext();
    };

    video.onerror = (e) => {
      cleanup();
      clearTimeout(timeoutId);
      setNodes(prev => prev.map(n => n.id === nodeId ? {
        ...n,
        data: { ...n.data, loading: false }
      } : n));
      addLog("error", "底层视频数据源解码错误，请确认文件路径是否合法有效。", nodeId, node.title);
    };

    video.load();
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const nodeId = e.target.dataset.targetNodeId;
    if (file) {
      const videoUrl = URL.createObjectURL(file);
      if (nodeId) {
        setNodes(prev => prev.map(n => n.id === nodeId ? {
          ...n,
          properties: { ...n.properties, videoUrl }
        } : n));
        addLog("success", `本地视频源：已完美绑定至选定的视频渲染预览节点进行播放中！`);
      } else {
        const xOffset = -pan.x / zoom + 150;
        const yOffset = -pan.y / zoom + 150;
        const id = `node_${Date.now()}`;
        const title = "本地视频预览源 (Local Video)";
        const newNode: GraphNode = {
          id,
          type: "video_viewer",
          title,
          x: Math.round(xOffset),
          y: Math.round(yOffset),
          inputs: [{ name: "视频插帧输入", type: "VIDEO" }],
          outputs: [
            { name: "逐帧分解图", type: "IMAGE" },
            { name: "时序视频流", type: "VIDEO" }
          ],
          properties: { videoUrl },
          data: {}
        };
        setNodes(prev => [...prev, newNode]);
        addLog("success", `外部视频源上传成功！已在画布中为您生成可预览的 🎬 [${title}] 播放算子节点。`);
      }
    }
  };

  // BFS / Topological node pipeline solver
  const executeWorkflow = async () => {
    if (isRunning) return;
    setIsRunning(true);
    addLog("info", "🚀 开启多模态拓扑流水线编译，请稍候...");

    const resolvedValues = new Map<string, any>();
    const nodeLookup = new Map<string, GraphNode>();
    nodes.forEach(n => nodeLookup.set(n.id, { ...n }));

    let pendingNodes = [...nodes];
    const MAX_SOLVES = 50;
    let cycles = 0;

    while (pendingNodes.length > 0 && cycles < MAX_SOLVES) {
      cycles++;

      // Detect executable nodes in this batch
      const executable = pendingNodes.filter(node => {
        const incomingLinks = links.filter(l => l.toNodeId === node.id);
        // All parent sockets must be resolved in prior runs
        return incomingLinks.every(l => resolvedValues.has(`${l.fromNodeId}_${l.fromOutputIndex}`));
      });

      if (executable.length === 0) {
        pendingNodes.forEach(pn => {
          addLog("warning", `算子 "${pn.title}" 缺少必要的输入，处于冻结状态。请检查前端导轨连线是否完整！`);
        });
        break;
      }

      for (const node of executable) {
        setCurrentNodeId(node.id);
        
        // Visual indicator that this component is active
        setNodes(prev => prev.map(n => n.id === node.id ? { 
          ...n, 
          data: { ...n.data, loading: true, error: undefined } 
        } : n));

        addLog("info", `开始运行物理算子: [${node.title}]`, node.id, node.title);

        const compilerParams: Record<string, any> = {};
        
        // Find links targeting this node
        node.inputs.forEach((input, inputIdx) => {
          const l = links.find(link => link.toNodeId === node.id && link.toInputIndex === inputIdx);
          if (l) {
            compilerParams[input.name] = resolvedValues.get(`${l.fromNodeId}_${l.fromOutputIndex}`);
          }
        });

        // Solve current logic block based on node types
        try {
          if (node.type === "string_input") {
            const rawVal = node.properties.value ?? "";
            resolvedValues.set(`${node.id}_0`, rawVal);
          } 
          
          else if (node.type === "slider_input") {
            const rawVal = node.properties.value ?? 10;
            resolvedValues.set(`${node.id}_0`, rawVal);
          }

          else if (node.type === "clip_text") {
            // Get value from connected string inputs if any, otherwise use inner text
            const textIn = compilerParams["文本字符串"] ?? node.properties.text ?? "";
            resolvedValues.set(`${node.id}_0`, textIn);
          }

          else if (node.type === "math_node") {
            const a = parseFloat(compilerParams["数值 A"] ?? node.properties.value ?? 10);
            const b = parseFloat(compilerParams["数值 B"] ?? node.properties.value ?? 5);
            const op = node.properties.op || "+";
            let ans = 0;
            if (op === "+") ans = a + b;
            else if (op === "-") ans = a - b;
            else if (op === "*") ans = a * b;
            else if (op === "/") ans = b !== 0 ? a / b : 0;

            node.properties.value = ans;
            resolvedValues.set(`${node.id}_0`, ans);
            addLog("info", `数模解析成功: ${a} ${op} ${b} = ${ans}`, node.id, node.title);
          }

          else if (node.type === "string_concat") {
            const a = compilerParams["信息 A"] || "";
            const b = compilerParams["信息 B"] || "";
            const separator = node.properties.separator ?? " ";
            const joined = `${a}${separator}${b}`;
            node.properties.text = joined;
            resolvedValues.set(`${node.id}_0`, joined);
          }

          else if (node.type === "prompt_enhancer") {
            const inputPrompt = compilerParams["简白词汇"] || node.properties.text || "赛博朋克猫咪";
            
            // Call server side Gemini api to expand it
            const res = await fetch("/api/gemini/enhance", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: inputPrompt })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const resultVal = data.text || inputPrompt;
            node.properties.text = resultVal;
            resolvedValues.set(`${node.id}_0`, resultVal);
            addLog("success", `AI 智能扩充画圣提示词成功：${resultVal.slice(0, 100)}...`, node.id, node.title);
          }

          else if (node.type === "gemini_assistant") {
            const userPrompt = compilerParams["用户提示词"] || node.properties.text || "写一个笑话";
            const extraParam = compilerParams["上下文参数"] || 10;
            
            const compiledQuery = `提示内容: "${userPrompt}"。参数参考值是: ${extraParam}`;
            
            const res = await fetch("/api/gemini/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: compiledQuery,
                systemInstruction: node.properties.systemInstruction
              })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const resultVal = data.text || "";
            node.properties.text = resultVal;
            resolvedValues.set(`${node.id}_0`, resultVal);
            addLog("success", `Gemini 推理完成。字数: ${resultVal.length}`, node.id, node.title);
          }

          else if (node.type === "ksampler") {
            const steps = compilerParams["去噪步数"] ?? node.properties.steps ?? 30;
            const positive = compilerParams["正向提示词"] || "";
            
            // Simulate sampling iterations
            for (let i = 1; i <= 4; i++) {
              const progress = Math.round((i / 4) * 100);
              setNodes(prev => prev.map(n => n.id === node.id ? { 
                ...n, 
                data: { ...n.data, progress } 
              } : n));
              await new Promise(r => setTimeout(r, 220));
            }

            // Get dynamic image matching
            const generatedUrl = GET_PRESET_IMAGES(positive);
            node.properties.imageUrl = generatedUrl;
            resolvedValues.set(`${node.id}_0`, generatedUrl);
            addLog("success", `图像扩散降噪渲染成功。`, node.id, node.title);
          }

          else if (node.type === "text_to_video") {
            const prompt = compilerParams["视频提示词"] || "";
            const fps = compilerParams["视频帧率"] || node.properties.fps || 24;
            const duration = compilerParams["视频时长"] || node.properties.duration || 6;

            // Chinese logs mimicking frame computation
            addLog("info", `[步骤 1/4] 特征频率提取中. 词频: "${prompt.slice(0,25)}..."`, node.id, node.title);
            
            for (let p = 10; p <= 100; p += 30) {
              setNodes(prev => prev.map(n => n.id === node.id ? { 
                ...n, 
                data: { ...n.data, progress: p } 
              } : n));
              await new Promise(r => setTimeout(r, 200));
            }

            addLog("info", `[步骤 2/4] 计算光流插值算法... (${fps} FPS - ${duration}秒)`, node.id, node.title);
            await new Promise(r => setTimeout(r, 200));
            
            addLog("info", `[步骤 3/4] 启动多模态 VAE 时序对齐解码...`, node.id, node.title);
            await new Promise(r => setTimeout(r, 200));

            const matchedVideo = GET_PRESET_VIDEOS(prompt);
            node.properties.videoUrl = matchedVideo;
            resolvedValues.set(`${node.id}_0`, matchedVideo);
            
            addLog("success", `[步骤 4/4] 视频渲染合成成功！已装载动态视频流。`, node.id, node.title);
          }

          else if (node.type === "load_image") {
            const imgUrl = node.properties.imageUrl;
            resolvedValues.set(`${node.id}_0`, imgUrl);
          }

          else if (node.type === "image_filter") {
            const imgIn = compilerParams["输入图像"] || node.properties.imageUrl;
            node.properties.imageUrl = imgIn;
            resolvedValues.set(`${node.id}_0`, imgIn);
          }

          else if (node.type === "vae_decode") {
            const finalImage = compilerParams["核心图像"] || "";
            node.properties.imageUrl = finalImage;
          }

          else if (node.type === "video_viewer") {
            const finalVideo = compilerParams["视频插帧输入"] || "";
            node.properties.videoUrl = finalVideo;
            // Map the parsed storyboard grid to the output socket link
            resolvedValues.set(`${node.id}_0`, node.properties.storyboardUrl || "");
          }

          // Complete executing current item
          setNodes(prev => prev.map(n => {
            if (n.id === node.id) {
              return {
                ...n,
                properties: { ...node.properties },
                data: { ...n.data, loading: false, progress: undefined }
              };
            }
            return n;
          }));

        } catch (itemErr: any) {
          console.error(itemErr);
          setNodes(prev => prev.map(n => n.id === node.id ? { 
            ...n, 
            data: { ...n.data, loading: false, error: itemErr.message || "解码异常" } 
          } : n));
          addLog("error", `执行节点时抛出异常：${itemErr.message || itemErr}`, node.id, node.title);
        }

        // Mechanical pause for aesthetic value
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      pendingNodes = pendingNodes.filter(pn => {
        // If all outputs of this node are resolved, remove from pending
        if (pn.outputs.length === 0) {
          // If node has no outputs, it is an output preview node. We've run it now, so resolve it.
          return false;
        }
        return !pn.outputs.every((_, idx) => resolvedValues.has(`${pn.id}_${idx}`));
      });
    }

    setIsRunning(false);
    setCurrentNodeId(null);
    addLog("success", "✨ 多模态拓扑流水线运算完毕。");
  };

  const clearCanvas = () => {
    setNodes([]);
    setLinks([]);
    setSelectedNodeId(null);
    addLog("warning", "已成功一键清除画布。双击或右击可快速添加算子！");
  };

  const centerCanvas = () => {
    if (nodes.length === 0) {
      setPan({ x: 60, y: 100 });
      setZoom(0.9);
      addLog("info", "网格已重置至默认中心视角。");
      return;
    }

    // Determine bounding box of all existing nodes
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    nodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });

    // Node dimensions assumptions
    const nodeWidth = 240;
    const nodeHeight = 220; // Some nodes are a bit taller

    // Bounds with node width/height added
    const left = minX;
    const top = minY;
    const w = (maxX - minX) + nodeWidth;
    const h = (maxY - minY) + nodeHeight;

    const rect = workspaceRef.current?.getBoundingClientRect();
    const viewWidth = rect ? rect.width : 1000;
    const viewHeight = rect ? rect.height : 600;

    // Small padding to allow nodes to fill the screen as much as possible
    const padding = 30; 
    const fitZoomX = (viewWidth - padding * 2) / w;
    const fitZoomY = (viewHeight - padding * 2) / h;
    
    // Choose zoom scale so it fully fits in screen and is scaled maximally
    let fitZoom = Math.min(fitZoomX, fitZoomY);
    // Allow zooming in up to 1.1 or zooming out down to 0.3
    fitZoom = Math.max(0.3, Math.min(1.1, fitZoom));

    const boxCenterX = left + w / 2;
    const boxCenterY = top + h / 2;

    const panX = viewWidth / 2 - boxCenterX * fitZoom;
    const panY = viewHeight / 2 - boxCenterY * fitZoom;

    setPan({ x: panX, y: panY });
    setZoom(fitZoom);
    addLog("info", `工作台视图已自适应居中（缩放倍率: ${Math.round(fitZoom * 100)}%）。`);
  };

  const autoLayout = () => {
    if (nodes.length === 0) return;

    // 1. Build adjacency list of connections
    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};

    nodes.forEach(n => {
      inDegree[n.id] = 0;
      adj[n.id] = [];
    });

    links.forEach(link => {
      if (adj[link.source] && !adj[link.source].includes(link.target)) {
        adj[link.source].push(link.target);
      }
      if (inDegree[link.target] !== undefined) {
        inDegree[link.target]++;
      }
    });

    // 2. Assign topological levels
    const levels: Record<string, number> = {};
    const visited = new Set<string>();

    const assignLevel = (nodeId: string, currentLevel: number) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      levels[nodeId] = Math.max(levels[nodeId] || 0, currentLevel);
      
      (adj[nodeId] || []).forEach(childId => {
        assignLevel(childId, currentLevel + 1);
      });
      
      visited.delete(nodeId);
    };

    const roots = nodes.filter(n => inDegree[n.id] === 0);
    if (roots.length === 0 && nodes.length > 0) {
      roots.push(nodes[0]);
    }

    roots.forEach(root => {
      assignLevel(root.id, 0);
    });

    nodes.forEach(n => {
      if (levels[n.id] === undefined) {
        levels[n.id] = 0;
      }
    });

    // 3. Group nodes by levels
    const levelGroups: Record<number, string[]> = {};
    nodes.forEach(node => {
      const lvl = levels[node.id];
      if (!levelGroups[lvl]) {
        levelGroups[lvl] = [];
      }
      levelGroups[lvl].push(node.id);
    });

    // 4. Calculate coordinates for each node
    const horizontalSpacing = 320; 
    const verticalSpacing = 260;   
    const startX = 100;
    const startY = 100;

    const newNodes = nodes.map(node => {
      const lvl = levels[node.id];
      const indexInLvl = levelGroups[lvl].indexOf(node.id);
      
      const x = startX + lvl * horizontalSpacing;
      // Center vertical columns beautifully
      const columnNodesCount = levelGroups[lvl].length;
      const offsetToCenter = (columnNodesCount - 1) * verticalSpacing / 2;
      const y = startY + (indexInLvl * verticalSpacing) - offsetToCenter + 150;
      
      return {
        ...node,
        x: Math.round(x),
        y: Math.max(50, Math.round(y)) 
      };
    });

    setNodes(newNodes);
    addLog("success", "画布所有算子已完成自动化布局对齐。");

    // Recenter after layout
    setTimeout(() => {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      newNodes.forEach((node) => {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
      });

      const nodeWidth = 240;
      const nodeHeight = 220;
      const left = minX;
      const top = minY;
      const w = (maxX - minX) + nodeWidth;
      const h = (maxY - minY) + nodeHeight;

      const rect = workspaceRef.current?.getBoundingClientRect();
      const viewWidth = rect ? rect.width : 1000;
      const viewHeight = rect ? rect.height : 600;

      const padding = 50;
      const fitZoomX = (viewWidth - padding * 2) / w;
      const fitZoomY = (viewHeight - padding * 2) / h;
      let fitZoom = Math.min(fitZoomX, fitZoomY);
      fitZoom = Math.max(0.4, Math.min(0.95, fitZoom));

      const boxCenterX = left + w / 2;
      const boxCenterY = top + h / 2;

      const panX = viewWidth / 2 - boxCenterX * fitZoom;
      const panY = viewHeight / 2 - boxCenterY * fitZoom;

      setPan({ x: panX, y: panY });
      setZoom(fitZoom);
    }, 60);
  };

  // Find position coordinates of targeted socket pins for bezier rendering
  const getPortCoords = (nodeId: string, index: number, isOutput: boolean) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    // Try to locate the exact DOM element of the port and calculate relative offsets inside graph-node
    const socketId = `socket-${nodeId}-${isOutput ? "output" : "input"}-${index}`;
    const el = document.getElementById(socketId);
    if (el) {
      let localX = el.offsetLeft + el.offsetWidth / 2;
      let localY = el.offsetTop + el.offsetHeight / 2;
      let curr = el.offsetParent as HTMLElement | null;

      // Unwind offsetParent locations up to graph-node container
      while (curr && !curr.classList.contains("graph-node")) {
        localX += curr.offsetLeft;
        localY += curr.offsetTop;
        curr = curr.offsetParent as HTMLElement | null;
      }

      return {
        x: node.x + localX,
        y: node.y + localY
      };
    }

    // Fallback robust calculation should the element be absent or loading
    const nodeWidth = node.type === "ai_video_node" || node.type === "ai_image_node" ? 480 : node.type === "ai_text_node" ? 360 : 240;
    const headerHeight = 35;
    const progressHeight = node.data?.progress !== undefined ? 22 : 0;
    const paddingAndGap = 10;

    let propsHeight = 0;
    switch (node.type) {
      case "clip_text":
        propsHeight = 88;
        break;
      case "string_input":
        propsHeight = 32;
        break;
      case "slider_input":
        propsHeight = 38;
        break;
      case "load_image":
        propsHeight = node.properties.imageUrl ? 152 : 62;
        break;
      case "image_filter":
        propsHeight = node.properties.imageUrl ? 162 : 32;
        break;
      case "math_node":
        propsHeight = 32;
        break;
      case "vae_decode":
        propsHeight = node.properties.imageUrl ? 245 : 144;
        break;
      case "text_to_video":
        propsHeight = 50;
        break;
      case "video_viewer":
        propsHeight = node.properties.videoUrl ? 152 : 160;
        break;
      case "gemini_assistant":
        propsHeight = 112;
        break;
      case "ai_text_node":
        propsHeight = 280;
        break;
      case "ai_image_node":
      case "ai_video_node":
        propsHeight = 440;
        break;
      default:
        propsHeight = 40;
    }

    const yOffset = headerHeight + progressHeight + paddingAndGap + propsHeight + 10;
    const x = isOutput ? nodeWidth - 17 : 17;
    const rowIndex = isOutput ? node.inputs.length + index : index;
    const sY = yOffset + rowIndex * 28 + 12;

    return { x: node.x + x, y: node.y + sY };
  };

  // Helper to resolve currently playing or rendered Picture-in-Picture media stream
  const getActivePipMedia = () => {
    if (pipSourceNodeId !== "auto") {
      const targetedNode = nodes.find(n => n.id === pipSourceNodeId);
      if (targetedNode) {
        if (targetedNode.type === "video_viewer" && targetedNode.properties.videoUrl) {
          return { type: "video", url: targetedNode.properties.videoUrl, title: targetedNode.title, nodeId: targetedNode.id };
        }
        if (targetedNode.type === "vae_decode" && targetedNode.properties.imageUrl) {
          return { type: "image", url: targetedNode.properties.imageUrl, title: targetedNode.title, nodeId: targetedNode.id };
        }
        if (targetedNode.type === "load_image" && targetedNode.properties.imageUrl) {
          return { type: "image", url: targetedNode.properties.imageUrl, title: targetedNode.title, nodeId: targetedNode.id };
        }
        if (targetedNode.type === "text_to_video" && targetedNode.properties.videoUrl) {
          return { type: "video", url: targetedNode.properties.videoUrl, title: targetedNode.title, nodeId: targetedNode.id };
        }
      }
    }

    const vaeNode = [...nodes].reverse().find(n => n.type === "vae_decode" && n.properties.imageUrl);
    if (vaeNode) return { type: "image", url: vaeNode.properties.imageUrl, title: vaeNode.title, nodeId: vaeNode.id };

    const videoNode = [...nodes].reverse().find(n => (n.type === "video_viewer" || n.type === "text_to_video") && n.properties.videoUrl);
    if (videoNode) return { type: "video", url: videoNode.properties.videoUrl, title: videoNode.title, nodeId: videoNode.id };

    const imgNode = [...nodes].reverse().find(n => n.type === "load_image" && n.properties.imageUrl);
    if (imgNode) return { type: "image", url: imgNode.properties.imageUrl, title: imgNode.title, nodeId: imgNode.id };

    return null;
  };
  const pipMedia = getActivePipMedia();

  return (
    <div className="flex flex-col h-screen bg-[#141416] text-[#e2e2e9] font-sans antialiased select-none overflow-hidden" id="editor-root-frame">
      
      {/* Hidden local file loader */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*"
        onChange={handleImageFileChange}
        className="hidden" 
      />

      {/* Hidden local video file loader */}
      <input 
        ref={videoInputRef}
        type="file" 
        accept="video/*"
        onChange={handleVideoFileChange}
        className="hidden" 
      />

      {/* ComfyUI Style Professional Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-[#1b1b1f] border-b border-[#2a2a32] relative z-20 shadow-xl select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#23232c] border border-indigo-600 rounded-md shadow-lg">
            <Layers className="w-4 h-4 text-[#8a8afd] animate-pulse" />
            <span className="text-xs font-black tracking-wider text-white uppercase font-mono">
              AI <span className="text-emerald-400">Canvas</span>
            </span>
          </div>
        </div>

        {/* Workspace Operations Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={clearCanvas}
            className="flex items-center gap-1 bg-[#25252b] hover:bg-rose-950/40 text-xs text-gray-300 hover:text-rose-200 px-3 py-1.5 rounded transition-all border border-[#2e2e38] font-bold cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">清除</span>
          </button>

          <button
            onClick={centerCanvas}
            className="flex items-center gap-1 bg-[#25252b] hover:bg-[#32323a] text-xs text-gray-300 hover:text-white px-3 py-1.5 rounded transition-all border border-[#2e2e38] font-bold cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">自适应居中</span>
          </button>

          <button
            onClick={autoLayout}
            className="flex items-center gap-1 bg-[#25252b] hover:bg-[#32323a] text-xs text-gray-300 hover:text-white px-3 py-1.5 rounded transition-all border border-[#2e2e38] font-bold cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="hidden sm:inline">自动布局</span>
          </button>

          <div className="w-[1px] h-6 bg-gray-700 mx-1" />

          {/* Trigger Core Prompt Queue */}
          <button
            disabled={isRunning}
            onClick={executeWorkflow}
            className={`flex items-center gap-2 font-black px-4 py-1.5 rounded-md text-xs tracking-wider transition-all select-none ${
              isRunning 
                ? "bg-[#212124] text-gray-500 cursor-not-allowed border border-[#333]" 
                : "bg-gradient-to-r from-[#3e3edd] to-teal-700 hover:from-[#5050f5] hover:to-teal-600 text-white border border-indigo-500 shadow-[0_0_12px_rgba(62,62,221,0.5)] hover:shadow-[0_0_18px_rgba(62,62,221,0.7)] cursor-pointer"
            }`}
          >
            {isRunning ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-[#8a8afd] animate-spin" />
                <span>编译计算中...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                <span>运行</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Editor Central Zone */}
      <div className="flex-1 flex relative overflow-hidden" id="canvas-frame">
        
        {/* Floating Quick Settings, Vertical Sidebar Pill & Popover Menu matching Screenshot UI */}
        {!isSideMenuOpen ? (
          /* Collapsed Capsule-Pill matching Screenshot 1 */
          <div 
            onClick={() => setIsSideMenuOpen(true)}
            className="absolute left-4 top-4 z-40 w-14 h-14 bg-[#111113]/90 backdrop-blur-md border border-[#25252e] rounded-full flex items-center justify-center cursor-pointer shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300"
            title="点击展开操作控制面板"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black shadow-md">
              <Plus className="w-5 h-5 text-black stroke-[2.5]" />
            </div>
          </div>
        ) : (
          /* Expanded sidebar pill and action panel matching Screenshot 2 */
          <>
            {/* Toggle circular container for X when open */}
            <div 
              onClick={() => setIsSideMenuOpen(false)}
              className="absolute left-4 top-4 z-40 w-14 h-14 bg-[#111113]/90 backdrop-blur-md border border-[#25252e] rounded-full flex items-center justify-center cursor-pointer shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 select-none"
              title="折叠控制面板"
            >
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black shadow-md hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-black stroke-[2.5]" />
              </div>
            </div>

            {/* Quick Action Popover Menu next to vertical pill */}
            <div className="absolute left-[78px] top-4 z-40 flex flex-col gap-3.5 p-4 w-[240px] bg-[#141417]/95 backdrop-blur-md border border-[#25252e] rounded-2xl shadow-3xl select-none">
              
              {/* Section 1: 画布自由生成 */}
              <div>
                <div className="text-[10px] text-gray-500 font-extrabold tracking-wider mb-2.5 uppercase font-sans">
                  画布自由生成
                </div>
                <div className="flex flex-col gap-1">
                  
                  {/* 生成文本 option */}
                  <button
                    onClick={() => {
                      const newId = `node_${Date.now()}`;
                      const rect = workspaceRef.current?.getBoundingClientRect();
                      const viewWidth = rect ? rect.width : 1000;
                      const viewHeight = rect ? rect.height : 600;
                      
                      const createX = (viewWidth / 2 - pan.x) / zoom;
                      const createY = (viewHeight / 2 - pan.y) / zoom;
                      
                      setNodes(prev => [...prev, {
                        id: newId,
                        type: "ai_text_node",
                        title: `文本节点 ${prev.length + 1}`,
                        x: createX,
                        y: createY,
                        inputs: [],
                        outputs: [{ name: "文本结果", type: "STRING" }],
                        properties: { promptText: "" }
                      }]);
                      setIsSideMenuOpen(false);
                      addLog("success", "已添加新的智能文本节点。");
                    }}
                    className="w-full flex items-center px-1.5 py-1.5 rounded-lg hover:bg-[#202026] text-gray-300 hover:text-white transition-all cursor-pointer text-left group"
                  >
                    <div className="p-1.5 rounded-lg bg-[#1f1f23] text-gray-400 group-hover:bg-[#2b2b35] group-hover:text-amber-400 w-8 h-8 flex items-center justify-center shrink-0 mr-3 transition-colors">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-[12px] font-bold">生成文本</span>
                  </button>

                  {/* 生成图像 option */}
                  <button
                    onClick={() => {
                      const newId = `node_${Date.now()}`;
                      const rect = workspaceRef.current?.getBoundingClientRect();
                      const viewWidth = rect ? rect.width : 1000;
                      const viewHeight = rect ? rect.height : 600;
                      
                      const createX = (viewWidth / 2 - pan.x) / zoom;
                      const createY = (viewHeight / 2 - pan.y) / zoom;
                      
                      setNodes(prev => [...prev, {
                        id: newId,
                        type: "ai_image_node",
                        title: `图像节点 ${prev.length + 1}`,
                        x: createX,
                        y: createY,
                        inputs: [],
                        outputs: [{ name: "图像结果", type: "IMAGE" }],
                        properties: { promptText: "" }
                      }]);
                      setIsSideMenuOpen(false);
                      addLog("success", "已添加新的智能图像节点。");
                    }}
                    className="w-full flex items-center px-1.5 py-1.5 rounded-lg hover:bg-[#202026] text-gray-300 hover:text-white transition-all cursor-pointer text-left group"
                  >
                    <div className="p-1.5 rounded-lg bg-[#1f1f23] text-gray-400 group-hover:bg-[#2b2b35] group-hover:text-indigo-400 w-8 h-8 flex items-center justify-center shrink-0 mr-3 transition-colors">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <span className="text-[12px] font-bold">生成图像</span>
                  </button>

                  {/* 生成视频 option */}
                  <button
                    onClick={() => {
                      const newId = `node_${Date.now()}`;
                      const rect = workspaceRef.current?.getBoundingClientRect();
                      const viewWidth = rect ? rect.width : 1000;
                      const viewHeight = rect ? rect.height : 600;
                      
                      const createX = (viewWidth / 2 - pan.x) / zoom;
                      const createY = (viewHeight / 2 - pan.y) / zoom;
                      
                      setNodes(prev => [...prev, {
                        id: newId,
                        type: "ai_video_node",
                        title: `视频节点 ${prev.length + 1}`,
                        x: createX,
                        y: createY,
                        inputs: [],
                        outputs: [{ name: "视频结果", type: "VIDEO" }],
                        properties: { promptText: "" }
                      }]);
                      setIsSideMenuOpen(false);
                      addLog("success", "已添加新的智能视频节点。");
                    }}
                    className="w-full flex items-center px-1.5 py-1.5 rounded-lg hover:bg-[#202026] text-gray-300 hover:text-white transition-all cursor-pointer text-left group"
                  >
                    <div className="p-1.5 rounded-lg bg-[#1f1f23] text-gray-400 group-hover:bg-[#2b2b35] group-hover:text-rose-400 w-8 h-8 flex items-center justify-center shrink-0 mr-3 transition-colors">
                      <Video className="w-4 h-4" />
                    </div>
                    <span className="text-[12px] font-bold">生成视频</span>
                  </button>

                </div>
              </div>

              {/* Divider standard lines */}
              <div className="h-[1px] bg-[#22222a] my-1" />

              {/* Section 2: 添加资源 */}
              <div>
                <div className="text-[10px] text-gray-500 font-extrabold tracking-wider mb-2.5 uppercase font-sans">
                  添加资源
                </div>
                <div className="flex flex-col gap-1">
                  
                  {/* 上传图像 option */}
                  <button
                    onClick={() => triggerImageUpload()}
                    className="w-full flex items-center px-1.5 py-1.5 rounded-lg hover:bg-[#202026] text-gray-300 hover:text-white transition-all cursor-pointer text-left group"
                  >
                    <div className="p-1.5 rounded-lg bg-[#1f1f23] text-gray-400 group-hover:bg-[#2b2b35] group-hover:text-indigo-400 w-8 h-8 flex items-center justify-center shrink-0 mr-3 transition-colors">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <span className="text-[12px] font-bold">上传图像</span>
                  </button>

                  {/* 上传视频 option */}
                  <button
                    onClick={() => triggerVideoUpload()}
                    className="w-full flex items-center px-1.5 py-1.5 rounded-lg hover:bg-[#202026] text-gray-300 hover:text-white transition-all cursor-pointer text-left group"
                  >
                    <div className="p-1.5 rounded-lg bg-[#1f1f23] text-gray-400 group-hover:bg-[#2b2b35] group-hover:text-rose-400 w-8 h-8 flex items-center justify-center shrink-0 mr-3 transition-colors">
                      <Video className="w-4 h-4" />
                    </div>
                    <span className="text-[12px] font-bold">上传视频</span>
                  </button>

                </div>
              </div>

            </div>
          </>
        )}

        {/* Standard core fully integrated templates gallery overlay */}
        {showTemplates && (
          <TemplateCenter 
            activePresetId={activePresetId}
            onSelectPreset={(id) => {
              loadWorkflowPreset(id);
              setPan({ x: 60, y: 100 });
              setZoom(0.9);
            }}
            onClose={() => setShowTemplates(false)}
          />
        )}

        {/* Visual Workflow Canvas Grid with drag over dropped events */}
        <div
          ref={workspaceRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
          onDoubleClick={handleDoubleClick}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const rect = workspaceRef.current?.getBoundingClientRect();
            if (rect) {
              const dropX = (e.clientX - rect.left - pan.x) / zoom;
              const dropY = (e.clientY - rect.top - pan.y) / zoom;
              spawnNode("clip_text", dropX, dropY);
            }
          }}
          className="flex-1 h-full relative overflow-hidden outline-none"
          style={{ cursor: isPanning ? 'grabbing' : draggingNode ? 'grabbing' : 'grab' }}
        >
          {/* Dot Grids dynamic backgrounds */}
          {showGrid && <CanvasGrid pan={pan} zoom={zoom} />}

          {/* SVG Connector Line visualizers */}
          <svg
            id="link-svg"
            className="absolute inset-0 pointer-events-none select-none z-10 w-full h-full"
          >
            {links.map((link) => {
              const start = getPortCoords(link.fromNodeId, link.fromOutputIndex, true);
              const end = getPortCoords(link.toNodeId, link.toInputIndex, false);
              
              const sx = start.x * zoom + pan.x;
              const sy = start.y * zoom + pan.y;
              const ex = end.x * zoom + pan.x;
              const ey = end.y * zoom + pan.y;

              const dx = Math.abs(ex - sx) * 0.45;
              const path = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${ex - dx} ${ey}, ${ex} ${ey}`;
              
              const sourceNode = nodes.find(n => n.id === link.fromNodeId);
              const outType = sourceNode?.outputs[link.fromOutputIndex]?.type || "ANY";
              const color = DOT_COLORS[outType];

              const isLinkActive = isRunning && (currentNodeId === link.fromNodeId || currentNodeId === link.toNodeId);

              return (
                <g key={link.id}>
                  {/* Drop Shadow Outer Lane */}
                  <path
                    d={path}
                    fill="none"
                    stroke="rgba(0,0,0,0.5)"
                    strokeWidth="5"
                  />
                  {/* Primary Color Bezier Curve */}
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeDasharray={isLinkActive ? "6 6" : undefined}
                    className={isLinkActive ? "animate-[dash_12s_linear_infinite]" : ""}
                    style={{ filter: `drop-shadow(0 0 4px ${color}90)` }}
                  />
                </g>
              );
            })}

            {/* Currently Dragged cable wire preview */}
            {draggingLink && (
              <path
                d={`M ${draggingLink.startX * zoom + pan.x} ${draggingLink.startY * zoom + pan.y} C ${
                  (draggingLink.startX + Math.abs(draggingLink.currentX - draggingLink.startX) * 0.45) * zoom + pan.x
                } ${draggingLink.startY * zoom + pan.y}, ${
                  (draggingLink.currentX - Math.abs(draggingLink.currentX - draggingLink.startX) * 0.45) * zoom + pan.x
                } ${draggingLink.currentY * zoom + pan.y}, ${draggingLink.currentX * zoom + pan.x} ${draggingLink.currentY * zoom + pan.y}`}
                fill="none"
                stroke={DOT_COLORS[draggingLink.type]}
                strokeWidth="2.5"
                strokeDasharray="5 5"
              />
            )}
          </svg>

          {/* Scale Panned Grouping Layer */}
          <div
            className="absolute left-0 top-0 w-full h-full pointer-events-none select-none z-10"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {nodes.map((node) => {
              const selected = selectedNodeId === node.id;
              const processing = currentNodeId === node.id;
              
              return (
                <div
                  key={node.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                  className={`graph-node absolute ${node.type === "ai_video_node" || node.type === "ai_image_node" ? "w-[480px]" : node.type === "ai_text_node" ? "w-[360px]" : "w-[240px]"} bg-[#1e1e24]/90 rounded-lg shadow-2xl border flex flex-col pointer-events-auto select-text hover:shadow-indigo-500/10 transition-shadow ${
                    processing 
                      ? "border-amber-400 ring-2 ring-amber-400/30" 
                      : selected 
                        ? "border-[#4e4eee] ring-1 ring-indigo-500/40" 
                        : "border-[#2d2d37]"
                  }`}
                  style={{
                    left: node.x,
                    top: node.y,
                  }}
                >
                  {/* Node Header Label Bar */}
                  <div
                    onMouseDown={(e) => {
                      if ((e.target as HTMLElement).tagName !== "BUTTON") {
                        const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                        if (rect) {
                          setDraggingNode({
                            id: node.id,
                            offsetX: (e.clientX - rect.left) / zoom,
                            offsetY: (e.clientY - rect.top) / zoom
                          });
                          setSelectedNodeId(node.id);
                        }
                      }
                    }}
                    className={`px-3 py-1.5 rounded-t-lg flex items-center justify-between cursor-move select-none ${
                      processing 
                        ? "bg-gradient-to-r from-amber-500 to-amber-700 text-black font-semibold" 
                        : selected 
                          ? "bg-[#2c2c3d] text-white" 
                          : "bg-[#141417]/90 text-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {node.type.includes("gemini") && <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
                      {node.type.includes("video") && <PlaySquare className="w-3.5 h-3.5 text-rose-400" />}
                      {node.type === "ai_text_node" && <FileText className="w-3.5 h-3.5 text-gray-400" />}
                      <span className="text-[11px] font-extrabold tracking-wide truncate">
                        {node.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          const newId = `node_${Date.now()}`;
                          const copyNode = {
                            ...JSON.parse(JSON.stringify(node)),
                            id: newId,
                            x: node.x + 35,
                            y: node.y + 35
                          };
                          setNodes(prev => [...prev, copyNode]);
                          addLog("success", `已复制算子：${node.title}`);
                        }}
                        title="复制算子"
                        className="p-1 hover:bg-[#ffffff15] text-gray-400 hover:text-white rounded transition-colors cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          setNodes(prev => prev.filter(n => n.id !== node.id));
                          setLinks(prev => prev.filter(l => l.fromNodeId !== node.id && l.toNodeId !== node.id));
                          addLog("warning", `已丢弃算子: ${node.title}`);
                          if (selectedNodeId === node.id) setSelectedNodeId(null);
                        }}
                        className="p-1 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
                        title="删除此算子"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Progressive Micro Loader */}
                  {node.data?.loading && (
                    <div className="h-0.5 bg-[#141417] relative overflow-hidden">
                      <div className="absolute inset-y-0 bg-indigo-500 animate-pulse w-full" />
                    </div>
                  )}

                  {node.data?.progress !== undefined && (
                    <div className="bg-[#121215] px-2.5 py-0.5 text-[8.5px] font-mono flex items-center justify-between border-b border-[#222]">
                      <span className="text-amber-400 animate-pulse font-bold">FLOW 逆向扩散合成...</span>
                      <span className="text-emerald-400 font-bold">{Math.round(node.data.progress)}%</span>
                    </div>
                  )}

                  {/* Inner specific properties controls */}
                  <div className="p-2.5 flex flex-col gap-2 bg-[#1b1b20]/65">
                    
                    {/* Prompt editable context */}
                    {node.type === "clip_text" && (
                      <textarea
                        value={node.properties.text || ""}
                        onChange={(e) => handlePropertyChange(node.id, "text", e.target.value)}
                        placeholder="输入词句描述..."
                        className="w-full h-20 text-[10px] bg-[#121215] text-[#d1d1db] rounded p-2.5 outline-none border border-[#2b2b3a] focus:border-indigo-500 resize-none font-sans leading-relaxed transition-all"
                      />
                    )}

                    {/* Simple dynamic values Const Input Text */}
                    {node.type === "string_input" && (
                      <input
                        type="text"
                        value={node.properties.value || ""}
                        onChange={(e) => handlePropertyChange(node.id, "value", e.target.value)}
                        className="w-full text-[10px] bg-[#121215] text-gray-200 rounded px-2 py-1.5 outline-none border border-[#23232c] focus:border-indigo-500 font-mono"
                      />
                    )}

                    {/* Numeric controlling sliders */}
                    {node.type === "slider_input" && (
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[9px] text-gray-400">
                          <span>物理常数量:</span>
                          <span className="font-mono text-emerald-400 font-bold">{node.properties.value}</span>
                        </div>
                        <input
                          type="range"
                          min={node.properties.min || 1}
                          max={node.properties.max || 100}
                          step={node.properties.step || 1}
                          value={node.properties.value || 1}
                          onChange={(e) => handlePropertyChange(node.id, "value", parseFloat(e.target.value))}
                          className="w-full accent-indigo-500 cursor-pointer"
                        />
                      </div>
                    )}

                    {/* Load local files directly */}
                    {node.type === "load_image" && (
                      <div className="flex flex-col gap-1.5">
                        {node.properties.imageUrl ? (
                          <div className="relative group rounded overflow-hidden border border-[#2a2a32] bg-[#121215] aspect-video">
                            <img
                              src={node.properties.imageUrl}
                              alt="Source preview"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                              <button
                                onClick={() => triggerImageUpload(node.id)}
                                className="px-2 py-1 text-[9px] bg-indigo-600 hover:bg-indigo-500 rounded text-white flex items-center gap-1 cursor-pointer transition-all font-bold"
                              >
                                <UploadCloud className="w-3.5 h-3.5" /> 上传本机图片
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => triggerImageUpload(node.id)}
                            className="w-full py-5 border border-dashed border-[#3a3a4c] hover:border-indigo-500 rounded bg-[#121215] flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <UploadCloud className="w-5 h-5 text-gray-500 animate-bounce" />
                            <span className="text-[9px] text-gray-400">点击上传任意参考图片</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Image filter rendering */}
                    {node.type === "image_filter" && (
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-400">选择滤镜算子:</span>
                          <select
                            value={node.properties.filterType || "grayscale"}
                            onChange={(e) => handlePropertyChange(node.id, "filterType", e.target.value)}
                            className="bg-[#121215] text-amber-500 px-1 py-0.5 rounded outline-none border border-[#2b2b35] font-bold cursor-pointer"
                          >
                            <option value="grayscale">经典黑白灰阶</option>
                            <option value="invert">色彩反向负面</option>
                            <option value="sepia">怀旧复古暖黄</option>
                            <option value="blur">高斯模糊运算</option>
                          </select>
                        </div>
                        {node.properties.imageUrl && (
                          <div className="relative mt-1 rounded overflow-hidden border border-[#2a2a32] bg-[#121215] aspect-video">
                            <img
                              src={node.properties.imageUrl}
                              alt="Raster processed filter preview"
                              className="w-full h-full object-cover transition-all"
                              style={{
                                filter: 
                                  node.properties.filterType === "grayscale" ? "grayscale(100%)" :
                                  node.properties.filterType === "invert" ? "invert(100%)" :
                                  node.properties.filterType === "sepia" ? "sepia(100%)" :
                                  node.properties.filterType === "blur" ? "blur(3.5px)" : "none"
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Arithmetic formula Selector */}
                    {node.type === "math_node" && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-400">进行符号计算:</span>
                        <select
                          value={node.properties.op || "+"}
                          onChange={(e) => handlePropertyChange(node.id, "op", e.target.value)}
                          className="bg-[#121215] text-emerald-400 px-1.5 py-0.5 rounded outline-none border border-[#2b2b35] font-mono font-bold cursor-pointer"
                        >
                          <option value="+">加法 (+)</option>
                          <option value="-">减法 (-)</option>
                          <option value="*">乘法 (*)</option>
                          <option value="/">除法 (/)</option>
                        </select>
                      </div>
                    )}

                    {/* VAE Image display decoder */}
                    {node.type === "vae_decode" && (
                      <div className="flex flex-col gap-1 bg-[#121215] p-1.5 rounded border border-[#2a2a32]">
                        {node.properties.imageUrl ? (
                          <div className="relative group aspect-square overflow-hidden rounded">
                            <img
                              src={node.properties.imageUrl}
                              alt="VAE stream preview"
                              className="w-full h-full object-contain cursor-zoom-in"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute right-1.5 top-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <a
                                href={node.properties.imageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 bg-[#1a1a20]/90 border border-[#2b2b36] hover:bg-[#343444] rounded shadow-2xl transition-all"
                                title="在新窗口中打开原图"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-white" />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="h-32 rounded bg-[#0e0e11] flex flex-col items-center justify-center gap-1.5 text-center px-4">
                            <Layers className="w-6 h-6 text-gray-700 animate-pulse" />
                            <span className="text-[8.5px] text-gray-500 font-mono tracking-wider">AWAITING LATENT DECODER STREAM</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text to Video Synthesizer rendering options */}
                    {node.type === "text_to_video" && (
                      <div className="bg-[#121215] p-2 rounded border border-[#2d2d38] space-y-1.5 text-[9.5px]">
                        <div className="flex justify-between">
                          <span className="text-gray-400">插值运算:</span>
                          <span className="text-rose-400 font-bold font-mono">RIFE_OpticalFlow (帧流)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">时序镜头:</span>
                          <span className="text-gray-300 font-mono">Zoom In - {node.properties.motion_scale || 8.5}x</span>
                        </div>
                      </div>
                    )}

                    {/* Custom HTML5 video looping player inside node! */}
                    {node.type === "video_viewer" && (
                      <div className="flex flex-col gap-1.5 bg-[#121215] p-1.5 rounded border border-[#2a2a32]">
                        {node.properties.videoUrl ? (
                          <>
                            <div className="relative group aspect-video overflow-hidden rounded bg-black">
                              <video
                                src={node.properties.videoUrl}
                                autoPlay
                                muted
                                loop
                                playsInline
                                controls
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute right-1.5 top-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => triggerVideoUpload(node.id)}
                                  className="p-1.5 bg-[#1a1a20]/95 border border-[#2b2b36] hover:bg-amber-600 rounded shadow-2xl transition-all cursor-pointer flex items-center justify-center"
                                  title="重新选择/上传本地视频文件"
                                >
                                  <UploadCloud className="w-3.5 h-3.5 text-white" />
                                </button>
                                <a
                                  href={node.properties.videoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 bg-[#1a1a20]/90 border border-[#2b2b36] hover:bg-[#343444] rounded shadow-2xl transition-all"
                                  title="直接下载或在新窗口中播放视频"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-white" />
                                </a>
                              </div>
                            </div>

                            {/* One-click Frame-by-frame Analysis Action Button */}
                            <button
                              onClick={() => runFrameAnalysis(node.id)}
                              disabled={node.data?.loading}
                              className={`w-full py-1.5 text-[10px] font-bold rounded flex items-center justify-center gap-1.5 border transition-all select-none ${
                                node.data?.loading
                                  ? "bg-amber-950/40 border-amber-500/50 text-amber-300 cursor-not-allowed"
                                  : "bg-gradient-to-r from-indigo-950/40 to-emerald-950/40 hover:from-indigo-900/60 hover:to-emerald-900/60 border-indigo-500/30 hover:border-emerald-500/50 text-indigo-100 hover:text-emerald-200 cursor-pointer shadow-[0_2px_6px_rgba(0,0,0,0.3)] hover:shadow-[0_2px_12px_rgba(16,185,129,0.15)]"
                              }`}
                            >
                              <Video className={`w-3 h-3 text-emerald-400 ${node.data?.loading ? "animate-spin" : "animate-pulse"}`} />
                              <span>
                                {node.data?.loading 
                                  ? `正在逐帧提取 (${node.data?.progress || 0}%)` 
                                  : "一键分析·逐帧分解 (Analyze Frames)"}
                              </span>
                            </button>

                            {/* Collated storyboard frame preview block */}
                            {node.properties.storyboardUrl && (
                              <div className="mt-1 flex flex-col gap-1 border-t border-[#23232a] pt-1.5">
                                <span className="text-[8px] text-[#fbbf24] font-mono font-bold tracking-tight">
                                  🎞️ 已编译 4x4 时序分解帧 (Storyboard):
                                </span>
                                <div className="relative group aspect-video rounded border border-[#25252f] overflow-hidden bg-black shadow-inner">
                                  <img 
                                    src={node.properties.storyboardUrl} 
                                    alt="Storyboard Collage" 
                                    className="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-300" 
                                    onClick={() => window.open(node.properties.storyboardUrl, "_blank")}
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                    <span className="text-[8px] text-white bg-black/80 px-1.5 py-0.5 rounded border border-gray-700 font-mono font-bold">
                                      点击放大 (Click to Zoom)
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => triggerVideoUpload(node.id)}
                            className="w-full py-6 border border-dashed border-[#3a3a4c] hover:border-indigo-500 rounded bg-[#121215] flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group"
                          >
                            <Video className="w-6 h-6 text-gray-500 group-hover:text-indigo-400 group-hover:scale-110 transition-all animate-bounce" />
                            <div className="flex flex-col gap-0.5 text-center">
                              <span className="text-[9.5px] text-gray-400 font-bold">点击上传本地视频文件</span>
                              <span className="text-[8px] text-gray-600 font-mono">SUPPORT MP4, WEBM, OGG</span>
                            </div>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Custom AI Image/Video Input Node */}
                    {(node.type === "ai_image_node" || node.type === "ai_video_node") && (
                      <div className="flex flex-col gap-2">
                        {/* Upper Player / Image Box */}
                        <div className="bg-[#242429] rounded-lg p-5 flex flex-col items-center justify-center border border-[#333] relative h-[220px]">
                           {/* Add huge play icon for video, or image icon */}
                           {node.type === "ai_video_node" ? (
                             <PlaySquare className="w-16 h-16 text-gray-500/30 absolute" />
                           ) : (
                             <ImageIcon className="w-16 h-16 text-gray-500/30 absolute" />
                           )}
                           
                           {/* Inner menu items (from screenshot) */}
                           <div className="w-full h-full flex flex-col justify-end items-start pb-2 z-10">
                             <div className="text-[12px] text-gray-400 mb-3">尝试:</div>
                             <div className="flex flex-col gap-3">
                                {node.type === "ai_video_node" ? (
                                  <>
                                    <div className="flex items-center gap-2.5 text-[13px] text-gray-200 cursor-pointer hover:text-white transition-colors">
                                      <Layers className="w-4 h-4 text-gray-300" /> 首尾帧生成视频
                                    </div>
                                    <div className="flex items-center gap-2.5 text-[13px] text-gray-200 cursor-pointer hover:text-white transition-colors">
                                      <Sparkles className="w-4 h-4 text-gray-300" /> 首帧生成视频
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2.5 text-[13px] text-gray-200 cursor-pointer hover:text-white transition-colors">
                                      <Sparkles className="w-4 h-4 text-gray-300" /> 文本生成图像
                                    </div>
                                    <div className="flex items-center gap-2.5 text-[13px] text-gray-200 cursor-pointer hover:text-white transition-colors">
                                      <ImageIcon className="w-4 h-4 text-gray-300" /> 垫图参考生成
                                    </div>
                                  </>
                                )}
                             </div>
                           </div>
                        </div>

                        {/* Lower Prompt Area */}
                        <div className="bg-[#242429] rounded-lg p-3 flex flex-col gap-2 border border-[#333]">
                           {/* Tabs */}
                           <div className="flex items-center gap-2 border-b border-[#333] pb-2 mb-1">
                             <span className="text-[11px] bg-[#34343a] px-2 py-1 rounded text-white cursor-pointer font-bold">文生{node.type === "ai_video_node" ? "视频" : "图"}</span>
                             <span className="text-[11px] text-gray-400 hover:text-white cursor-pointer px-1 outline outline-1 outline-gray-600 rounded">全能参考</span>
                             <span className="text-[11px] text-gray-400 hover:text-white cursor-pointer px-1 outline outline-1 outline-gray-600 rounded">图生{node.type === "ai_video_node" ? "视频" : "图"}</span>
                             <span className="text-[11px] text-gray-400 hover:text-white cursor-pointer px-1 outline outline-1 outline-gray-600 rounded">{node.type === "ai_video_node" ? "首尾帧" : "局部重绘"}</span>
                             <span className="text-[11px] text-gray-400 hover:text-white cursor-pointer px-1 outline outline-1 outline-gray-600 rounded">图片参考</span>
                             <div className="ml-auto cursor-pointer">
                               <Maximize2 className="w-3.5 h-3.5 text-gray-400" />
                             </div>
                           </div>
                           
                           {/* Sub Tools */}
                           <div className="flex items-center gap-2 mb-1 mt-1">
                              <button className="flex flex-col items-center gap-1 bg-[#2c2c31] border border-[#3a3a44] rounded px-3 py-1.5 hover:bg-[#34343a]">
                                <Globe className="w-3.5 h-3.5 text-gray-400"/>
                                <span className="text-[9px] text-gray-400">标记</span>
                              </button>
                              <button className="flex flex-col items-center gap-1 bg-[#2c2c31] border border-[#3a3a44] rounded px-3 py-1.5 hover:bg-[#34343a]">
                                <ImageIcon className="w-3.5 h-3.5 text-gray-400"/>
                                <span className="text-[9px] text-gray-400">运镜</span>
                              </button>
                              <button className="flex flex-col items-center gap-1 bg-[#2c2c31] border border-[#3a3a44] rounded px-3 py-1.5 hover:bg-[#34343a]">
                                <UserCheck className="w-3.5 h-3.5 text-gray-400"/>
                                <span className="text-[9px] text-gray-400">角色库</span>
                              </button>
                           </div>

                           <textarea
                             value={node.properties.promptText || ""}
                             onChange={(e) => handlePropertyChange(node.id, "promptText", e.target.value)}
                             placeholder="描述你想要生成的画面内容，@引用素材"
                             className="w-full h-12 bg-transparent text-[12px] text-gray-200 outline-none resize-none placeholder-gray-500 leading-relaxed mt-2"
                           />
                           
                           <div className="flex justify-between items-center mt-2">
                             <div className="flex flex-wrap items-center gap-2">
                               <div className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded bg-[#2c2c31] hover:bg-[#34343a] transition-colors">
                                 <List className="w-3.5 h-3.5 text-gray-300" />
                                 <span className="text-[11px] text-gray-200 font-bold">Seedance 2.0 VIP <span className="text-amber-400 font-bold ml-0.5" style={{fontSize: "7px", verticalAlign: "top"}}>V</span></span>
                                 <ChevronDown className="w-3 h-3 text-gray-400"/>
                               </div>
                               <div 
                                 className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded bg-transparent hover:bg-[#2c2c31] transition-colors relative"
                                 onClick={() => setActiveSettingsId(activeSettingsId === node.id ? null : node.id)}
                               >
                                 <Tv className="w-3.5 h-3.5 text-gray-400" />
                                 <span className="text-[11px] text-gray-300">16:9 · 720P · 5s · <span className="text-gray-400 inline-block align-middle pb-0.5">🔊</span></span>
                                 <ChevronDown className="w-3 h-3 text-gray-400"/>
                                 
                                 {/* Video Settings Popover */}
                                 {activeSettingsId === node.id && (
                                  <div 
                                    className="absolute bottom-full left-0 mb-2 w-80 bg-[#1e1e24] border border-[#333] rounded-xl shadow-2xl p-4 flex flex-col gap-4 text-gray-200 cursor-default"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <div className="flex flex-col gap-2">
                                      <div className="text-[11px] text-gray-400 font-bold">比例</div>
                                      <div className="flex flex-wrap gap-2">
                                        {['Auto', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'].map(ratio => (
                                          <div key={ratio} className={`flex flex-col items-center justify-center w-12 h-12 rounded border ${ratio === '16:9' ? 'border-white text-white' : 'border-[#333] text-gray-400 hover:border-gray-500'} cursor-pointer transition-colors bg-[#242429]`}>
                                            <div className={`border ${ratio === '16:9' ? 'border-white' : 'border-gray-500'} rounded-[1px] mb-1 ${
                                              ratio === '16:9' ? 'w-5 h-3' : 
                                              ratio === '4:3' ? 'w-4 h-3' : 
                                              ratio === '1:1' ? 'w-3 h-3' : 
                                              ratio === '3:4' ? 'w-3 h-4' : 
                                              ratio === '9:16' ? 'w-3 h-5' : 
                                              ratio === '21:9' ? 'w-6 h-2' : 'w-4 h-3'
                                            }`} />
                                            <span className="text-[9px] scale-90">{ratio}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                      <div className="text-[11px] text-gray-400 font-bold">清晰度</div>
                                      <div className="flex gap-2">
                                        {['480P', '720P', '1080P'].map(res => (
                                          <div key={res} className={`flex-1 text-center py-1.5 rounded border ${res === '720P' ? 'border-white text-white' : 'border-[#333] text-gray-400 hover:border-gray-500'} cursor-pointer text-[11px] transition-colors bg-[#242429]`}>
                                            {res}
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                      <div className="flex justify-between items-center text-[11px] text-gray-400 font-bold">
                                        <span>视频时长</span>
                                        <span className="font-mono">5s</span>
                                      </div>
                                      <input type="range" min="1" max="10" defaultValue="5" className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#4f46e5]" />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-1 text-[11px] text-gray-400 font-bold">
                                        <span>生成音频</span>
                                        <HelpIcon className="w-3 h-3" />
                                      </div>
                                      <div className="flex gap-2">
                                        <div className="flex-1 text-center py-1.5 rounded border border-white text-white cursor-pointer text-[11px] transition-colors bg-[#242429]">
                                          开启
                                        </div>
                                        <div className="flex-1 text-center py-1.5 rounded border border-[#333] text-gray-400 hover:border-gray-500 cursor-pointer text-[11px] transition-colors bg-[#242429]">
                                          关闭
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                 )}
                               </div>
                             </div>
                             
                             <div className="flex items-center gap-3">
                               <div className="text-[13px] text-gray-400 hover:text-white cursor-pointer font-serif font-bold tracking-tighter" title="切换语言">文A</div>
                               <Sliders className="w-4 h-4 text-gray-400 hover:text-white cursor-pointer" title="高级设置" />
                               <div className="flex items-center gap-1 cursor-pointer">
                                 <span className="text-[12px] text-gray-400">1个</span>
                                 <ChevronDown className="w-3 h-3 text-gray-500"/>
                               </div>
                               <div className="flex items-center gap-1 text-gray-400">
                                 <Flame className="w-3.5 h-3.5" />
                                 <span className="text-[12px] font-mono">135</span>
                               </div>
                               <button 
                                 className="w-7 h-7 rounded-full bg-gray-500 hover:bg-white text-black flex items-center justify-center cursor-pointer transition-colors" 
                                 title="提交生成"
                                 onClick={() => addLog("success", "已提交生成任务", node.id, node.title)}
                               >
                                 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
                               </button>
                             </div>
                           </div>
                        </div>
                      </div>
                    )}

                    {/* Custom AI Text Input Node */}
                    {node.type === "ai_text_node" && (
                      <div className="flex flex-col gap-2">
                        {/* Upper Menu Block */}
                        <div className="bg-[#242429] rounded-lg p-5 flex flex-col items-center gap-4 border border-[#333]">
                           <div className="w-full flex justify-center mb-1">
                             <List className="w-12 h-12 text-gray-500/50" />
                           </div>
                           <div className="w-full">
                             <div className="text-[11px] text-gray-400 mb-2">尝试:</div>
                             <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2.5 text-[12px] text-gray-200 cursor-pointer hover:text-white transition-colors">
                                  <FileText className="w-4 h-4" /> 自己编写内容
                                </div>
                                <div className="flex items-center gap-2.5 text-[12px] text-gray-200 cursor-pointer hover:text-white transition-colors">
                                  <PlaySquare className="w-4 h-4" /> 文生视频
                                </div>
                                <div className="flex items-center gap-2.5 text-[12px] text-gray-200 cursor-pointer hover:text-white transition-colors">
                                  <ImageIcon className="w-4 h-4" /> 图片反推提示词
                                </div>
                                <div className="flex items-center gap-2.5 text-[12px] text-gray-200 cursor-pointer hover:text-white transition-colors">
                                  <Music className="w-4 h-4" /> 文字生音乐
                                </div>
                             </div>
                           </div>
                        </div>

                        {/* Lower Prompt Area */}
                        <div className="bg-[#242429] rounded-lg p-3 flex flex-col gap-2 border border-[#333]">
                           <textarea
                             value={node.properties.promptText || ""}
                             onChange={(e) => handlePropertyChange(node.id, "promptText", e.target.value)}
                             placeholder="写下你想讲的故事、场景或角色设定。例如：一个来自未来的机器人，在城市屋顶看星星。"
                             className="w-full h-16 bg-transparent text-[11px] text-gray-200 outline-none resize-none placeholder-gray-500 leading-relaxed"
                           />
                           <div className="flex justify-between items-center mt-2">
                             <div className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded bg-[#2c2c31] hover:bg-[#34343a] transition-colors">
                               <Sparkles className="w-3.5 h-3.5 text-gray-300" />
                               <span className="text-[10px] text-gray-300 font-bold">GVLM 3.1</span>
                               <ChevronDown className="w-3 h-3 text-gray-400"/>
                             </div>
                             <div className="flex items-center gap-3">
                               <div className="text-[12px] text-gray-400 hover:text-white cursor-pointer font-serif font-bold tracking-tighter" title="切换语言">
                                 文A
                               </div>
                               <Flame className="w-3.5 h-3.5 text-gray-400 hover:text-white cursor-pointer" title="提权加速" />
                               <div className="text-[11px] text-gray-400 font-bold">1</div>
                               <button 
                                 className="w-6 h-6 rounded-full bg-gray-500 hover:bg-white text-black flex items-center justify-center cursor-pointer transition-colors" 
                                 title="提交生成"
                                 onClick={() => addLog("success", "已提交提示词生成任务", node.id, node.title)}
                               >
                                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
                               </button>
                             </div>
                           </div>
                        </div>
                      </div>
                    )}

                    {/* Text generation displays directly inside workspace */}
                    {node.type === "gemini_assistant" && (
                      <div className="flex flex-col gap-1.5">
                        <textarea
                          value={node.properties.text || ""}
                          readOnly
                          placeholder="文字流推理完成后将在此处渲染..."
                          className="w-full h-20 text-[9px] bg-[#121215] text-[#8a8afd] rounded p-2 outline-none border border-[#2a2a35] font-sans resize-none leading-relaxed"
                        />
                        <div className="text-[8px] text-gray-500 leading-snug">
                          系统预置角色: <span className="font-mono text-gray-400 font-bold">{(node.properties.systemInstruction || "").slice(0,35)}...</span>
                        </div>
                      </div>
                    )}

                    {/* Sockets Connect Sockets Lines */}
                    <div className="flex flex-col gap-1 pt-1.5 border-t border-[#25252e]">
                      
                      {/* Left Side: Inputs sockets */}
                      {node.inputs.map((term, index) => {
                        const isConnected = links.some(l => l.toNodeId === node.id && l.toInputIndex === index);
                        return (
                          <div key={term.name} className="flex items-center gap-1.5 h-6 relative select-none">
                            <div
                              id={`socket-${node.id}-input-${index}`}
                              onMouseUp={(e) => completeDragLink(e, node.id, index, term.type)}
                              className={`w-3.5 h-3.5 rounded-full border cursor-pointer shrink-0 transition-transform hover:scale-135 z-20 ${
                                isConnected ? "bg-[#3e3edd]" : "bg-transparent"
                              }`}
                              style={{ 
                                borderColor: DOT_COLORS[term.type],
                                backgroundColor: isConnected ? DOT_COLORS[term.type] : "transparent"
                              }}
                              title={`输入端: [${term.type}]`}
                            />
                            <span className="text-[9.5px] text-gray-400 font-sans font-bold">
                              {term.name}
                            </span>
                            <span className="text-[7.5px] text-gray-600 font-mono shrink-0 font-normal">
                              ({term.type})
                            </span>
                          </div>
                        );
                      })}

                      {/* Right Side: Outputs sockets */}
                      {node.outputs.map((term, index) => {
                        return (
                          <div key={term.name} className="flex items-center justify-end gap-1.5 h-6 relative select-none">
                            <span className="text-[7.5px] text-gray-600 font-mono shrink-0 font-normal">
                              ({term.type})
                            </span>
                            <span className="text-[9.5px] text-gray-300 font-sans font-bold">
                              {term.name}
                            </span>
                            <div
                              id={`socket-${node.id}-output-${index}`}
                              onMouseDown={(e) => startDragLink(e, node.id, index, true, term.type)}
                              className="w-3.5 h-3.5 rounded-full hover:scale-135 transition-transform cursor-pointer shrink-0 z-20 border"
                              style={{ 
                                borderColor: DOT_COLORS[term.type], 
                                backgroundColor: DOT_COLORS[term.type] 
                              }}
                              title={`输出端: [${term.type}]`}
                            />
                          </div>
                        );
                      })}
                    </div>

                  </div> 
                </div>
              );
            })}
          </div>

          {/* Quick Context-Menu Finder Dialog */}
          {showSearch && (
            <SearchMenu
              x={searchPos.x}
              y={searchPos.y}
              onAddNode={(type, sx, sy) => {
                spawnNode(type, sx, sy);
                setShowSearch(false);
              }}
              onClose={() => setShowSearch(false)}
            />
          )}

          {/* Canvas Bottom-Left Floating Utility Panels (Grid Toggle, Minimap, PiP Streamer) */}
          <div className="absolute left-4 bottom-4 z-40 flex flex-col items-start gap-3 pointer-events-none max-w-sm sm:max-w-md select-none">
            
            {/* 2. Interactive Canvas Minimap */}
            {showMinimap && nodes.length > 0 && (() => {
              let minX = Infinity;
              let maxX = -Infinity;
              let minY = Infinity;
              let maxY = -Infinity;
              nodes.forEach(node => {
                minX = Math.min(minX, node.x);
                maxX = Math.max(maxX, node.x);
                minY = Math.min(minY, node.y);
                maxY = Math.max(maxY, node.y);
              });
              
              if (minX === Infinity) { minX = 0; maxX = 1000; minY = 0; maxY = 800; }
              const bboxLeft = minX - 150;
              const bboxTop = minY - 150;
              const bboxWidth = Math.max(500, (maxX - minX) + 150 + 240);
              const bboxHeight = Math.max(400, (maxY - minY) + 150 + 220);

              const mapWidth = 180;
              const mapHeight = 110;
              
              const mScale = Math.min(mapWidth / bboxWidth, mapHeight / bboxHeight);

              const rect = workspaceRef.current?.getBoundingClientRect();
              const viewWidth = rect ? rect.width : 1000;
              const viewHeight = rect ? rect.height : 600;

              // Viewport project outline on Map
              const vx = Math.max(-10, Math.min(mapWidth, (-pan.x / zoom - bboxLeft) * mScale));
              const vy = Math.max(-10, Math.min(mapHeight, (-pan.y / zoom - bboxTop) * mScale));
              const vw = Math.max(10, Math.min(mapWidth + 20, (viewWidth / zoom) * mScale));
              const vh = Math.max(10, Math.min(mapHeight + 20, (viewHeight / zoom) * mScale));

              const handleMinimapInteraction = (e: React.MouseEvent<HTMLDivElement>) => {
                const mapRect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - mapRect.left;
                const clickY = e.clientY - mapRect.top;

                const targetCX = bboxLeft + clickX / mScale;
                const targetCY = bboxTop + clickY / mScale;

                const panX = viewWidth / 2 - targetCX * zoom;
                const panY = viewHeight / 2 - targetCY * zoom;
                setPan({ x: panX, y: panY });
              };

              return (
                <div 
                  className="pointer-events-auto w-[180px] h-[110px] rounded-xl border border-gray-800 bg-[#111115]/95 shadow-[0_10px_20px_0_rgba(0,0,0,0.5)] overflow-hidden relative cursor-crosshair group transition-all duration-300"
                  onClick={handleMinimapInteraction}
                  onMouseMove={(e) => {
                    if (e.buttons === 1) {
                      handleMinimapInteraction(e);
                    }
                  }}
                >
                  {/* Miniature representations of nodes */}
                  {nodes.map(n => {
                    const nx = (n.x - bboxLeft) * mScale;
                    const ny = (n.y - bboxTop) * mScale;
                    const nw = 240 * mScale;
                    const nh = 220 * mScale;
                    const isSelected = selectedNodeId === n.id;
                    const isActive = currentNodeId === n.id;

                    return (
                      <div
                        key={n.id}
                        className={`absolute rounded-[1px] transition-all ${
                          isSelected 
                            ? "bg-indigo-400 shadow-[0_0_4px_#818cf8]" 
                            : isActive 
                            ? "bg-emerald-400 shadow-[0_0_4px_#34d399] animate-pulse" 
                            : n.type === "load_image" || n.type === "video_viewer"
                            ? "bg-sky-500/70"
                            : n.type === "vae_decode" || n.type === "text_to_video"
                            ? "bg-amber-500/70"
                            : "bg-indigo-500/40"
                        }`}
                        style={{
                          left: `${Math.max(0, Math.min(mapWidth - 4, nx))}px`,
                          top: `${Math.max(0, Math.min(mapHeight - 4, ny))}px`,
                          width: `${Math.max(3, nw)}px`,
                          height: `${Math.max(3, nh)}px`,
                        }}
                        title={n.title}
                      />
                    );
                  })}

                  {/* Tiny links representation lines */}
                  <svg className="absolute inset-0 pointer-events-none w-full h-full opacity-30">
                    {links.map((link, idx) => {
                      const sNode = nodes.find(n => n.id === link.source);
                      const tNode = nodes.find(n => n.id === link.target);
                      if (!sNode || !tNode) return null;

                      const sx = (sNode.x - bboxLeft) * mScale;
                      const sy = (sNode.y - bboxTop) * mScale;
                      const tx = (tNode.x - bboxLeft) * mScale;
                      const ty = (tNode.y - bboxTop) * mScale;

                      return (
                        <line
                          key={idx}
                          x1={sx}
                          y1={sy}
                          x2={tx}
                          y2={ty}
                          stroke="#4f46e5"
                          strokeWidth="1"
                        />
                      );
                    })}
                  </svg>

                  {/* Current Viewport Bounding Outline IndicatorBox */}
                  <div 
                    className="absolute border border-indigo-400/90 bg-indigo-500/10 pointer-events-none rounded transition-all shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                    style={{
                      left: `${vx}px`,
                      top: `${vy}px`,
                      width: `${Math.min(mapWidth - vx, vw)}px`,
                      height: `${Math.min(mapHeight - vy, vh)}px`,
                    }}
                  />

                  {/* Miniature text badge overlay */}
                  <div className="absolute right-1.5 bottom-1 text-[7px] font-mono text-gray-500 bg-transparent tracking-widest uppercase font-bold select-none">
                    MAP
                  </div>
                </div>
              );
            })()}

            {/* 3. Horizontal Control Icon Ribbon Bar */}
            <div className="pointer-events-auto flex items-center gap-1 bg-[#121216]/90 border border-gray-800 p-1 rounded-lg shadow-xl backdrop-blur-sm">
              {/* Toggle Grid Feature */}
              <button
                onClick={() => {
                  setShowGrid(!showGrid);
                  addLog("info", showGrid ? "已在画布中暂时隐藏背景网格。" : "已在画布中恢复显示背景网格。");
                }}
                className={`p-1.5 rounded text-xs cursor-pointer transition-all ${
                  showGrid 
                    ? "bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300"
                    : "bg-transparent hover:bg-[#25252b] border border-transparent text-gray-500 hover:text-gray-300"
                }`}
                title="切换显示/隐藏画布网格"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>

              {/* Minimap toggle button */}
              <button
                onClick={() => {
                  setShowMinimap(!showMinimap);
                  addLog("info", showMinimap ? "已关闭工作台画幅缩略小地图。" : "已展开工作台画幅缩略小地图。");
                }}
                className={`p-1.5 rounded text-xs cursor-pointer transition-all ${
                  showMinimap 
                    ? "bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300"
                    : "bg-transparent hover:bg-[#25252b] border border-transparent text-gray-500 hover:text-gray-300"
                }`}
                title="切换显示/隐藏画幅缩略率"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>


            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
