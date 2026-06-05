export const CONNECTION_LINK_STYLE = {
  base: {
    opacity: 0.38,
    stroke: "rgba(94, 124, 145, 0.28)",
    strokeWidth: 2.2,
  },
  core: {
    opacity: 0.52,
    stroke: "rgba(51, 102, 122, 0.62)",
    strokeWidth: 3.2,
  },
  flow: {
    dashPattern: [34, 70],
    duration: 0.72,
    shadow: "0 0 22px rgba(34, 211, 238, 0.96), 0 0 46px rgba(129, 140, 248, 0.68)",
    stroke: "#a5f3fc",
    strokeWidth: 4.2,
  },
  glow: {
    opacity: 0.18,
    shadow: "0 0 22px rgba(56, 189, 248, 0.34)",
    stroke: "rgba(59, 130, 170, 0.22)",
    strokeWidth: 8,
  },
} as const;

export const CONNECTION_DRAFT_STYLE = {
  core: {
    opacity: 0.94,
    stroke: "#67e8f9",
    strokeWidth: 3.4,
  },
  flow: {
    dashPattern: [34, 48],
    duration: 0.72,
    invalidStroke: "#fbbf24",
    shadow: "0 0 24px rgba(103, 232, 249, 0.94), 0 0 50px rgba(99, 102, 241, 0.58)",
    stroke: "#67e8f9",
    strokeWidth: 4,
  },
  glow: {
    invalidStroke: "rgba(251, 191, 36, 0.22)",
    stroke: "rgba(34, 211, 238, 0.48)",
    strokeWidth: 10,
  },
} as const;

export const PORT_HANDLE_CLASSES = {
  base:
    "canvas-port-handle flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200",
  inputHot: "canvas-port-hot",
  inputIdle: "canvas-port-input",
  inputInvalid: "canvas-port-invalid",
  outputActive: "canvas-port-active",
  outputIdle: "canvas-port-output",
} as const;
