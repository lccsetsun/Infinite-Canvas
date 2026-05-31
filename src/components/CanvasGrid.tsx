import React from "react";

interface CanvasGridProps {
  pan: { x: number; y: number };
  zoom: number;
}

export default function CanvasGrid({ pan, zoom }: CanvasGridProps) {
  const gridSize = 24 * zoom;
  
  // High-performance background grid calculation matches ComfyUI style exactly
  const backgroundStyle: React.CSSProperties = {
    backgroundImage: "radial-gradient(circle, rgba(255, 255, 255, 0.08) 1.5px, transparent 1.5px)",
    backgroundPosition: `${pan.x}px ${pan.y}px`,
    backgroundSize: `${gridSize}px ${gridSize}px`,
    backgroundColor: "#121214",
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 0,
    pointerEvents: "none",
  };

  return <div style={backgroundStyle} className="select-none" id="canvas-grid" />;
}
