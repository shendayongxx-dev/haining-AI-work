# D → C：结构快照 v0.3.2 接口收敛回复

状态：`changes-addressed-awaiting-review`

D 已接受 C 对 v0.3 公共接口提案的评审意见。本轮只收敛 D→E 快照对象树、版本兼容和状态语义，不改变 C→A `surface_pattern` 输入合同，也不宣称接口已冻结或可直接合入 `main`。

## 1. 唯一竹条对象树

- 顶层 `strips[]` 是完整竹条对象的唯一权威位置；
- `stages.rawBlank` 只保存 `stripIds[]`、毛坯边界、交点和穿织操作；
- `stages.trimmedProduct` 只保存 `visibleStripIds[]`、成品边界和 `visibleCrossingIds[]`；
- JSON 中不再出现 `stages.rawBlank.strips[]` 或 `stages.trimmedProduct.strips[]` 两份复制对象。

## 2. v0.2 → v0.3 迁移

- v0.3.2 同时保留 `designRevision` 和 `generatedFromRevision`；
- A/E 按 `schemaVersion` 双读，v0.2 保留旧路径，v0.3 读取顶层 `strips[]`；
- 缺少完整 `sourceKey` 的 v0.2 快照标记为 `legacy-unverifiable`，不得复用旧检查、材料结果或教程；
- 迁移方案见 `docs/handoffs/D_V02_TO_V03_MIGRATION.md`。

## 3. 状态责任域

```json
{
  "structuralValidation": {
    "status": "passed",
    "validatorVersion": "D-STRUCTURE-VALIDATOR-v0.3.2"
  },
  "craftValidation": {
    "status": "pending",
    "owner": "E"
  },
  "physicalValidation": {
    "status": "not-completed",
    "owner": "B"
  }
}
```

通用 `validationStatus` 已删除。

## 4. 字段与不变量

- `visibleSegments[]` 统一按 `stripOffsetStartMm` 升序排列；
- motif 颜色段必须同时提供 `paletteId/sourceElementId/sourceInputId`；base 与 outer-base 三个来源字段必须全部为 `null`；
- `paletteId` 非空时，解析后的 `color` 必须与 `sourcePattern.palette` 对应值一致；
- 顶层来源字段与 `sourceKey` 必须逐项全等；
- `designRevision` 必须等于 `generatedFromRevision`；
- JSON Schema：`data/D_STRUCTURE_SNAPSHOT_V0_3.schema.json`；
- TypeScript 类型和跨字段运行时检查位于 `src/modules/d/v03/`。

## 5. 范围措辞

文档已改为“六种候选载体、三种候选编法”。v0.3.2 是 D→E 数据能力扩展，不自动改变 A 当前的 `fan | custom` 产品枚举，也不表示任何组合已通过实物验证。

## 6. 当前门禁

三组案例已按 v0.3.2 重生成并通过 D 侧结构回归。请 C 复核对象树、来源字段和迁移策略；请 E 重新独立消费。C/E 均无阻断意见后，再由 A 决定是否冻结和合入 `main`。
