# A 对 B v1.5 工艺检查的接口确认

状态：**A 侧接入决定，供 B/C/D/E 联调评审；公共格式尚未宣称全员冻结。** 依据为 B v1.5 接收闭环包、E 对该包的接收回复，以及 C 对重点图案声明的回复。接收包中的示例不是运行输入，也不是实物通过证据。

## 1. 来源键分层

检查结果的 `sourceKey` **原样复制 D 当前快照的完整 `sourceKey` 对象**，包括 `schemaVersion: "0.3"`、D 生成器版本、设计 ID 与修订、载体及编法版本、`craftRuleVersion` 和 `patternPlacementKey`。A 不裁剪字段、不把 B 的 `1.5` 写回 D 快照，也不用示例键代替真实键。

E 的结果另有 `assessmentKey`，按 B v1.5 Schema 保存 `resultSchemaVersion`、`craftRuleSetVersion`、`evidenceSetVersion`、`craftCheckEngineVersion`、`carrierType`、`carrierId`、`carrierContextHash`、`carrierSpecVersion`、`weaveId`、`weaveSpecVersion`。A 接收异步结果时逐项比较完整 `sourceKey` 与完整 `assessmentKey`；任一键变化，旧检查与拆解结果均过期。结果的 `summary` 由 `ruleResults` 重新计算并复核，不信任调用方直接提交的计数。

固定载体的 `carrierContextHash` 输入为 D 实际快照中的坐标空间、`carrierId`、`carrierSpecVersion`、正式边界、有效区、毛坯边界、手柄上下文及这些字段的版本。自定义载体使用 D 实际提供的同语义上下文；缺项以显式 `null` 参与摘要并让相关规则 `pending`，不得从形状猜测。哈希输入不包含哈希值本身，也不用 B 示例中的占位值。A/D/E 联调时用同一份真实 JSON 规定字段序列化与 SHA-256 结果，避免各端对数值和缺字段作不同解释；在此之前不将某个哈希算法实现视为已冻结。

## 2. 重点图案声明由 A 的确认设计管理

C 继续输出稳定的 `surface_pattern.elements[].elementId`、几何和 `transform`。A 在用户确认创意结果后管理可选的 `focusPatternDeclaration`：

```ts
type FocusPatternDeclaration =
  | { status: 'declared'; elementIds: string[] } // 至少一个、无重复、均引用本次已确认图样元素
  | { status: 'none'; elementIds: [] };             // 用户明确声明无重点图案
```

**声明缺失与 `none` 不同。** 缺失、未知状态、空的 `declared`、重复或悬空 ID 都使 `HANDLE_MOTIF_EXCLUSION` 保持 `pending`；明确 `none` 才允许该条件记 `notApplicable`。用户修改声明时，A 递增 `designRevision` 并重新生成当前版本快照，旧 E 结果立即失效。A 将声明与已确认候选及当前 D 快照一同提供给 E；D 不依据 `scope: motif`、颜色或面积反推重点集合。

E 计算边界时，以被引用元素的 `kind + pointsMm` 为基础，依次应用 C 图样 `transform` 和 D 快照的 `patternPlacement`，多个元素取几何并集。具体相交算法与 `polyline` 的重点语义须由 C/D/E 使用共同案例复核；未能可靠求界时规则 `pending`，不自动通过或失败。此声明是用户选择，不代表工艺批准。

## 3. 当前主站准入

- `CROSS-1X1-V1` 仅可预览结构。B v1.5 的正式检查范围不含该编法，检查页应给出 `failed / UNSUPPORTED_WEAVE` 与改选受支持编法的建议。
- E v1.5 检查代码已从 `codex/e-craft-validation` 接入当前集成目录。其“结构复核通过”仍不能映射成工艺 `passed`。
- 自定义形状缺正式有效区、毛坯、手柄声明/区域和原竹篾身份时，相关项保持 `pending`。
- 即使将来筛查状态为 `passed`，本阶段 `productionReady` 仍为 `false`，正式材料、教程、导出和制作批准保持关闭；穿织顺序仅作结构预览。

## 4. 下一轮交付

1. A：实现用户声明入口、双键过期比较及真实 `carrierContextHash` 适配；提交正反例。
2. C：确认元素 ID 与图样变换在声明期间保持稳定；提供多元素、无重点与错误引用案例。
3. D：提供自定义上下文合同与真实快照；固定载体核对哈希输入，确认图样放置后的重点边界处理。
4. E：已交付 19 项机器规则结果和真实 D 快照回归；后续与 A/C/D 对齐重点图案声明、自定义上下文和来源摘要的正式合同。
5. B：补充实物试编证据后再审议材料、收边和制作教程的正式开放条件。
