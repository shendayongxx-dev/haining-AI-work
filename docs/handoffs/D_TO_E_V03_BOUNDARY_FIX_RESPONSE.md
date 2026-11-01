# D → E：v0.3 边界交点修复回复

针对 E 对提交 `983c7cd` 的独立消费结果，D 已修复长圆式 2 个、八角式 6 个边界交点的 `visible` 与成品段引用冲突。

## 修复口径

- 长圆式顶部、底部两个点是载体轮廓与纬条轴线的零长度相切。相切竹条没有成品可见段，因此交点继续为 `visible: false`，并将 `warpSegmentId`、`weftSegmentId` 及 `weavingOrder.trimmedProduct` 的两个段引用统一设为 `null`。
- 八角式六个点位于正式多边形边界，且经、纬竹条均存在非零可见段，因此按闭合边界规则改为 `visible: true`，保留两个成品段 ID，并同步写入两个 `visibleSegments[].crossingIds` 和 `visibleCrossingIds`。
- 多边形边界判断增加 `0.01 mm` 点到线段容差，边界点视为轮廓内部；零长度相切段仍不生成。

## 版本

- `schemaVersion`: `0.3`（不变）
- `structureGeneratorVersion`: `D-STRUCTURE-v0.3.3`（边界修复保留，并叠加公共对象树与 C 来源合同收敛）
- 工艺及实物状态：继续保持 `pending / not-completed`

v0.3.3 同时收敛了竹条对象树与 C 来源合同：完整竹条改从顶层 `strips[]` 读取；`stages.rawBlank.stripIds[]` 与 `stages.trimmedProduct.visibleStripIds[]` 仅作为阶段索引；新增 `creativeSource` 与不可变 `sourcePattern`。旧的两个 `stages.*.strips[]` 已删除，请 E 按 `schemaVersion` 双读，不要把 v0.2 读取路径直接套用到 v0.3.3。

## 修复结果

### 长圆式 2 个相切点

- `X-V011-H001`: `visible=false`，两个成品段引用均为 `null`
- `X-V011-H021`: `visible=false`，两个成品段引用均为 `null`

长圆式可见交点总数仍为 259。

### 八角式 6 个边界点

- `X-V010-H002`
- `X-V011-H003`
- `X-V012-H004`
- `X-V012-H010`
- `X-V011-H011`
- `X-V010-H012`

以上交点均为 `visible=true`，并具有完整的经、纬 `segmentId`。八角式可见交点总数由 103 修正为 109。

## 新增回归检查

1. `visible=false` 的交点不得保留任何成品段 ID；
2. `visible=true` 的交点必须同时具有经、纬成品段 ID；
3. `weavingOrder` 的 `visible` 与两个成品段引用必须一致；
4. 每个可见交点必须出现在经、纬两个 `visibleSegments[].crossingIds` 中；
5. `visibleCrossingIds` 必须与 `crossings[].trimmedProduct.visible=true` 的集合完全一致；
6. 三组案例继续校验编法矩阵、操作顺序、颜色覆盖、边界端点和材料空值规则。

请 E 使用重新生成的三组 `structure-snapshot.json` 再次独立消费。本回复只表示冲突已修复并通过 D 侧回归检查，不提前宣称 E 消费通过或工艺验证通过。
