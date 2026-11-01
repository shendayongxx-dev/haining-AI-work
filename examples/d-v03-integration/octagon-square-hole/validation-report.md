# FAN-OCTAGON-170-V1 + SQUARE-HOLE-1X1-V1 验证报告

- 自动检查：通过
- 结构验证：`passed`
- 工艺验证：`pending`
- 实物验证：`not-completed`
- 毛坯竹条：26 根
- 毛坯交点：169 个
- 裁切后可见交点：109 个
- 工程预警：2 项，均为 `review/pending`

## 自动检查

| 检查项 | 结果 | 说明 |
|---|---|---|
| `source-key-complete` | PASS | 完整来源键与快照顶层字段一致。 |
| `revision-current` | PASS | designRevision 与 generatedFromRevision 一致。 |
| `canonical-strips-unique` | PASS | 顶层 strips[] 是唯一完整竹条对象树，stripId 无重复。 |
| `raw-stage-strip-index` | PASS | rawBlank.stripIds 与顶层 strips[] 顺序及数量完全一致。 |
| `trimmed-stage-strip-index` | PASS | trimmedProduct.visibleStripIds 仅索引具有可见段的顶层竹条。 |
| `segment-offset-order` | PASS | 所有 visibleSegments[] 按 stripOffsetStartMm 升序排列。 |
| `color-source-semantics` | PASS | motif 来源字段必填，base/outer-base 来源字段统一为 null。 |
| `crossing-matrix-count` | PASS | 169/169 个毛坯交点。 |
| `weave-matrix-exact` | PASS | 全部交点的 topStripId 与 SQUARE-HOLE-1X1-V1 权威循环矩阵一致。 |
| `weaving-order-links` | PASS | 169 条操作均关联交点、工作条与挑压动作。 |
| `weaving-order-sequence` | PASS | 每根纬条的操作按经条顺序完整排列，可直接分组生成逐条编织步骤。 |
| `visible-segment-backlinks` | PASS | 109 个裁切后可见交点具有双向 segmentId/crossingId 引用。 |
| `invisible-segment-refs-cleared` | PASS | 全部 visible=false 交点的成品 segmentId 均为 null。 |
| `weaving-order-trimmed-refs` | PASS | weavingOrder 的可见状态与两个成品段引用一致。 |
| `visible-crossing-ids-exact` | PASS | visibleCrossingIds 与 crossings.visible=true 集合完全一致。 |
| `color-segment-coverage` | PASS | 颜色段连续覆盖全部可见段，坐标为原竹条毛坯起点偏移。 |
| `boundary-clipping-endpoints` | PASS | 全部可见段端点位于载体边界，未发现整页直条残留。 |
| `unknown-materials-null` | PASS | 未确认备料长度、余量及裁切余量全部为 null。 |
| `risk-status-pending` | PASS | 2 项风险均保持 review/pending。 |

## 边界裁切检查

- 先按 189×189 mm 毛坯建立全局竹条、交点矩阵及连续挑压相位，再按载体边界生成 `visibleSegments[]`。
- 裁切不改变 `stripId`、竹条方向、顺序、节距或交点相位；可见交点通过 `warpSegmentId` / `weftSegmentId` 双向追溯。
- 有效图样区只控制颜色映射；外侧区域继续显示基础编法，不截断竹条。

## pending 风险

- `PHYSICAL-VALIDATION`：尚无真实测量、试编照片或实物验收记录（pending）。
- `WARN-OPEN-HALF-HOLE-EDGE`：开放网格边缘可能形成半孔，需人工检查收边固定。（pending）
- `WARN-OCTAGON-CORNER`：八角转角一条宽度范围内的竹条需人工复核加固。（pending）

## 验证方法

在仓库根目录运行：

`node scripts/verify-d-v03-cases.mjs`

SVG 仅作结构预览；JSON 是 E 组消费的权威数据源。
