# D→E 真实快照联调交接

## 固定扇面 v0.3

三组快照均由 `calculateStructureV03()` 重新生成，并通过仓库验证器：

| 案例 | JSON | 竹条 | 毛坯交点 | 成品可见交点 |
|---|---|---:|---:|---:|
| 圆扇＋课程十字编 | `../d-v03-integration/round-cross-course/structure-snapshot.json` | 42 | 441 | 285 |
| 长圆式＋人字编 | `../d-v03-integration/oval-herring/structure-snapshot.json` | 42 | 441 | 259 |
| 八角式＋四角孔编 | `../d-v03-integration/octagon-square-hole/structure-snapshot.json` | 26 | 169 | 109 |

三组均包含完整 `sourceKey`、唯一顶层 `strips[]`、`stages.rawBlank.crossings`、`stages.rawBlank.weavingOrder`、裁切后 `visibleSegments[]` 双向交点引用以及三个验证状态域。

## 自定义形状当前能力

当前自定义形状输出仍为独立的 `schemaVersion: 0.2`，可以提供：

- `designId/designRevision/generatedFromRevision`
- `confirmedGenerationId/shapeId`
- 毫米坐标空间和裁切后的 `boundary`
- 编法 ID 与规则版本
- 参数：密度、竹条宽度、经纬颜色、形状缩放
- 裁切后的竹条段：段 ID、方向、轴序号、段序号、轴位置、宽度、颜色、端点、几何长度
- 交点：交点 ID、关联经纬段、毫米位置和 `top`
- `craft.status: pending`

当前明确缺少，不能按固定扇面 v0.3 方式提供：

- 独立 `effectivePatternBoundary`
- `rawBlankBoundary` 和 `rawBlank/trimmedProduct` 双阶段
- 手柄或连接区声明
- 原竹篾 `stripId` 与多个 `visibleSegments[]` 的稳定身份映射（当前 ID 是裁切段 ID）
- `sourceKey/creativeSource/sourcePattern`
- `weavingOrder`
- 备料长度、厚度、余量和废料字段
- `structuralValidation/craftValidation/physicalValidation` 分域
- C 生成问题、D 工程预警的输出链

以上缺项保持缺失，不用 `null` 或推算值伪造。自定义形状 v0.2 不属于本轮固定扇面 v0.3 冻结范围。

## 失效样例

- 正常版本：`../d-v03-integration/round-cross-course/structure-snapshot.json`
- 修改版本：`./round-cross-course.revision-2.json`

修改版本将 `designRevision/generatedFromRevision` 从 1 改为 2，并将图样缩放从 1 改为 1.1；两份均由计算器生成并通过校验。完整 `sourceKey` 已发生变化，E 应使旧检查、材料和教程结果失效。
