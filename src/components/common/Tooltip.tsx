import React from "react";
import { motion, AnimatePresence } from "motion/react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = "top" }) => {
  const [show, setShow] = React.useState(false);

  const getPositionClasses = () => {
    switch (position) {
      case "bottom":
        return "top-full left-1/2 -translate-x-1/2 mt-2";
      case "left":
        return "right-full top-1/2 -translate-y-1/2 mr-2";
      case "right":
        return "left-full top-1/2 -translate-y-1/2 ml-2";
      case "top":
      default:
        return "bottom-full left-1/2 -translate-x-1/2 mb-2";
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case "bottom":
        return "bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-[#1a2030]";
      case "left":
        return "left-full top-1/2 -translate-y-1/2 -ml-1 border-l-[#1a2030]";
      case "right":
        return "right-full top-1/2 -translate-y-1/2 -mr-1 border-r-[#1a2030]";
      case "top":
      default:
        return "top-full left-1/2 -translate-x-1/2 -mt-1 border-t-[#1a2030]";
    }
  };

  return (
    <div 
      className="relative flex items-center justify-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <div className="cursor-pointer flex items-center justify-center">
        {children}
      </div>
      <AnimatePresence>
        {show && content && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute ${getPositionClasses()} px-2.5 py-1.5 bg-[#1a2030]/95 backdrop-blur-md border border-indigo-500/40 rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)] pointer-events-none z-[100] whitespace-nowrap`}
          >
            <div className="text-[11px] font-bold text-indigo-100 tracking-wide">
              {content}
            </div>
            {/* Arrow */}
            <div className={`absolute border-8 border-transparent ${getArrowClasses()}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
