# D 模块：编辑预览与结构快照

## 自定义形状当前联调状态

`CustomStructurePreview` 现在将 C 已确认的闭合 `carrier_shape` 轮廓作为裁切区域，绘制可随根数、竹条宽度、颜色和缩放调整的挑一压一竹条结构示意。进入编辑页时不再退回实心形状预览。此组件尚未输出与圆扇 `calculateFanStructure` 等价的逐根竹条、交点与材料快照；E 工艺检查仍为 `pending`，不得把该示意图标为可制作。后续 D/B/E 联调需补齐自定义形状的结构快照与工艺边界。

本模块正式读取 A 管理的完整 confirmed Design，从其中取得已确认的 C 组 `surface_pattern`、设计版本和演示编法参数，以同一次计算生成 SVG 预览所需结构及 D→E 快照。

## 导出接口

```ts
import { adaptConfirmedDesign, calculateFanStructure, StructurePreview } from './modules/d';

const input = adaptConfirmedDesign(confirmedDesign, options);
const snapshot = calculateFanStructure(input);
<StructurePreview snapshot={snapshot} />;
```

`calculateFanStructure(input)` 是纯函数，不读取 DOM。其输出同时用于 `StructurePreview` 和 E 组，禁止从 SVG 反推材料或竹条数据。

## 输入要求

- `schemaVersion`：当前为 `0.2`；
- `designId`、`designRevision`：由 A 管理；
- `confirmedGenerationId`：只能引用已由 A 确认的 C 候选；
- `carrier`：固定读取 `FAN-ROUND-170-V1`、`BOUNDARY-ROUND-170-V1` 和 `PATTERN-ROUND-150-V1`；
- `generation.result`：正式读取 `palette`、`elements`、`transform`，图样点位于 `elements[].pointsMm`；
- `generation.issues`：阻断问题会拒绝进入 D，其他问题原样保留；
- `parameters`：默认每方向 21 根竹条，并允许9–41根的结构演示调节；偏离21时快照增加 `STRIP_COUNT_NONCONFORMING`，工艺状态保持 `pending`。

D 不读取旧页面兼容字段 `candidate.pointsMm` 或 `candidate.color`。

正式联调输入来自：

- `examples/a-to-d/fan-green-triangle.confirmed-design.json`。

适配器会核对 `confirmedGenerationId`、`activeGenerationId`、确认版本、生成状态和 blocking 问题；未确认或版本不一致的 Design 不能进入结构计算。旧的“C候选＋单独确认文件”仅保留兼容，不作为长期正式接口。

## 输出与高亮

快照包含：版本、演示载体、有效区域、参数、竹条、颜色段、交织点、显示映射和待验证状态。颜色段保留 `sourceElementId`。

### 当前正式圆扇几何约定

- 坐标空间仍为 210 × 297 mm，圆心 `(105,110)`、外轮廓半径 85 mm；
- `warp.axisMm` 是竹条中心线的 X 坐标，`weft.axisMm` 是中心线的 Y 坐标；
- 每根竹条提供圆周裁切后的 `startMm`、`endMm` 和 `geometryLengthMm`；
- 21 经和 21 纬的轴线落在圆内接正方形范围内，因此 441 个笛卡尔交点全部位于圆形边界内；
- `geometryLengthMm` 不含损耗、收边或余量；
- `colorSegments[].fromMm/toMm` 是从竹条起点沿长度方向的距离，满足 `0 <= fromMm < toMm <= geometryLengthMm`；
- `axisMm` 和分段端点保留两位小数。E 应以每根竹条的明确坐标定位，不使用四舍五入后的 `grid.*SpacingMm` 反推。几何比较建议采用 `0.01 mm` 容差。

以上规则只适用于本轮 `FAN-ROUND-170-V1 + CROSS-1X1-V1` 联调。`weave.verified` 仍为 `false`，表示尚未用完整 B 规则和实物试编认证可制作性。

### 字段语义

- `parameters.density` 表示经向和纬向各自的竹条数量，是无量纲计数，不是“每毫米密度”；
- `weave.id` 是快照采用的权威编法 ID；`parameters.weaveId` 是输入参数的同值副本，计算时必须与其一致；
- 分段 `color` 是图样映射后的视觉目标色，不代表独立采购材料，也不自动表示拼接、换条或已验证的染色工艺；
- `paletteId`、`sourceElementId` 和 `sourceInputId` 分别保留 C 的色板、图形元素和输入笔迹来源；问题回传时同时携带 `designId`、`generatedFromRevision` 和来源 ID；
- 快照内 `validation.source = "d-initial"` 表示 D 因缺少工艺依据给出的初始待验证提示，不是 E 已执行检查。E 的独立结果应另行保存，并携带自己的 `designId` 与 `generatedFromRevision`。

预览支持：

```ts
{ kind: 'strip', id: 'V001' }
{ kind: 'crossing', id: 'X-V001-H001' }
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

- 当前使用 B 提供的 `FAN-ROUND-170-V1` 圆形边界和 `PATTERN-ROUND-150-V1` 有效图样区；
- 默认按 `CROSS-1X1-V1` 生成 21 经×21 纬和 441 个交织点；根数 9–41 仅供结构演示，编号随根数生成（默认 `V001–V021`、`H001–H021`）；
- 当前是 `trimmed-circle-demo` 圆形演示结构，不是 B v0.3 的 189×189 mm 毛坯；快照以 `nonconforming-demo / pending` 记录差异；
- 当前3/3.5 mm演示宽度不符合9±0.5 mm，且缺少厚度与备料长度，不得作为B标准PASS样例；
- SVG 按交织点 `top` 绘制局部上下压挑，并展示排列和配色；这仍是结构示意预览，尚未经工艺验证；
- 几何长度不包含损耗、收边或备料余量；
- 当前仅实现扇面 `polygon` 离散色块采样；`polyline`、自定义叶片形状和复杂几何属于后续批次；
- 所有输出均标记“演示数据，待 B 验证”。

## 下一位对接人

1. A：保存稳定 `designId`，并在异步任务返回时拒绝旧版本结果覆盖；
2. E：读取快照并用 ID/毫米位置返回问题定位；
3. B：补充 `CROSS-1X1-V1` 的完整竹条参数和实物试编记录；
4. D：完整规则到位后提升验证状态，不改变当前来源 ID 和版本关联方式。
