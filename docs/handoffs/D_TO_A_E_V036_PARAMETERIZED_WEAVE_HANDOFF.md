# D → A / E：v0.3.6 四编法参数化联调

状态：`ready-for-integration-review`。本次是 v0.3.4 的向后兼容扩展，不代表工艺或实物验证通过。

> A 网页接入范围与 D 引擎能力不同：当前页面仅圆形扇面开放平编；长圆式、八角式只开放另外三种编法。三种扇面均开放参数调节。见 [A 的页面准入说明](A_D_V036_UI_GATE.md)。

## 改动

- 圆形、长圆式、八角式统一支持平编、课程版十字编、人字编和四角孔编。
- 四种编法统一使用 D v0.3.6 结构生成器，不再让圆扇平编走旧版固定路径。
- `StructureV03Input.gridParameters` 接收 `warpCount`、`weftCount`、`stripWidthMm` 和系统自动计算的 `pitchMm`。页面只开放条数和宽度，间距与净孔为只读结果。
- `patternPlacement.scale` 记录 60%～140% 图样大小；C 的 `sourcePattern` 保持不变，D 依据放置参数重算颜色段。
- 参数改变后重新生成 `strips`、`crossings`、`visibleSegments`、`weavingOrder` 和 `grid`，不存在仅修改 SVG 的情况。
- 网格必须从四个方向完整覆盖 189×189 mm 毛坯，且 `pitchMm >= stripWidthMm`。页面调整条数或宽度时会自动重算间距，不再开放间距滑杆。

## 平编身份

`CROSS-1X1-V1` 是 D 候选编法：

- `weaveSpecVersion: D-CANDIDATE-WEAVE-v0.1`
- `craftRuleVersion: CRAFT-CROSS-1X1-DEMO-v1`
- `craftValidation.status: pending`
- `physicalValidation.status: not-completed`

课程版十字编、人字编和四角孔编继续保留 `WEAVE-SPEC-v1.2`。D 没有修改 B 的权威规则文件。

## E 消费要求

- 按快照实际 `grid`、`strips`、`crossings` 和 `weavingOrder` 生成步骤，不假定固定 21×21。
- 任一参数调整都会递增 `designRevision`，旧检查、材料和教程应失效。
- 平编及所有自定义参数快照均保持工艺 `pending`，不自动转换为 PASS/FAIL。

## 验证

- 三种载体 × 四种编法，共 12 种默认组合通过。
- 12 种组合使用 15×15、6 mm 宽及自动铺满间距重新生成后全部通过。
- 来源合同的 10 项篡改测试继续全部拒绝。
- TypeScript 和 Vite 生产构建通过。
