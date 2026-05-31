import React from "react";
import LeaferCanvas from "../canvas/LeaferCanvas";
import NodeCard from "../canvas/NodeCard";
import { GraphNode } from "../../types";

interface NodeTemplatesPageProps {
  templateNodes: GraphNode[];
  templatePan: { x: number; y: number };
  templateZoom: number;
  onTemplateCanvasPointerDown: (event: React.PointerEvent) => void;
  onTemplatePointerMove: (event: React.PointerEvent) => void;
  onTemplatePointerUp: () => void;
  onTemplateWheel: (event: React.WheelEvent) => void;
  onTemplateNodeDragStart: (event: React.PointerEvent, node: GraphNode) => void;
  onUpdateProperty?: (nodeId: string, key: string, value: any) => void;
  onUpdateData?: (nodeId: string, data: any) => void;
  apiConfig?: {
    baseUrl: string;
    apiKey: string;
  };
  onPreview?: (content: string) => void;
}

export default function NodeTemplatesPage({
  templateNodes,
  templatePan,
  templateZoom,
  onTemplateCanvasPointerDown,
  onTemplatePointerMove,
  onTemplatePointerUp,
  onTemplateWheel,
  onTemplateNodeDragStart,
  onUpdateProperty,
  onUpdateData,
  apiConfig,
  onPreview,
}: NodeTemplatesPageProps) {
  return (
    <section className="absolute inset-0 z-50 bg-[#0b1020] pl-22 pr-3 py-3" onPointerDown={(e) => e.stopPropagation()}>
      <div className="absolute left-23 right-3 top-3 bottom-3 rounded-2xl border border-[#243356] bg-[radial-gradient(1200px_600px_at_85%_15%,rgba(96,118,255,0.16),transparent_60%),linear-gradient(180deg,#10172a_0%,#0d1220_100%)] overflow-hidden shadow-[0_20px_60px_rgba(4,10,30,0.55)]">
        <div className="h-14 px-5 border-b border-[#2b3c63] flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-300" />
            <div className="text-[17px] font-semibold text-[#e6edff] tracking-wide">节点模板工作台</div>
          </div>
          <div className="text-xs text-[#98a9d5]">
            当前项目可用节点：<span className="text-[#d9e4ff] font-semibold">{templateNodes.length}</span>
          </div>
        </div>
        <div
          className="relative h-[calc(100%-3.5rem)] overflow-hidden bg-[#0c1220] cursor-grab active:cursor-grabbing"
          onPointerDown={onTemplateCanvasPointerDown}
          onPointerMove={onTemplatePointerMove}
          onPointerUp={onTemplatePointerUp}
          onPointerLeave={onTemplatePointerUp}
          onWheel={onTemplateWheel}
        >
          <LeaferCanvas
            nodes={templateNodes}
            pan={templatePan}
            zoom={templateZoom}
            showGrid={true}
            background="#0c1220"
            selectedNodeId={null}
          />
          <div
            className="absolute inset-0 origin-top-left"
            style={{ transform: `translate(${templatePan.x}px, ${templatePan.y}px) scale(${templateZoom})` }}
            onPointerDown={onTemplateCanvasPointerDown}
          >
            {templateNodes.map((tpl) => (
              <div key={tpl.id} className="absolute left-0 top-0" style={{ transform: `translate3d(${tpl.x}px, ${tpl.y}px, 0)` }}>
                <NodeCard
                  node={tpl}
                  selected={false}
                  onSelect={() => {}}
                  onDelete={() => {}}
                  onDuplicate={() => {}}
                  onDragStart={onTemplateNodeDragStart}
                  onUpdateProperty={onUpdateProperty}
                  onUpdateData={onUpdateData}
                  apiConfig={apiConfig}
                  onPreview={onPreview}
                />
              </div>
            ))}
          </div>
          <div className="absolute right-4 bottom-3 px-2.5 py-1 rounded-md border border-[#2f3f66] bg-[#131b2f]/90 text-xs text-[#9ab0e1]">
            节点 {templateNodes.length} · 缩放 {Math.round(templateZoom * 100)}% · 拖拽移动
          </div>
        </div>
      </div>
    </section>
  );
}
