# D 模块：编辑预览与结构快照

本模块读取已经确认的 C 组 `surface_pattern`、A 管理的正式设计版本和演示编法参数，以同一次计算生成 SVG 预览所需结构及 D→E 快照。

## 导出接口

```ts
import { calculateFanStructure, StructurePreview } from './modules/d';

const snapshot = calculateFanStructure(input);
<StructurePreview snapshot={snapshot} />;
```

`calculateFanStructure(input)` 是纯函数，不读取 DOM。其输出同时用于 `StructurePreview` 和 E 组，禁止从 SVG 反推材料或竹条数据。

## 输入要求

- `schemaVersion`：当前为 `0.2`；
- `designId`、`designRevision`：由 A 管理；
- `confirmedGenerationId`：只能引用已确认的 C 候选；
- `pattern`：C 的有限色板、`polygon/polyline` 元素和毫米变换；
- `parameters`：D 当前演示密度、竹条宽度和 `plain-demo` 编法。

仓库目前尚未包含 C 实际交付的 `examples/c-to-d/fan-green-triangle.json`。在该文件合入前，不能把 D 自建输入称为 C 的真实输出，也不能完成 C→A→D 的最终验收。

## 输出与高亮

快照包含：版本、演示载体、有效区域、参数、竹条、颜色段、交织点、显示映射和待验证状态。颜色段保留 `sourceElementId`。

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

- 当前扇面边界为 `DEMO_FAN_BOUNDARY_V0.1`，不是工艺尺寸；
- 当前 `plain-demo` 交织规则只验证数据与 SVG 接口，尚未得到 B 的工艺依据；
- 几何长度不包含损耗、收边或备料余量；
- 当前仅实现扇面 `polygon` 离散色块采样；`polyline`、自定义叶片形状和复杂几何属于后续批次；
- 当前边界采用仓库演示三角形有效区，待 B 的载体几何替换；
- 所有输出均标记“演示数据，待 B 验证”。

## 下一位对接人

1. C：提交符合 `DESIGN_DATA.md` V0.2 的真实绿色三角形 JSON；
2. A：将确认态、`designId/designRevision` 与模块调用接入 `App.tsx`，并拒绝旧版本结果覆盖；
3. E：读取快照并用 ID/毫米位置返回问题定位；
4. B：提供有来源的载体几何、竹条规格和基础编法规则。
