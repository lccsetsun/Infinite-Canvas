import { getPropertySchema, PropertySchemaItem } from "../features/nodes/propertySchema";
import { GraphNode } from "../types";

interface NodeInspectorProps {
  node: GraphNode | null;
  onUpdateProperty: (key: string, value: unknown) => void;
}

export default function NodeInspector({ node, onUpdateProperty }: NodeInspectorProps) {
  const parseNumber = (raw: string, fallback: number) => {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const renderNullishEditor = (key: string, value: null | undefined) => {
    const isNull = value === null;
    return (
      <div className="space-y-1">
        <select
          value={isNull ? "null" : "undefined"}
          onChange={(e) => onUpdateProperty(key, e.target.value === "null" ? null : undefined)}
          className="w-full bg-[#111215] border border-[#303443] rounded px-2 py-1 text-sm"
        >
          <option value="null">null</option>
          <option value="undefined">undefined</option>
        </select>
        <div className="text-[11px] text-gray-500">空值策略：在 null 与 undefined 之间切换。</div>
      </div>
    );
  };

  const renderBySchema = (key: string, value: unknown, schema: PropertySchemaItem) => {
    if (schema.kind === "select") {
      const options = schema.options ?? [];
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => onUpdateProperty(key, e.target.value)}
          className="w-full bg-[#111215] border border-[#303443] rounded px-2 py-1 text-sm"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (schema.kind === "boolean") {
      const current = Boolean(value);
      return (
        <select
          value={current ? "true" : "false"}
          onChange={(e) => onUpdateProperty(key, e.target.value === "true")}
          className="w-full bg-[#111215] border border-[#303443] rounded px-2 py-1 text-sm"
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    if (schema.kind === "number") {
      const fallback = typeof value === "number" ? value : 0;
      return (
        <input
          type="number"
          step={schema.integer ? 1 : "any"}
          min={schema.min}
          max={schema.max}
          value={typeof value === "number" ? value : fallback}
          onChange={(e) => onUpdateProperty(key, parseNumber(e.target.value, fallback))}
          className="w-full bg-[#111215] border border-[#303443] rounded px-2 py-1 text-sm"
        />
      );
    }

    if (schema.kind === "nullish") {
      return renderNullishEditor(key, value as null | undefined);
    }

    return (
      <input
        value={String(value ?? "")}
        placeholder={schema.placeholder}
        onChange={(e) => onUpdateProperty(key, e.target.value)}
        className="w-full bg-[#111215] border border-[#303443] rounded px-2 py-1 text-sm"
      />
    );
  };

  const renderInput = (key: string, value: unknown) => {
    if (!node) return null;

    const schema = getPropertySchema(node.type, key);
    if (schema) return renderBySchema(key, value, schema);

    if (value == null) {
      return renderNullishEditor(key, value as null | undefined);
    }

    if (typeof value === "boolean") {
      return renderBySchema(key, value, { kind: "boolean" });
    }

    if (typeof value === "number") {
      const lowerKey = key.toLowerCase();
      const isMaybeInt =
        lowerKey.includes("seed") ||
        lowerKey.includes("step") ||
        lowerKey.includes("fps") ||
        lowerKey.includes("duration") ||
        lowerKey.includes("min") ||
        lowerKey.includes("max");
      return renderBySchema(key, value, { kind: "number", integer: isMaybeInt });
    }

    return renderBySchema(key, value, { kind: "text" });
  };

  return (
    <div className="border border-[#26282f] rounded-lg p-4 bg-[#171920]">
      <h2 className="text-sm font-semibold mb-3">属性编辑</h2>
      {!node && <div className="text-sm text-gray-400">请选择一个节点后编辑属性。</div>}
      {node && (
        <div className="space-y-3">
          <div className="text-xs text-gray-400">
            <div>节点：{node.title}</div>
            <div>类型：{node.type}</div>
          </div>
          {Object.keys(node.properties).length === 0 && (
            <div className="text-xs text-gray-500">该节点暂无可编辑属性。</div>
          )}
          {Object.entries(node.properties).map(([key, val]) => (
            <label key={key} className="block">
              <div className="text-xs text-gray-300 mb-1">
                {getPropertySchema(node.type, key)?.label ?? key}
              </div>
              {renderInput(key, val)}
              {getPropertySchema(node.type, key)?.description && (
                <div className="text-[11px] text-gray-500 mt-1">
                  {getPropertySchema(node.type, key)?.description}
                </div>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
