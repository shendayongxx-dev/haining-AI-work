# D 对 B 组 v0.3 接口评审的修订回复

状态：`re-review`
接口工艺状态：`validationStatus: pending`
实物验证：`not-completed`

D 已接受 B 组 `changes-requested` 结论，并完成三项阻断修订。

## 1. 双向追溯链已补齐

- 每个 `visibleSegment` 增加 `ordinal`、`stripOffsetStartMm`、`stripOffsetEndMm` 和 `crossingIds`；
- 每个交点增加 `warpStripId/warpSegmentId`、`weftStripId/weftSegmentId` 和 `topStripId`；
- `visibleSegment.crossingIds` 与交点段 ID 必须双向一致；
- `weavingOrder` 同时引用工作竹篾、参考竹篾、交点及裁切后的两个段 ID。

## 2. 短段示例已改为可复算数据

示例统一为：

```text
V003-S01.lengthMm = 17.8 mm
measuredValueMm = 17.8 mm
pitchMm = 9 mm
referenceValueMm = 18 mm
comparisonOperator = "<"
17.8 < 2 × 9
```

该结果只触发 `pending/review` 工程预警，不表示工艺 FAIL。

## 3. 颜色坐标已统一为毛坯竹篾全局偏移

- 删除段内重新从 0 开始的正式坐标表达；
- 正式字段改为 `stripOffsetStartMm/stripOffsetEndMm`；
- 原点固定为 `rawBlankSegment.startMm`，沿竹篾方向递增；
- E 如需段内局部距离，可用颜色段全局偏移减去可见段 `stripOffsetStartMm`，不再保存第二套权威坐标。

## 4. 其他补充已纳入

- `segmentId` 按毛坯正方向稳定排序，过滤容差内零长度或相切碎片；
- 外侧连续性增加 `preserveOrder/preserveThickness/preserveWeavingOrder`；
- 边界改为引用 `carriers.json` 的 `boundary/effectivePatternBoundary` 字段，不使用 B 尚未发布的独立边界 ID；
- D 输出统一使用 `generatedFromRevision`，并要求计算时与 A 输入 `designRevision` 一致；
- 材料长度拆分为备料、毛坯、可见、装夹余量和裁切几何差值；采购仍只读取 `stockLengthMm`；
- 圆扇手柄区固定引用 `CARRIER-SPEC-v1.2 / ROUND-HANDLE-v1.1` 的 `x=95..115, y=170..195 mm`。

请 B 组复核修订后的《D：结构快照 v0.3 公共接口提案》。若上述三项阻断已解除，请将接口评审结论更新为：

```text
accepted-for-integration
validationStatus: pending
physicalValidation: not-completed
```

该结论只表示接口可进入三组结构案例联调，不代表正式工艺、材料、收边或教程已经通过实物验收。
