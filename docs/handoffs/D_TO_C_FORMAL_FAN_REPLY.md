# D→C：正式扇面联调回复

- 联调输入：`examples/c-to-d/fan-green-triangle.candidate.json`
- D 分支：`d/fan-structure-snapshot-v0.2`
- 接口版本：`0.2`

## 1. 可以直接读取的字段

D 已通过 `adaptConfirmedCandidateFile()` 正式读取：

- `carrier.id`、`carrier.boundaryId`、`carrier.effectivePatternBoundaryId`；
- `generation.generationId`、`generation.generationRevision`、`generation.status`；
- `generation.result.resultType`、`patternId`、`coordinateSpace`；
- `generation.result.palette`；
- `generation.result.elements`，图样点读取 `elements[].pointsMm`；
- `generation.result.transform`；
- `generation.issues`。

D 不读取旧页面视觉兼容字段 `candidate.pointsMm` 和 `candidate.color`。

## 2. 与 D 原类型的差异及处理

| C 正式 JSON | D 原运行时类型 | 当前处理 |
| --- | --- | --- |
| 顶层包含 `carrier` 与 `generation` 信封 | 原 `Candidate` 是扁平运行时对象 | 新增 `CToDCandidateFile` 和 `adaptConfirmedCandidateFile()` |
| `generation.result.resultType` 位于结果对象内部 | D 的 `SurfacePattern` 不包含判别字段 | 适配器校验后移除判别字段，再传给结构计算 |
| `elements[].sourceInputId` | D 原颜色段只保留 `sourceElementId` | 已加入 D 图样类型和颜色段输出 |
| `generation.issues` | D 原输入未显式保存 | 已正式读取；blocking 拒绝进入 D，其他问题保留在输入快照上下文 |
| 正式载体 ID 位于顶层 `carrier` | D 原来固定 A4 矩形演示边界 | 已校验三个正式 ID，并映射到圆形结构计算 |

A 的确认状态仍从 `fan-green-triangle.confirmed-by-a.json` 读取；`generationId` 和 `generationRevision` 不一致时拒绝计算。

## 3. SVG 生成结果

可以使用该 JSON 生成 SVG。SVG 和 D→E JSON 由同一次 `calculateFanStructure()` 结果驱动，不从 SVG 反向取数。

当前 SVG 使用：

- 页面坐标空间：210 × 297 mm；
- 圆心：`(105,110)`；
- 正式外轮廓半径：85 mm；
- 边界：`FAN-ROUND-170-V1 / BOUNDARY-ROUND-170-V1`；
- 图样来源：C 的绿色三角形 `pointsMm`、色板和变换。

## 4. 来源 ID 保留情况

以下 ID 均保留：

- `patternId`：保留在 D→E 快照的 `sourcePattern.patternId`；
- `elementId`：输出为颜色段的 `sourceElementId`；
- `paletteId`：保留在每个颜色段；
- `sourceInputId`：保留在每个命中图样的颜色段。

E 回传问题时可结合 `designId + generatedFromRevision + sourceElementId/sourceInputId` 定位到 C 的输入。

## 5. 正式圆形边界

是。D 已停止使用 A4 整页矩形作为竹条有效边界。每根经纬条均按半径 85 mm 的圆周计算 `startMm`、`endMm` 和 `geometryLengthMm`，SVG 使用同一圆形边界裁切。

`PATTERN-ROUND-150-V1` 继续作为 C 的有效图样区域；D 不把它误当成扇面外轮廓。

## 6. CROSS-1X1-V1 联调结果

是。当前唯一案例固定生成：

- 21 根经条；
- 21 根纬条；
- 42 根竹条合计；
- 441 个交织点；
- `top` 按一上一下奇偶关系生成；
- `weave.id` 和 `parameters.weaveId` 均为 `CROSS-1X1-V1`。

21×21 轴线布置在圆内接正方形范围内，确保 441 个交织点均位于正式圆形边界内。当前 `weave.verified` 仍为 `false`：这表示接口计算已经采用指定版本，但完整竹条参数与实物可制作性仍需 B/E 的规则和试编记录确认。

## 回归样例

- `examples/d-to-e/fan-green-triangle-revision-1.json`
- `examples/d-to-e/fan-green-triangle-revision-2.json`

两个版本使用同一 C 正式案例和同一 21×21 网格，用于验证设计版本变化及旧结果失效。
