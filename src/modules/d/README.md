# D 模块：编辑预览与结构快照

本模块读取已经确认的 C 组 `surface_pattern`、A 管理的正式设计版本和演示编法参数，以同一次计算生成 SVG 预览所需结构及 D→E 快照。

## 导出接口

```ts
import { adaptConfirmedCandidate, calculateFanStructure, StructurePreview } from './modules/d';

const input = adaptConfirmedCandidate(candidate, confirmation, options);
const snapshot = calculateFanStructure(input);
<StructurePreview snapshot={snapshot} />;
```

`calculateFanStructure(input)` 是纯函数，不读取 DOM。其输出同时用于 `StructurePreview` 和 E 组，禁止从 SVG 反推材料或竹条数据。

## 输入要求

- `schemaVersion`：当前为 `0.2`；
- `designId`、`designRevision`：由 A 管理；
- `confirmedGenerationId`：只能引用已由 A 确认的 C 候选；
- `pattern`：C 的有限色板、`polygon/polyline` 元素、A4 毫米坐标和 `offsetMm` 变换；
- `parameters`：D 当前演示密度、竹条宽度和 `plain-demo` 编法。

真实联调输入来自：

- `examples/c-to-d/fan-green-triangle.candidate.json`；
- `examples/c-to-d/fan-green-triangle.confirmed-by-a.json`。

适配器会核对生成状态、阻断问题、确认 ID 和生成版本；未确认候选不能进入结构计算。

## 输出与高亮

快照包含：版本、演示载体、有效区域、参数、竹条、颜色段、交织点、显示映射和待验证状态。颜色段保留 `sourceElementId`。

### 当前 A4 直条几何约定

- `warp` 的 `axisMm` 是竹条中心线的 X 坐标；起点为 `(axisMm, 0)`，沿 Y 正方向延伸；
- `weft` 的 `axisMm` 是竹条中心线的 Y 坐标；起点为 `(0, axisMm)`，沿 X 正方向延伸；
- 当前坐标原点在 A4 左上角，X 向右、Y 向下；边界中心线竹条的宽度仅在预览中裁切；
- `geometryLengthMm` 是从上述起点沿竹条方向计算的演示几何长度，不含损耗、收边或余量；
- `colorSegments[].fromMm/toMm` 是从竹条起点沿长度方向的距离，满足 `0 <= fromMm < toMm <= geometryLengthMm`；
- `axisMm` 和分段端点保留两位小数。E 应以每根竹条的明确坐标定位，不使用四舍五入后的 `grid.*SpacingMm` 反推。几何比较建议采用 `0.01 mm` 容差。

以上规则只适用于本轮 A4 矩形直条演示。正式扇面、自定义形状和不连续竹条需要另行增加路径、端点和局部长度定义。

### 字段语义

- `parameters.density` 表示经向和纬向各自的竹条数量，是无量纲计数，不是“每毫米密度”；
- `weave.id` 是快照采用的权威编法 ID；`parameters.weaveId` 是输入参数的同值副本，计算时必须与其一致；
- 分段 `color` 是图样映射后的视觉目标色，不代表独立采购材料，也不自动表示拼接、换条或已验证的染色工艺；
- `paletteId` 和 `sourceElementId` 分别引用当前快照所源自的 C `surface_pattern.palette` 与 `surface_pattern.elements`；问题回传时同时携带 `designId`、`generatedFromRevision` 和元素 ID；
- 快照内 `validation.source = "d-initial"` 表示 D 因缺少工艺依据给出的初始待验证提示，不是 E 已执行检查。E 的独立结果应另行保存，并携带自己的 `designId` 与 `generatedFromRevision`。

预览支持：

```ts
{ kind: 'strip', id: 'J-001' }
{ kind: 'crossing', id: 'X-J-001-W-001' }
{ kind: 'position', positionMm: { x: 130, y: 75 } }
```

## 版本规则

- `generatedFromRevision` 始终等于输入的 `designRevision`；
- A 接收异步结果时必须再次比较当前版本；
- 缩放、平移和预览模式不应触发设计版本变化；
- 图样、配色、密度、竹条宽度或编法变化应由 A 递增 `designRevision` 后重新计算。

## 运行

```bash
pnpm build
```

## 计算假设和限制

- 当前使用 210 × 297 mm 的 A4 页面演示包络；它不是正式扇面边界或有效编织区域；
- 当前 `plain-demo` 交织规则只验证数据与 SVG 接口，尚未得到 B 的工艺依据；
- 几何长度不包含损耗、收边或备料余量；
- 当前仅实现扇面 `polygon` 离散色块采样；`polyline`、自定义叶片形状和复杂几何属于后续批次；
- 当前按 A4 页面矩形生成演示网格，待 B 提供正式扇面几何后替换；
- 所有输出均标记“演示数据，待 B 验证”。

## 下一位对接人

1. A：保存稳定 `designId`，并在异步任务返回时拒绝旧版本结果覆盖；
2. E：读取快照并用 ID/毫米位置返回问题定位；
3. B：提供有来源的载体几何、竹条规格和基础编法规则；
4. D：收到 B 的资料后保留演示版，并生成可对比的工艺资料版快照。
