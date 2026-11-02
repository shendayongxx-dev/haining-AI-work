# A 对 D→E v1.5 来源与颜色精度的联调决定

状态：**A 侧接口口径，供 D、E、B、C 评审；公共 Schema 尚未全员冻结。** 依据为 E 的真实快照回归回复及当前 D v0.3 / E v1.5 实现。三组固定扇面结构回归已通过，工艺和实物结论仍为 `pending`。

## 1. 双层检查来源与载体上下文

保留两层来源，不把它们合并为一个版本号：

1. **D 负责结构来源。** 固定扇面快照继续输出完整 `sourceKey`（含 D Schema、生成器、设计版本、载体及编法规范、规则版本和图样放置键），并提供实际消费的 `coordinateSpace`、`carrierId`、`carrierSpecVersion`、`carrierGeometry.boundary`、`carrierGeometry.effectivePatternBoundary`、`carrierGeometry.handleExclusion`、`stages.rawBlank.boundary`。D 不写 E 的 `assessmentKey`，也不伪造 B 的实物结论。现有固定扇面快照已有这些原始字段，无须为了本轮回归另造一份几何副本。
2. **E 负责检查来源。** 结果中的 `sourceKey` 原样复制 D 当前快照；`assessmentKey` 由 E 输出，包含结果 Schema、B 规则集、证据集、检查引擎、载体与编法规范版本，以及从上述**真实载体上下文**计算的 `carrierContextHash`。哈希值不作为 D 的权威输入，也不反向写入 D 快照。工艺筛查结果、规则记录和依据由 E 输出。
3. **A 负责接收与失效。** A 提供当前 `designId`、`designRevision`、`confirmedGenerationId`，接收时核对完整 D `sourceKey` 与完整 E `assessmentKey`；任一输入或检查版本变化，旧结果及拆解预览失效。A 不以状态计数或“结构通过”代替实物工艺通过。

固定载体上下文摘要的候选输入字段依次为：`carrierType`、`carrierId`、`carrierSpecVersion`、`coordinateSpace`、`boundary`、`effectivePatternBoundary`、`rawBlankBoundary`、`handleExclusion`。几何对象自身携带的版本保留在对象内。字段缺失时使用显式 `null`，不得猜测轮廓、柄区或版本；摘要不包含哈希值本身。A、D、E 应以同一份真实 JSON 固定字段名、嵌套序列化、数值表示、缺失值和 SHA-256 测试向量，再将其写入公共合同。当前 E 的摘要实现是联调适配，**不因回归通过而自动冻结算法**。

自定义形状 v0.2 尚无 D 正式 `sourceKey`、独立有效区、毛坯和手柄上下文。E 现有投影须继续标明来源是临时适配，不得称为 D 正式来源；缺项对应规则继续 `pending`。D 提供这些真实字段后，再由 A/D/E/B 共同确认自定义公共合同。

## 2. 颜色边界精度

**本轮保留 D 的 0.5 mm 中点采样，用于结构和视觉预览；不据此宣布有效区边缘的精确颜色分区已通过。** E 继续将依赖该精度的 `OUTER_BASE_WEAVE_CONTINUITY` 保持 `pending`。现有 `COLOR_SEGMENT_COVERAGE` 的 `passed` 仅表示已输出颜色段连续覆盖及来源关系，不表示边界交点精确或材料可制作。

`0.5 mm` 是采样步长，不是对所有图案都成立的最大边界误差。单一、孤立的边界转变在中点分类下通常落在半个采样步长附近；窄于采样单元的色块或同一单元内多次切换可能被漏掉。因此页面和合同只写“0.5 mm 中点采样、边界近似”，不写无条件的“最多误差 0.5 mm”。

待 D/E 评审后，由 D 在快照中明确输出颜色分段方法元数据，建议为 `method: midpoint-sampling`、`stepMm: 0.5`、`unit: mm`、`boundaryPrecision: approximate`；E 消费并显示对应限制。新增字段须按 `AGENTS.md` 经受影响成员确认后再改公共 Schema。若 B 后续给出边缘工艺容差或某条规则要求精确交点，再由 D 实现边界与竹条的精确求交，并以共同案例比较两种算法；在此之前 D 不自行替换算法，E 不放宽 pending。

## 3. 下一轮交接

- D：确认上述真实字段及版本来源，提供一份固定扇面和一份自定义形状快照；保持当前采样算法，准备方法元数据提案。
- E：确认 `sourceKey` 原样复制、`assessmentKey` 字段及摘要输入；给出真实 JSON 的规范化序列化与 SHA-256 正反例；保持精度相关规则 pending。
- B：确认颜色边界是否存在实物工艺容差与验证依据；未有依据时不批准正式制作。
- A：汇总共同样例并更新 `docs/DESIGN_DATA.md`，仅在 A/C/D/E/B 完成公共字段评审后标记冻结。
