# 大型画布工作流优化实施计划

> **给 agentic workers：** 必须使用子技能：按任务执行本计划时，使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`。任务步骤使用 checkbox（`- [ ]`）格式追踪进度。

**目标：** 让 `/canvas` 在项目包含大量节点、图片资源和视频资源时，初始化和交互仍然保持流畅。

**架构：** 按“低侵入到高结构性”的顺序优化：先减少 DOM 和媒体加载工作，再减少 Leafer 画布重绘成本，然后降低自动保存的序列化和上传压力，最后再把资源元数据和重量级媒体资源拆开。每个任务都应该能独立交付、独立验证。

**技术栈：** React 19、Vite、TypeScript、Vitest、Leafer UI，以及当前 `src/features/workspace/remoteCanvas.ts` 中的远端画布 API。

---

## 文件结构

- 修改：`src/components/app/CanvasNodeLayer.tsx`
  - 负责 DOM 节点渲染。新增视口感知过滤，只渲染可视节点，以及选中、拖拽、连线中的例外节点。
- 新建：`src/utils/canvasViewportCulling.ts`
  - 纯工具函数：把视口状态转换为可视世界坐标矩形，并过滤节点。
- 新建：`src/utils/canvasViewportCulling.test.ts`
  - 覆盖裁剪行为、缓冲边距、选中节点例外和边界情况。
- 修改：`src/App.tsx`
  - 向节点层传入 `canvasSize`，后续也向 Leafer 传入图索引数据。
- 修改：`src/components/canvas/ImageNodeCard.tsx`
  - 优先使用图片懒加载，尽量避免隐藏缩略图 eager 加载。
- 修改：`src/components/canvas/VideoNodeCard.tsx`
  - 未选中、未悬停、未播放时使用 `preload="none"`。
- 新建：`src/utils/mediaPreviewPolicy.ts`
  - 纯策略函数：决定图片/视频预览加载策略。
- 新建：`src/utils/mediaPreviewPolicy.test.ts`
  - 测试视频 preload 和图片 loading 策略。
- 修改：`src/components/canvas/LeaferCanvas.tsx`
  - 停止重复重建不必要的网格层；连线渲染使用 O(1) 节点查找。
- 新建：`src/utils/leaferRenderPolicy.ts`
  - 如有需要，用于承载连线可见性和渲染负载策略的纯 helper。
- 修改：`src/hooks/useWorkflowState.ts`
  - 拆分轻量本地 workspace 更新与远端持久化，降低全量 JSON stringify 频率，并为 patch 式持久化做准备。
- 新建：`src/utils/remotePersistPolicy.ts`
  - 远端持久化的 debounce、throttle、signature 决策 helper。
- 新建：`src/utils/remotePersistPolicy.test.ts`
  - 覆盖全量快照时机和轻量位置更新行为。
- 修改：`src/features/workspace/remoteCanvas.ts`
  - 后续阶段：在保留当前全量 PUT 回退的同时，增加可选 patch 更新 helper。

---

## 阶段 1：基准和保护栏

### 任务 1：新增大型工作流 fixture 生成器

**文件：**
- 新建：`src/utils/canvasLargeWorkflowFixture.ts`
- 新建：`src/utils/canvasLargeWorkflowFixture.test.ts`

- [x] **步骤 1：编写 fixture 测试**

```ts
import { describe, expect, it } from "vitest";
import { createLargeCanvasFixture } from "./canvasLargeWorkflowFixture";

describe("createLargeCanvasFixture", () => {
  it("creates deterministic nodes and links for performance tests", () => {
    const fixture = createLargeCanvasFixture({ imageNodes: 12, videoNodes: 8, textNodes: 4 });

    expect(fixture.nodes).toHaveLength(24);
    expect(fixture.links.length).toBeGreaterThan(0);
    expect(fixture.nodes[0]).toMatchObject({ id: "fixture_text_0", type: "text_node", x: 0, y: 0 });
    expect(fixture.nodes.some((node) => node.type === "video_node")).toBe(true);
  });
});
```

- [x] **步骤 2：运行失败测试**

运行：`npm test -- src/utils/canvasLargeWorkflowFixture.test.ts`

预期：失败，因为 `canvasLargeWorkflowFixture.ts` 尚不存在。

- [x] **步骤 3：实现 fixture helper**

创建 `src/utils/canvasLargeWorkflowFixture.ts`，使用现有 `GraphNode` 和 `GraphLink` 类型生成确定性的文本、图片、视频节点。fixture 里只使用远程 URL 或极小 data URL，不嵌入大体积 base64。

- [x] **步骤 4：验证**

运行：`npm test -- src/utils/canvasLargeWorkflowFixture.test.ts`

预期：通过。

- [ ] **步骤 5：提交**

```bash
git add src/utils/canvasLargeWorkflowFixture.ts src/utils/canvasLargeWorkflowFixture.test.ts
git commit -m "test: add large canvas workflow fixture"
```

---

## 阶段 2：基于视口的 DOM 节点渲染

### 任务 2：新增纯视口裁剪工具

**文件：**
- 新建：`src/utils/canvasViewportCulling.ts`
- 新建：`src/utils/canvasViewportCulling.test.ts`

- [x] **步骤 1：编写世界坐标矩形转换和节点过滤测试**

```ts
import { describe, expect, it } from "vitest";
import { getVisibleCanvasNodeIds, getVisibleWorldRect } from "./canvasViewportCulling";
import type { GraphNode } from "../types";

const node = (id: string, x: number, y: number, width = 300, height = 220): GraphNode =>
  ({
    id,
    title: id,
    type: "image_node",
    x,
    y,
    inputs: [],
    outputs: [],
    properties: {},
    data: { imageNodeWidth: width, imageNodeHeight: height },
  }) as GraphNode;

describe("canvasViewportCulling", () => {
  it("converts screen viewport to world rect with buffer", () => {
    expect(
      getVisibleWorldRect({
        canvasSize: { width: 1000, height: 800 },
        pan: { x: -200, y: -100 },
        zoom: 2,
        bufferPx: 100,
      })
    ).toEqual({ minX: 50, minY: 0, maxX: 650, maxY: 500 });
  });

  it("keeps visible nodes and explicit exception nodes", () => {
    const ids = getVisibleCanvasNodeIds({
      nodes: [node("visible", 100, 100), node("hidden", 5000, 5000), node("selected", 6000, 6000)],
      canvasSize: { width: 1000, height: 800 },
      pan: { x: 0, y: 0 },
      zoom: 1,
      alwaysVisibleNodeIds: new Set(["selected"]),
    });

    expect(ids).toEqual(new Set(["visible", "selected"]));
  });
});
```

- [x] **步骤 2：运行失败测试**

运行：`npm test -- src/utils/canvasViewportCulling.test.ts`

预期：失败，因为工具文件尚不存在。

- [x] **步骤 3：实现工具函数**

实现以下接口：

```ts
export interface CanvasWorldRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function getVisibleWorldRect(input: {
  canvasSize: { width: number; height: number };
  pan: { x: number; y: number };
  zoom: number;
  bufferPx?: number;
}): CanvasWorldRect;

export function getVisibleCanvasNodeIds(input: {
  nodes: GraphNode[];
  canvasSize: { width: number; height: number };
  pan: { x: number; y: number };
  zoom: number;
  bufferPx?: number;
  alwaysVisibleNodeIds?: Set<string>;
}): Set<string>;
```

使用 `src/components/canvas/geometry.ts` 里已有的 `getNodeWidth` 和 `getNodeHeight`，保证带有图片/视频测量尺寸的卡片也能被一致处理。

修复备注：当 `canvasSize.width` 或 `canvasSize.height` 尚未测量出来时，裁剪工具必须返回全部节点 ID，而不是空集合。否则 DOM 节点层会被清空，但 Leafer 连线层仍然全量渲染，画布会只剩网格和线条。

- [x] **步骤 4：验证**

运行：`npm test -- src/utils/canvasViewportCulling.test.ts`

预期：通过。

- [ ] **步骤 5：提交**

```bash
git add src/utils/canvasViewportCulling.ts src/utils/canvasViewportCulling.test.ts
git commit -m "feat: add canvas viewport culling utilities"
```

### 任务 3：只渲染可视 DOM 节点

**文件：**
- 修改：`src/components/app/CanvasNodeLayer.tsx`
- 修改：`src/App.tsx`
- 测试：`src/utils/canvasViewportCulling.test.ts`

- [x] **步骤 1：为 `CanvasNodeLayer` 增加 props**

新增：

```ts
canvasSize: { width: number; height: number };
selectedNodeIds?: Set<string>;
selectedGroupNodeIds?: Set<string>;
```

使用 `getVisibleCanvasNodeIds`，主卡片 map 改为渲染 `visibleNodes`，而不是直接渲染所有 `nodes`。非 inline 的旧节点端口 hit-target map 也要与同一份 `visibleNodes` 对齐。

- [x] **步骤 2：保留交互例外节点**

始终渲染：

- 选中的节点
- 正在拖拽的节点
- 正在参与连线的节点
- 如果后续暴露了 context menu 节点，也应始终渲染

最低实现：

```ts
const alwaysVisibleNodeIds = React.useMemo(() => {
  const ids = new Set<string>();
  if (selectedNodeId) ids.add(selectedNodeId);
  if (draggingNodeId) ids.add(draggingNodeId);
  if (linkFromNodeId) ids.add(linkFromNodeId);
  if (linkToNodeId) ids.add(linkToNodeId);
  selectedNodeIds?.forEach((id) => ids.add(id));
  return ids;
}, [draggingNodeId, linkFromNodeId, linkToNodeId, selectedNodeId, selectedNodeIds]);
```

- [x] **步骤 3：从 `App.tsx` 传入 props**

把现有 `canvasSize` state 和 `selectedNodeIds` 传给 `CanvasNodeLayer`。

- [x] **步骤 4：验证类型检查**

运行：`npm run lint:types`

预期：通过。

- [ ] **步骤 5：手动冒烟测试**

运行：`npm run dev`，打开 `/canvas?projectId=<large-project-id>`，在大型项目中平移画布，确认离屏节点进入视口前后能正常出现。

- [ ] **步骤 6：提交**

```bash
git add src/App.tsx src/components/app/CanvasNodeLayer.tsx src/utils/canvasViewportCulling.ts src/utils/canvasViewportCulling.test.ts
git commit -m "feat: virtualize canvas node dom rendering"
```

---

## 阶段 3：媒体加载策略

### 任务 4：新增媒体预览加载策略

**文件：**
- 新建：`src/utils/mediaPreviewPolicy.ts`
- 新建：`src/utils/mediaPreviewPolicy.test.ts`

- [x] **步骤 1：编写策略测试**

```ts
import { describe, expect, it } from "vitest";
import { getImageLoadingMode, getVideoPreloadMode } from "./mediaPreviewPolicy";

describe("mediaPreviewPolicy", () => {
  it("does not preload passive videos", () => {
    expect(getVideoPreloadMode({ selected: false, hovered: false, playing: false })).toBe("none");
  });

  it("loads video metadata only when the user is likely to interact", () => {
    expect(getVideoPreloadMode({ selected: true, hovered: false, playing: false })).toBe("metadata");
    expect(getVideoPreloadMode({ selected: false, hovered: true, playing: false })).toBe("metadata");
    expect(getVideoPreloadMode({ selected: false, hovered: false, playing: true })).toBe("auto");
  });

  it("lazy-loads passive images", () => {
    expect(getImageLoadingMode({ selected: false, visible: true })).toBe("lazy");
    expect(getImageLoadingMode({ selected: true, visible: true })).toBe("eager");
  });
});
```

- [x] **步骤 2：实现策略函数**

实现 `getVideoPreloadMode` 和 `getImageLoadingMode` 两个纯函数。

- [x] **步骤 3：验证**

运行：`npm test -- src/utils/mediaPreviewPolicy.test.ts`

预期：通过。

- [ ] **步骤 4：提交**

```bash
git add src/utils/mediaPreviewPolicy.ts src/utils/mediaPreviewPolicy.test.ts
git commit -m "feat: add media preview loading policy"
```

### 任务 5：应用图片懒加载和视频延迟加载

**文件：**
- 修改：`src/components/canvas/ImageNodeCard.tsx`
- 修改：`src/components/canvas/VideoNodeCard.tsx`
- 修改：`src/utils/mediaPreviewPolicy.ts`

- [x] **步骤 1：更新视频 preload**

在 `VideoNodeCard.tsx` 中，把固定的 `preload="metadata"` 替换为：

```tsx
preload={getVideoPreloadMode({
  selected,
  hovered: isHovered,
  playing: isPlaying,
})}
```

- [x] **步骤 2：更新图片 loading**

对 `ImageNodeCard.tsx` 中的主要 `<img>` 元素设置：

```tsx
loading={getImageLoadingMode({ selected, visible: true })}
decoding="async"
```

对于 strip 缩略图，只让当前图和附近图 eager，其余使用 lazy。

- [x] **步骤 3：验证**

运行：

```bash
npm test -- src/utils/mediaPreviewPolicy.test.ts
npm run lint:types
```

预期：通过。

- [ ] **步骤 4：手动网络检查**

在大型画布中打开 DevTools Network。预期：未参与交互的视频不会立即请求 metadata；图片采用 lazy decode 行为。

- [ ] **步骤 5：提交**

```bash
git add src/components/canvas/ImageNodeCard.tsx src/components/canvas/VideoNodeCard.tsx src/utils/mediaPreviewPolicy.ts src/utils/mediaPreviewPolicy.test.ts
git commit -m "feat: defer passive canvas media loading"
```

---

## 阶段 4：Leafer 渲染成本优化

### 任务 6：连线渲染使用 O(1) 节点查找

**文件：**
- 修改：`src/components/canvas/LeaferCanvas.tsx`
- 修改：`src/App.tsx`
- 测试：`src/utils/canvasGraphIndex.test.ts`

- [x] **步骤 1：扩展 `LeaferCanvasProps`**

新增：

```ts
nodeById?: Map<string, GraphNode>;
```

- [x] **步骤 2：更新 `buildLinks`**

让 `buildLinks` 接收 `nodeById`，并使用：

```ts
const fromNode = nodeById?.get(link.fromNodeId) ?? getNodeById(nodes, link.fromNodeId);
const toNode = nodeById?.get(link.toNodeId) ?? getNodeById(nodes, link.toNodeId);
```

- [x] **步骤 3：从 `App.tsx` 传入索引**

向 `LeaferCanvas` 传入 `nodeById={canvasGraphIndex.nodeById}`。

- [x] **步骤 4：验证**

运行：`npm run lint:types`

预期：通过。

- [ ] **步骤 5：提交**

```bash
git add src/App.tsx src/components/canvas/LeaferCanvas.tsx
git commit -m "perf: use graph index for leafer link rendering"
```

### 任务 7：移除重复网格工作

**文件：**
- 修改：`src/components/canvas/LeaferCanvas.tsx`

- [x] **步骤 1：禁用 Leafer 网格点**

保留现有 CSS radial grid overlay，停止在 pan/zoom 时调用 `buildGrid`。Leafer 仍然负责渲染连线、shell、decorator 和 draft preview。

- [ ] **步骤 2：验证视觉一致性**

运行：`npm run dev`，打开 `/canvas`，使用 `CanvasControls` 切换网格，并执行平移、缩放。

预期：网格视觉保持一致，pan/zoom 时不再重建 Leafer 网格节点。

- [x] **步骤 3：验证类型检查**

运行：`npm run lint:types`

预期：通过。

- [ ] **步骤 4：提交**

```bash
git add src/components/canvas/LeaferCanvas.tsx
git commit -m "perf: avoid rebuilding leafer grid on viewport changes"
```

---

## 阶段 5：远端持久化成本优化

### 任务 8：抽取远端持久化策略

**文件：**
- 新建：`src/utils/remotePersistPolicy.ts`
- 新建：`src/utils/remotePersistPolicy.test.ts`
- 修改：`src/hooks/useWorkflowState.ts`

- [x] **步骤 1：编写策略测试**

```ts
import { describe, expect, it } from "vitest";
import { shouldPersistRemoteSnapshot } from "./remotePersistPolicy";

describe("remotePersistPolicy", () => {
  it("skips identical signatures", () => {
    expect(
      shouldPersistRemoteSnapshot({
        nextSignature: "same",
        lastSignature: "same",
        hasPendingRuntimeState: false,
      })
    ).toBe(false);
  });

  it("skips snapshots while non-persistable runtime state exists", () => {
    expect(
      shouldPersistRemoteSnapshot({
        nextSignature: "next",
        lastSignature: "old",
        hasPendingRuntimeState: true,
      })
    ).toBe(false);
  });

  it("persists changed stable snapshots", () => {
    expect(
      shouldPersistRemoteSnapshot({
        nextSignature: "next",
        lastSignature: "old",
        hasPendingRuntimeState: false,
      })
    ).toBe(true);
  });
});
```

- [x] **步骤 2：实现策略**

把当前围绕 `serializeRemotePersistSnapshot` 的布尔判断迁移到 `remotePersistPolicy.ts`。

- [x] **步骤 3：接入 `useWorkflowState`**

在更新 `lastRemotePersistSignatureRef` 之前，先使用 `shouldPersistRemoteSnapshot` 判断是否需要保存。

- [x] **步骤 4：验证**

运行：

```bash
npm test -- src/utils/remotePersistPolicy.test.ts
npm run lint:types
```

预期：通过。

- [ ] **步骤 5：提交**

```bash
git add src/hooks/useWorkflowState.ts src/utils/remotePersistPolicy.ts src/utils/remotePersistPolicy.test.ts
git commit -m "refactor: extract remote persist policy"
```

### 任务 9：节流全量远端快照

**文件：**
- 修改：`src/hooks/useWorkflowState.ts`
- 修改：`src/utils/remotePersistPolicy.ts`
- 修改：`src/utils/remotePersistPolicy.test.ts`

- [x] **步骤 1：新增时间策略**

新增全量快照节流常量，例如：

```ts
export const REMOTE_FULL_SNAPSHOT_MIN_INTERVAL_MS = 10_000;
```

对于新增/删除节点或连线这类结构性编辑，允许立即全量快照。对于高频位置变化，延迟到节流窗口结束或空闲 flush。

- [x] **步骤 2：追踪 dirty 类型**

在 `useWorkflowState` 中引入一个小的 dirty ref：

```ts
type RemoteDirtyKind = "none" | "position" | "content" | "structure";
const remoteDirtyKindRef = useRef<RemoteDirtyKind>("none");
```

拖拽位置更新标记为 `"position"`，属性/数据变化标记为 `"content"`，节点/连线增删标记为 `"structure"`。

- [x] **步骤 3：全量 PUT 前应用策略**

只有 dirty kind 是 `"content"` 或 `"structure"`，或者位置变化已经超过最小间隔时，才立即调用 `onRemotePersist`。

- [x] **步骤 4：验证**

运行：

```bash
npm test -- src/utils/remotePersistPolicy.test.ts
npm run lint:types
```

预期：通过。

- [ ] **步骤 5：手动检查**

连续拖动一个节点 5 秒。预期：UI 保持响应，远端全量 PUT 请求数量明显减少。

- [ ] **步骤 6：提交**

```bash
git add src/hooks/useWorkflowState.ts src/utils/remotePersistPolicy.ts src/utils/remotePersistPolicy.test.ts
git commit -m "perf: throttle full remote canvas snapshots"
```

---

## 阶段 6：可选的后端兼容 Patch API

### 任务 10：新增可选远端 Patch Helper

**文件：**
- 修改：`src/features/workspace/remoteCanvas.ts`
- 新建：`src/features/workspace/remoteCanvasPatch.test.ts`

- [ ] **步骤 1：新增 helper 形态，不替换全量 PUT**

增加在后端支持时可启用的函数：

```ts
export async function patchRemoteProjectNodes(project: {
  id: string;
  nodePatches: Array<{ id: string; x?: number; y?: number; properties?: Record<string, unknown>; data?: Record<string, unknown> }>;
}) {
  const response = await devApiFetch(`/system/canvas/${project.id}/nodes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodes: project.nodePatches }),
  });
  await parseDevApiEnvelope<unknown>(response);
}
```

- [ ] **步骤 2：保留全量 PUT 回退**

不要移除 `updateRemoteProject`。只有确认后端路由支持后，才使用 patch helper。

- [ ] **步骤 3：验证**

运行：`npm run lint:types`

预期：通过。

- [ ] **步骤 4：提交**

```bash
git add src/features/workspace/remoteCanvas.ts
git commit -m "feat: add optional remote canvas patch helper"
```

---

## 阶段 7：最终验证

### 任务 11：完整回归检查

**文件：**
- 预期不修改源码。

- [ ] **步骤 1：运行单元测试**

运行：`npm test`

预期：通过。

- [ ] **步骤 2：运行类型检查**

运行：`npm run lint:types`

预期：通过。

- [ ] **步骤 3：运行生产构建**

运行：`npm run build`

预期：通过。

- [ ] **步骤 4：大型画布手动 QA**

打开一个大型 `/canvas?projectId=...` 项目并验证：

- 初始加载不会让页面长时间冻结。
- 平移画布保持响应。
- 节点会在到达视口边缘前出现。
- 选中的离屏节点在拖拽/连线过程中不会消失。
- 视频节点不会批量加载 metadata。
- 图片节点仍能正常预览和打开。
- 编辑后自动保存仍然生效。

- [ ] **步骤 5：提交或准备 PR**

如果全部检查通过，提交剩余变更并准备分支进入 PR。

---

## 建议执行顺序

1. 阶段 1 先提供稳定的大型工作流 fixture。
2. 阶段 2 通过减少 DOM 和媒体挂载数量获得最大即时收益。
3. 阶段 3 避免媒体密集项目带来网络和解码压力。
4. 阶段 4 降低 Leafer 重绘开销。
5. 阶段 5 降低自动保存序列化和远端 PUT 压力。
6. 阶段 6 是可选项，应等后端 patch 支持确认后再做。

## 自检

- 需求覆盖：计划覆盖初始化、DOM 渲染、媒体加载、画布重绘、全量工作流持久化，以及可选后端 patch。
- 占位扫描：没有任务依赖未说明的实现细节；每个阶段都有明确文件、命令和预期结果。
- 类型一致性：新增工具沿用现有 `GraphNode`、`GraphLink`、兼容 `CanvasViewport` 的 `pan/zoom`，以及当前远端画布函数命名。
