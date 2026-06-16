import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, GitBranch, ListTree, MessageSquare, Mic, Paperclip, PencilLine, Plus, X } from "lucide-react";
import assistantIcon from "../../assets/brand/awoawo-bot-icon-no-eyes.png";

const ASSISTANT_BUBBLE_TEXTS = [
  "哈喽，我是灵感，接住你所有空白思绪",
  "灵感已唤醒，你的脑洞随时可以开张",
  "嗨，来找灵感吗？所有难题都能开出新想法",
  "灵感待命，陪你捕捉转瞬即逝的奇思",
  "你好呀，灵感在线，告别创作卡壳时刻",
  "叮咚灵感上线，帮你拼凑散落的创意碎片",
  "幸会灵感，万千点子静待你取用",
  "我是灵感，专属于你的创意补给站",
  "灵感加载完成，尽管说出你的构思需求",
  "嗨～别发愁，灵感来为你解锁新思路",
];

const BUBBLE_INTERVAL_MS = 60000;
const BUBBLE_AUTO_HIDE_MS = 10000;
const assistantMascotBlinkTransition = {
  duration: 4.6,
  repeat: Infinity,
  ease: "easeInOut",
  times: [0, 0.78, 0.8, 0.84, 0.86, 0.9, 1],
} as const;
const assistantMascotGreetingTransition = {
  duration: 3.8,
  repeat: Infinity,
  ease: "easeInOut",
} as const;

const ASSISTANT_ACTIONS = [
  {
    title: "整理内容结构",
    helper: "梳理当前画布内容",
    icon: ListTree,
  },
  {
    title: "分析这些节点关系",
    helper: "找出关键连接与逻辑",
    icon: GitBranch,
  },
  {
    title: "给我下一步生成建议",
    helper: "提供创作方向与提示词",
    icon: PencilLine,
  },
];

export function getNextAssistantBubbleIndex(previousIndex: number | null, random = Math.random) {
  const availableIndexes = ASSISTANT_BUBBLE_TEXTS.map((_, index) => index).filter(
    (index) => index !== previousIndex
  );
  const randomIndex = Math.floor(random() * availableIndexes.length);
  return availableIndexes[randomIndex] ?? 0;
}

interface FloatingAssistantButtonProps {
  onPanelOpenChange?: (open: boolean) => void;
}

interface AssistantMascotProps {
  size: "button" | "panel";
  panelGreeting?: boolean;
}

function AssistantMascot({ size, panelGreeting = false }: AssistantMascotProps) {
  const wrapperClassName =
    size === "panel"
      ? "relative h-[82px] w-[82px]"
      : "relative h-[64px] w-[64px] transition duration-200 group-hover:scale-[1.03]";
  const imageClassName =
    size === "panel"
      ? "h-[82px] w-[82px] object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.45)]"
      : "h-[64px] w-[64px] object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.36)]";
  const assistantMascotSparkClassName =
    size === "panel"
      ? "absolute right-[-10%] top-[-8%] text-[15px] leading-none text-violet-200 drop-shadow-[0_0_10px_rgba(196,181,253,0.9)]"
      : "absolute right-[-12%] top-[-10%] text-[12px] leading-none text-violet-200 drop-shadow-[0_0_10px_rgba(196,181,253,0.9)]";
  const eyeClassName =
    "assistant-mascot-animated-eye absolute top-[40.3%] h-[9.2%] w-[3.5%] origin-center rounded-full bg-gradient-to-b from-white via-slate-50 to-blue-100 shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_0_8px_rgba(255,255,255,0.34)]";
  const blinkAnimate = {
    scaleY: [1, 1, 0.16, 1, 0.16, 1, 1],
    y: ["0%", "0%", "42%", "0%", "42%", "0%", "0%"],
  };

  return (
    <motion.span
      aria-hidden="true"
      className={wrapperClassName}
      animate={
        panelGreeting
          ? { y: [0, -7, -2, -4, 0], rotate: [0, -5, 4, 0, 0] }
          : { y: [0, -2, 0] }
      }
      transition={
        panelGreeting ? assistantMascotGreetingTransition : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <img src={assistantIcon} alt="" className={imageClassName} />
      <motion.span
        className={`${eyeClassName} left-[38.3%]`}
        animate={blinkAnimate}
        transition={assistantMascotBlinkTransition}
      />
      <motion.span
        className={`${eyeClassName} left-[58.2%]`}
        animate={blinkAnimate}
        transition={{ ...assistantMascotBlinkTransition, delay: 0.02 }}
      />
      {panelGreeting && (
        <motion.span
          aria-hidden="true"
          className={assistantMascotSparkClassName}
          animate={{ opacity: [0.28, 1, 0.28], scale: [0.78, 1.18, 0.78], rotate: [0, 12, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          ✦
        </motion.span>
      )}
    </motion.span>
  );
}

export default function FloatingAssistantButton({ onPanelOpenChange }: FloatingAssistantButtonProps) {
  const [bubbleVisible, setBubbleVisible] = React.useState(false);
  const [bubbleText, setBubbleText] = React.useState(ASSISTANT_BUBBLE_TEXTS[0]);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const lastBubbleIndexRef = React.useRef<number | null>(null);
  const autoHideTimerRef = React.useRef<number | null>(null);

  const clearAutoHideTimer = React.useCallback(() => {
    if (autoHideTimerRef.current === null) return;
    window.clearTimeout(autoHideTimerRef.current);
    autoHideTimerRef.current = null;
  }, []);

  React.useEffect(() => {
    onPanelOpenChange?.(panelOpen);
    return () => onPanelOpenChange?.(false);
  }, [onPanelOpenChange, panelOpen]);

  const hideBubble = React.useCallback(() => {
    clearAutoHideTimer();
    setBubbleVisible(false);
  }, [clearAutoHideTimer]);

  const showBubble = React.useCallback((autoHide = false) => {
    if (panelOpen) return;
    clearAutoHideTimer();
    const nextIndex = getNextAssistantBubbleIndex(lastBubbleIndexRef.current);
    lastBubbleIndexRef.current = nextIndex;
    setBubbleText(ASSISTANT_BUBBLE_TEXTS[nextIndex]);
    setBubbleVisible(true);
    if (autoHide) {
      autoHideTimerRef.current = window.setTimeout(() => {
        setBubbleVisible(false);
        autoHideTimerRef.current = null;
      }, BUBBLE_AUTO_HIDE_MS);
    }
  }, [clearAutoHideTimer, panelOpen]);

  React.useEffect(() => {
    if (panelOpen) return undefined;
    const intervalTimer = window.setInterval(() => showBubble(true), BUBBLE_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalTimer);
      clearAutoHideTimer();
    };
  }, [clearAutoHideTimer, panelOpen, showBubble]);

  const openPanel = React.useCallback(() => {
    clearAutoHideTimer();
    setBubbleVisible(false);
    setPanelOpen(true);
  }, [clearAutoHideTimer]);

  return (
    <div
      data-no-canvas-context-menu="true"
      data-canvas-passthrough="true"
      className="absolute bottom-6 right-6 z-[180] flex items-end justify-end"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <AnimatePresence>
        {panelOpen && (
          <motion.aside
            initial={{ opacity: 0, x: 96 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 96 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-2.5 right-6 top-2.5 flex w-[660px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[30px] border border-violet-200/[0.10] bg-[#0f141d]/96 text-slate-200 shadow-[0_28px_72px_-30px_rgba(0,0,0,0.96),0_0_46px_-34px_rgba(139,92,246,0.62),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-2xl"
            data-canvas-passthrough="true"
            role="dialog"
            aria-label="小影助手"
            onWheel={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(156,158,240,0.105),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.032),transparent_24%)]" />
            <div className="pointer-events-none absolute inset-x-10 top-20 h-[300px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.04),transparent_62%)] blur-2xl" />

            <header className="relative flex h-[84px] shrink-0 items-center justify-between border-b border-white/[0.055] px-6">
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-black text-slate-100">小影助手</h2>
                <p className="mt-1 truncate text-[12px] font-semibold text-slate-500">
                  首条消息会自动创建会话
                </p>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <button
                  type="button"
                  aria-label="新建助手会话"
                  className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-slate-300 transition hover:bg-white/[0.07] hover:text-slate-50"
                >
                  <Plus className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="查看助手消息"
                  className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-slate-300 transition hover:bg-white/[0.07] hover:text-slate-50"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="关闭小影助手"
                  className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-slate-300 transition hover:bg-white/[0.07] hover:text-slate-50"
                  onClick={() => setPanelOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="relative flex min-h-0 flex-1 flex-col px-7 pb-5 pt-7">
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <section className="flex flex-col items-center text-center">
                  <div className="relative grid h-[132px] w-[132px] place-items-center">
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-1 rounded-full border border-violet-200/10 bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_58%)] shadow-[0_0_34px_rgba(167,139,250,0.10)]"
                      animate={{ scale: [0.96, 1.04, 0.96], opacity: [0.64, 0.9, 0.64] }}
                      transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-3 rounded-full border border-violet-300/18"
                      animate={{ scale: [0.72, 1.08], opacity: [0.42, 0] }}
                      transition={{ duration: 3.1, repeat: Infinity, ease: "easeOut" }}
                    />
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-7 rounded-full bg-violet-200/12 blur-xl"
                      animate={{ scale: [0.92, 1.16, 0.92], opacity: [0.42, 0.78, 0.42] }}
                      transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
                    />
                    {[
                      "left-5 top-11 h-1.5 w-1.5",
                      "right-6 bottom-9 h-1.5 w-1.5",
                      "left-9 bottom-7 h-1 w-1",
                    ].map((className, index) => (
                      <motion.span
                        key={className}
                        aria-hidden="true"
                        className={`absolute rounded-full bg-violet-200 shadow-[0_0_12px_rgba(196,181,253,0.88)] ${className}`}
                        animate={{
                          opacity: [0.16, 0.82, 0.16],
                          scale: [0.68, 1.1, 0.68],
                          x: [0, index === 1 ? -5 : 4, 0],
                          y: [0, index === 0 ? -8 : 5, 0],
                        }}
                        transition={{
                          duration: 3 + index * 0.42,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: index * 0.34,
                        }}
                      />
                    ))}
                    <motion.span
                      aria-hidden="true"
                      className="absolute right-8 top-6 text-[15px] leading-none text-violet-300 drop-shadow-[0_0_10px_rgba(196,181,253,0.9)]"
                      animate={{ opacity: [0.35, 1, 0.35], scale: [0.82, 1.12, 0.82], rotate: [0, 8, 0] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                    >
                      ✦
                    </motion.span>
                    <motion.span
                      aria-hidden="true"
                      className="absolute left-8 top-7 text-[11px] leading-none text-violet-100/90 drop-shadow-[0_0_8px_rgba(221,214,254,0.8)]"
                      animate={{ opacity: [0.2, 0.9, 0.2], scale: [0.76, 1.08, 0.76], rotate: [0, -10, 0] }}
                      transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    >
                      ✦
                    </motion.span>
                    <motion.span
                      aria-hidden="true"
                      className="absolute bottom-4 h-4 w-14 rounded-full bg-violet-500/18 blur-md"
                      animate={{ scaleX: [1, 0.78, 1], opacity: [0.34, 0.58, 0.34] }}
                      transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <AssistantMascot size="panel" panelGreeting />
                  </div>
                  <h3 className="mt-4 text-[24px] font-black leading-tight tracking-normal text-slate-100">
                    你好，我是小影
                  </h3>
                  <p className="mt-2 text-[14px] font-semibold text-slate-500">
                    我可以帮你读画布、理结构、生成下一步。
                  </p>
                </section>

                <div className="mx-auto mt-8 flex w-full max-w-[500px] flex-col gap-3 pb-5">
                  {ASSISTANT_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.title}
                        type="button"
                        className="group flex h-[76px] cursor-pointer items-center gap-4 rounded-[18px] border border-white/[0.075] bg-[#0d121a]/74 px-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.032)] transition hover:border-violet-200/[0.16] hover:bg-[#121923]/86"
                      >
                        <Icon className="h-6 w-6 shrink-0 text-slate-400 transition group-hover:text-violet-200" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-black text-slate-200">
                            {action.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] font-semibold text-slate-500">
                            {action.helper}
                          </span>
                        </span>
                        <span className="text-[26px] leading-none text-slate-500 transition group-hover:translate-x-1 group-hover:text-violet-200">
                          ›
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="shrink-0 rounded-[24px] border border-violet-200/[0.10] bg-[#121923]/72 p-4 shadow-[0_16px_36px_-28px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.04)]">
                <textarea
                  aria-label="小影助手输入框"
                  placeholder="描述操作或选择节点添加上下文..."
                  className="h-[66px] w-full resize-none bg-transparent text-[13px] font-semibold text-slate-300 outline-none placeholder:text-slate-600"
                />
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-slate-400">
                    <button
                      type="button"
                      aria-label="添加附件"
                      className="grid h-9 w-9 cursor-pointer place-items-center rounded-full transition hover:bg-white/[0.07]"
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-bold text-slate-300 transition hover:bg-white/[0.07]"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Ask
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="语音输入"
                      className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.07] hover:text-slate-200"
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                    <span className="h-7 w-px bg-white/[0.08]" />
                    <button
                      type="button"
                      aria-label="发送给小影助手"
                      className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-slate-700/55 text-slate-200 transition hover:bg-violet-300/18 hover:text-violet-50"
                    >
                      <ArrowUp className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bubbleVisible && !panelOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 7, scale: 0.94 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute bottom-[72px] right-0 w-[214px] max-w-[calc(100vw-88px)] whitespace-normal break-words rounded-[22px] border border-violet-200/80 bg-gradient-to-br from-white via-white to-violet-50 py-3 pl-[38px] pr-3 text-left text-[12px] font-black leading-[1.42] text-slate-800 shadow-[0_22px_42px_-26px_rgba(0,0,0,0.95),0_7px_0_-3px_rgba(139,92,246,0.28),0_0_32px_-18px_rgba(167,139,250,0.88),inset_0_2px_0_rgba(255,255,255,0.98),inset_0_0_0_1px_rgba(255,255,255,0.72)]"
          >
            <span
              aria-hidden="true"
              className="absolute -left-2.5 top-3 h-8 w-8 rounded-full bg-gradient-to-br from-violet-300 via-violet-500 to-indigo-500 shadow-[0_10px_22px_-12px_rgba(76,29,149,0.9),0_0_18px_rgba(167,139,250,0.72)]"
            />
            <span
              aria-hidden="true"
              className="absolute -left-3.5 top-2 h-10 w-10 rounded-full border border-dashed border-violet-300/70"
            />
            <span
              aria-hidden="true"
              className="absolute left-0 top-[21px] text-[14px] leading-none text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]"
            >
              ✦
            </span>
            <span className="relative z-10 block max-h-[35px] overflow-hidden">{bubbleText}</span>
            <span className="absolute -bottom-2 right-8 h-5 w-5 rotate-45 rounded-br-[6px] border-b border-r border-violet-200/80 bg-violet-50 shadow-[5px_5px_0_-1px_rgba(139,92,246,0.22)]" />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        aria-label="助手小影"
        className={`group grid h-[72px] w-[72px] cursor-pointer appearance-none place-items-center rounded-full border-0 bg-transparent p-0 shadow-none outline-none transition duration-200 hover:-translate-y-0.5 ${
          panelOpen ? "pointer-events-none opacity-0" : ""
        }`}
        onMouseEnter={() => showBubble(false)}
        onMouseLeave={hideBubble}
        onFocus={() => {
          if (!bubbleVisible) showBubble(false);
        }}
        onBlur={hideBubble}
        onClick={openPanel}
      >
        <AssistantMascot size="button" panelGreeting={bubbleVisible} />
      </button>
    </div>
  );
}
