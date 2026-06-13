import React from "react";
import { AnimatePresence, motion } from "motion/react";
import assistantIcon from "../../assets/brand/awoawo-bot-icon.png";

const ASSISTANT_BUBBLE_TEXT = "Hi，我是助手小影";

export default function FloatingAssistantButton() {
  const [bubbleVisible, setBubbleVisible] = React.useState(false);

  const hideBubble = React.useCallback(() => {
    setBubbleVisible(false);
  }, []);

  const showBubble = React.useCallback(() => {
    setBubbleVisible(true);
  }, []);

  return (
    <div
      data-no-canvas-context-menu="true"
      className="absolute bottom-6 right-6 z-50 flex items-end justify-end"
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <AnimatePresence>
        {bubbleVisible && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            className="pointer-events-none absolute bottom-[74px] right-1 max-w-[calc(100vw-112px)] whitespace-nowrap rounded-2xl border border-violet-200/15 bg-[#141923]/94 px-4 py-2.5 text-[13px] font-semibold text-slate-100 shadow-[0_18px_46px_-22px_rgba(0,0,0,0.95),0_0_28px_-18px_rgba(156,158,240,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
          >
            {ASSISTANT_BUBBLE_TEXT}
            <span className="absolute -bottom-1.5 right-7 h-3 w-3 rotate-45 border-b border-r border-violet-200/15 bg-[#141923]/94" />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        aria-label="助手小影"
        className="group grid h-[66px] w-[66px] cursor-pointer appearance-none place-items-center rounded-full border-0 bg-transparent p-0 shadow-none outline-none transition duration-200 hover:-translate-y-0.5"
        onMouseEnter={showBubble}
        onMouseLeave={hideBubble}
        onFocus={showBubble}
        onBlur={hideBubble}
      >
        <img
          src={assistantIcon}
          alt=""
          aria-hidden="true"
          className="h-[58px] w-[58px] object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.36)] transition duration-200 group-hover:scale-[1.03]"
        />
      </button>
    </div>
  );
}
