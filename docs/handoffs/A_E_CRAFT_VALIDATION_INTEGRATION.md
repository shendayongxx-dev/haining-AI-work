# A / E：工艺检查主站接入记录

## 本次范围

主站的“提交工艺检查”现在将当前设计版本的 D 结构快照及 A 当前 `designId`、`designRevision`、`confirmedGenerationId` 传给 E v1.5 `validateCraft(input)`。E 的检查组件展示 19 项规则记录、总体状态、问题位置、原因、修改建议及依据；平编演示另列 `UNSUPPORTED_WEAVE / failed`。E 代码来源为 `codex/e-craft-validation` 的 `df1ce5472698bca05e9f06fec6563b0d82b1ddac`，包含 B v1.5 机器规则、结果 Schema 和 Ajv 运行时校验。

固定扇面结构复核通过后可以查看从当前快照生成的穿织顺序**预览**，按竹条 ID 和交点操作分组。备料长度缺失时保持未知，不从几何长度推算采购量。结构复核失败时阻止进入拆解预览。

## 验证状态与下一步

- E 的结构复核通过只表示数据关系通过独立检查，不表示真实可制作。
- B 的实物试编尚未完成；受支持编法的共同案例总体保持 `pending`，平编演示为 `failed / UNSUPPORTED_WEAVE`。正式材料、制作教程和导出保持关闭。
- 自定义形状现已调用 E v1.5 的几何与交点检查；完整有效区、毛坯、手柄和原竹篾身份仍缺失，相关规则保持 `pending`。
- 一键改用课程十字编只针对不受支持的平编，改选后仍需重新检查，不代表已验证可制作。

下一步由 B 提供可追溯的材料规格、边缘和连接处规则、备料余量与真实制作顺序及试编记录；A/C/D/E 继续对齐重点图案声明与自定义上下文。公共接口若需调整，按 `AGENTS.md` 组织受影响成员评审。

## 联调与复现

- 数据格式：D `StructureSnapshotV03`（`schemaVersion: 0.3`），E 结果原样携带 D `sourceKey`，另有 B/E `assessmentKey` 与完整输入摘要。
- 共同案例：三种固定扇面 × 四种编法的当前 D 快照均通过 E 结构复核；其中平编正式检查失败，其余保持待验证。设计版本变化后旧结果拒收。
- 运行：`pnpm build`、`node scripts/test-e-integration.mjs`。
- 本次未宣称任何组合已通过工艺或实物验证，也未发布网站。
