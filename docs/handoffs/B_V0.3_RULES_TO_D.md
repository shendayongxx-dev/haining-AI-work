# A → D：B v0.3 原始规则文件

来源：用户提供的 `竹编DIY_B组正式交接包_v0.3.zip`。以下四份文件从压缩包逐字节提取，未改写内容：

| 文件 | 用途 |
| --- | --- |
| [`../CRAFT_RULES.md`](../CRAFT_RULES.md) | 竹篾规格、编织、裁剪、包边与制作步骤 |
| [`../FORMAL_CARRIER_SPEC.md`](../FORMAL_CARRIER_SPEC.md) | A4 毫米坐标、170 mm 圆扇、150 mm 图样区、189 mm 毛坯 |
| [`../../data/CROSS_WEAVE_V1.json`](../../data/CROSS_WEAVE_V1.json) | `CROSS-1X1-V1` 的 21 经×21 纬、441 交点及竹篾规格 |
| [`../../data/FORMAL_CARRIER_ROUND_170.json`](../../data/FORMAL_CARRIER_ROUND_170.json) | 圆扇、有效图样区、扇柄保留区及毛坯的机器可读坐标 |

请按原始文件区分两个阶段：先编 189×189 mm 毛坯，再以半径 85 mm 的圆形轮廓裁剪。交点与竹条数据不能仅用裁剪后的圆内接网格替代毛坯结构。B 的竹篾编号为 `V001–V021` 和 `H001–H021`，宽 9±0.5 mm，厚 0.5±0.1 mm，备料长 280–300 mm。

C 图样的确认上下文请读取 A 分支 `a/confirmed-design-handoff` 中的 `examples/a-to-d/fan-green-triangle.confirmed-design.json`；该完整 Design 尚未合入 `main`。校验 `confirmedGenerationId`、`confirmedGenerationRevision` 和 `generation.inputVersionId` 后，读取 `generation.result.palette`、`elements`、`transform` 与 `generation.issues`。

这些文件是 B 的规则输入，不等于 D 当前算法已符合规则，也不代表实物试编或 E 工艺检查通过。D 的现有结果继续标注“演示／工艺 pending”，接口也未冻结。原 JSON 中的 `formalExportAllowed` 不能代替当前设计版本的工艺验收结论。
