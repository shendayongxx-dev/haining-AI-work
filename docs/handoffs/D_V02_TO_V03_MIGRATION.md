# D 快照 v0.2 → v0.3 双读迁移方案

状态：`integration-draft`

## 读取分流

- `schemaVersion: 0.2`：A/E 继续读取旧 `stages.*.strips`、`designRevision` 和 `generatedFromRevision` 路径；
- `schemaVersion: 0.3`：完整竹条只从顶层 `strips[]` 读取，阶段对象只消费 `stripIds/visibleStripIds`、交点和操作索引；
- 不允许把 v0.2 对象静默当作 v0.3，也不允许仅凭字段相似自动升级。

## 失效规则

- v0.3 使用完整 `sourceKey`；顶层重复来源字段必须逐项等于 `sourceKey`；
- v0.2 缺少完整 `sourceKey` 时标记为 `legacy-unverifiable`；旧 E 检查、材料结果和教程不得跨版本复用；
- `designRevision !== generatedFromRevision` 时，不论版本均视为异步旧结果并拒绝挂载。

## 兼容期限

- 三组 v0.3.3 案例完成 C/E 独立消费前，A/E 保持双读；
- C/E 无阻断意见后，由 A 确认停止生成新的 v0.2 快照；
- 停止生成后仍保留至少一个 v0.2 固定样例做兼容回归，删除旧读取器需另行评审。

## 状态迁移

- v0.2 通用状态不得直接映射为 v0.3 的结构通过；
- v0.3 分别记录 `structuralValidation`、`craftValidation` 和 `physicalValidation`；
- D 只负责结构校验，E 负责工艺消费结果，B/实物记录负责物理验证状态。
