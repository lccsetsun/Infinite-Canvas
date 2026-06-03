export const CONNECTION_LINK_STYLE = {
  base: {
    opacity: 0.76,
    stroke: "rgba(67, 56, 202, 0.26)",
    strokeWidth: 2.4,
  },
  core: {
    opacity: 0.82,
    stroke: "rgba(45, 212, 191, 0.5)",
    strokeWidth: 3.6,
  },
  flow: {
    dashPattern: [18, 98],
    duration: 1.35,
    shadow: "0 0 18px rgba(167, 139, 250, 0.88)",
    stroke: "#c4b5fd",
    strokeWidth: 1.85,
  },
  glow: {
    opacity: 0.3,
    shadow: "0 0 28px rgba(34, 211, 238, 0.54)",
    stroke: "rgba(99, 102, 241, 0.34)",
    strokeWidth: 9,
  },
} as const;

export const CONNECTION_DRAFT_STYLE = {
  core: {
    opacity: 0.94,
    stroke: "#67e8f9",
    strokeWidth: 3.4,
  },
  flow: {
    dashPattern: [28, 52],
    duration: 0.95,
    invalidStroke: "#facc15",
    shadow: "0 0 18px rgba(103, 232, 249, 0.8)",
    stroke: "#22d3ee",
    strokeWidth: 3.2,
  },
  glow: {
    invalidStroke: "rgba(251, 191, 36, 0.48)",
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
