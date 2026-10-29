# C 组 V0.2 候选交接说明

## C 的职责

C 负责创意输入采集和编法无关的结构化转译：

- 参考图、自然语言、直接绘制三个通道；
- 固定扇面输出 `surface_pattern`；
- 自定义载体输出 `carrier_shape`；
- 返回稳定 ID、毫米坐标、来源关联、生成版本和结构化问题；
- 保留输入，支持失败重试、候选预览和返回修改；
- 把确认请求交给 A，不自行推进正式设计版本。

C 不负责选择编法、生成竹条和交织点、计算材料、提供教程、判断可制作或补造工艺规则。

## 本次交付

1. `src/modules/c/`：React + TypeScript 受控输入组件和候选类型；
2. `src/modules/creative-input/`：框架无关的绘制、坐标、几何、预览和适配核心；
3. `examples/c-to-d/fan-green-triangle.candidate.json`：首个固定联调候选；
4. `examples/c-to-d/custom-leaf-shape.candidate.json`：自定义单闭合形状候选；
5. `examples/c/`：三个输入通道和摄像头增强输入样例；
6. 单元测试与演示结果生成脚本。

## 公共接口待确认

当前仓库中的 `docs/DESIGN_DATA.md` 仍为 V0.1 讨论草案，因此本次没有单独修改公共文档。请 A 组织确认以下 V0.2 字段：

- `schemaVersion = DESIGN_DATA_V0.2` 的正式字符串；
- `surfacePattern.elements[].elementId` 还是通用 `id`；
- `palette[].value` 还是 `color`；
- `carrier.boundaryId`、`effectivePatternBoundaryId` 的正式位置；
- A 的确认对象和 `designRevision` 递增方式；
- C 候选的 `craftStatus` 是否并入统一 `validation`。

字段冻结前，D 可以使用绿色三角形样例联调读取逻辑，但不应把候选结构写死成不可迁移的生产接口。

## 联调验收

- C 候选保持 `confirmed=false`；
- A 明确确认同一 `generationId + generationRevision` 后，D 才计算 SVG 和结构快照；
- 绿色三角形必须保持一个有限绿色色板、一个闭合 polygon、毫米坐标及稳定来源 ID；
- 自定义叶片是形状，不得当成扇面表面图样；
- 所有工艺结论保持“演示数据，待 B 验证”。

