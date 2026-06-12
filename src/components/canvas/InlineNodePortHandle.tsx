import React from "react";
import { Plus } from "lucide-react";
import { motion } from "motion/react";

type PortRole = "input" | "output";
type MotionDivProps = React.ComponentProps<typeof motion.div>;

interface InlineNodePortHandleProps {
  active: boolean;
  animate?: MotionDivProps["animate"];
  className?: string;
  inputIssue?: string | null;
  handleRef?: React.Ref<HTMLDivElement>;
  nodeId: string;
  onBeginCanvasLink?: (
    nodeId: string,
    outputIndex: number,
    clientX: number,
    clientY: number
  ) => void;
  onFinishCanvasLink?: (nodeId?: string, inputIndex?: number) => void;
  onHoverCanvasLinkTarget?: (nodeId: string, inputIndex: number) => void;
  onLeaveCanvasLinkTarget?: (nodeId: string, inputIndex: number) => void;
  portIndex: number;
  role: PortRole;
  title?: string;
  transition?: MotionDivProps["transition"];
}

export function getInlineNodePortHandleClassName(role: PortRole, active: boolean, className = "") {
  const roleClass =
    role === "input"
      ? active
        ? "canvas-port-input canvas-port-hot scale-110"
        : "canvas-port-input"
      : active
        ? "canvas-port-output canvas-port-active scale-110"
        : "canvas-port-output";

  return `canvas-port-handle flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 hover:scale-110 will-change-transform ${roleClass} ${className}`.trim();
}

function InlineNodePortHandleImpl({
  active,
  animate,
  className,
  handleRef,
  inputIssue,
  nodeId,
  onBeginCanvasLink,
  onFinishCanvasLink,
  onHoverCanvasLinkTarget,
  onLeaveCanvasLinkTarget,
  portIndex,
  role,
  title,
  transition,
}: InlineNodePortHandleProps) {
  const isInput = role === "input";

  return (
    <motion.div
      ref={handleRef}
      role="button"
      tabIndex={-1}
      data-node-action="true"
      data-port-role={role}
      data-node-id={nodeId}
      data-port-index={portIndex}
      animate={animate}
      transition={transition}
      className={getInlineNodePortHandleClassName(role, active, className)}
      onPointerEnter={isInput ? () => onHoverCanvasLinkTarget?.(nodeId, portIndex) : undefined}
      onPointerLeave={isInput ? () => onLeaveCanvasLinkTarget?.(nodeId, portIndex) : undefined}
      onPointerUp={
        isInput
          ? (event) => {
              event.stopPropagation();
              event.preventDefault();
              onFinishCanvasLink?.(nodeId, portIndex);
            }
          : undefined
      }
      onPointerDown={
        !isInput
          ? (event) => {
              event.stopPropagation();
              event.preventDefault();
              (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
              onBeginCanvasLink?.(nodeId, portIndex, event.clientX, event.clientY);
            }
          : undefined
      }
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
      }}
      title={
        title ??
        (isInput
          ? inputIssue || "输入端口: 点击此处完成连线"
          : "输出端口: 按住并拖拽进行连线 (支持多条输出)")
      }
    >
      <Plus className="h-4 w-4 pointer-events-none" />
    </motion.div>
  );
}

export const InlineNodePortHandle = React.memo(InlineNodePortHandleImpl);
