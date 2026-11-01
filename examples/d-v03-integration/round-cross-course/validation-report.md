# FAN-ROUND-170-V1 + CROSS-COURSE-2X2-V1 验证报告

- 自动检查：通过
- 快照状态：`pending`
- 实物验证：`not-completed`
- 毛坯竹条：42 根
- 毛坯交点：441 个
- 裁切后可见交点：285 个
- 工程预警：1 项，均为 `review/pending`

## 自动检查

| 检查项 | 结果 | 说明 |
|---|---|---|
| `source-key-complete` | PASS | 完整来源键与快照顶层字段一致。 |
| `crossing-matrix-count` | PASS | 441/441 个毛坯交点。 |
| `weave-matrix-exact` | PASS | 全部交点的 topStripId 与 CROSS-COURSE-2X2-V1 权威循环矩阵一致。 |
| `weaving-order-links` | PASS | 441 条操作均关联交点、工作条与挑压动作。 |
| `weaving-order-sequence` | PASS | 每根纬条的操作按经条顺序完整排列，可直接分组生成逐条编织步骤。 |
| `visible-segment-backlinks` | PASS | 285 个裁切后可见交点具有双向 segmentId/crossingId 引用。 |
| `color-segment-coverage` | PASS | 颜色段连续覆盖全部可见段，坐标为原竹条毛坯起点偏移。 |
| `boundary-clipping-endpoints` | PASS | 全部可见段端点位于载体边界，未发现整页直条残留。 |
| `unknown-materials-null` | PASS | 未确认备料长度、余量及裁切余量全部为 null。 |
| `risk-status-pending` | PASS | 1 项风险均保持 review/pending。 |

## 边界裁切检查

- 先按 189×189 mm 毛坯建立全局竹条、交点矩阵及连续挑压相位，再按载体边界生成 `visibleSegments[]`。
- 裁切不改变 `stripId`、竹条方向、顺序、节距或交点相位；可见交点通过 `warpSegmentId` / `weftSegmentId` 双向追溯。
- 有效图样区只控制颜色映射；外侧区域继续显示基础编法，不截断竹条。

## pending 风险

- `PHYSICAL-VALIDATION`：尚无真实测量、试编照片或实物验收记录（pending）。
- `WARN-ROUND-HANDLE-REINFORCEMENT`：手柄区保留基础竹编，图样需避让且连接区域需人工复核加固。（pending）

## 验证方法

在仓库根目录运行：

`node scripts/verify-d-v03-cases.mjs`

SVG 仅作结构预览；JSON 是 E 组消费的权威数据源。
