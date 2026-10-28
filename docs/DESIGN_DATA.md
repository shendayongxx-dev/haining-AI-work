# 统一设计数据格式 V0.1（讨论草案）

> 供 A、C、D、E 对齐接口，待 B 补充工艺依据。本文不规定任何未经验证的尺寸、竹条规格或可编织阈值。实时预览使用 SVG，不依赖 Grasshopper。C 与 D 的职责边界、待验证时的展示方式已由产品负责人确认；具体字段约束仍待各组逐项评审。

## 核心约定

- 一份 `Design` 是唯一当前数据源。A 将已选载体上下文传给 C；C 输出与编法无关的结构化初稿；用户确认后，D 根据结果、所选编法与参数生成网格、竹条及交织数据并绘制 SVG；E 检查同一设计版本。
- 设计坐标与工艺尺寸使用毫米（`mm`）。D 通过明确的 `mmToSvg`、SVG 原点和轴方向映射到 `viewBox`；页面缩放不改变设计数据，E 不使用视图映射计算材料。
- 扇面生成 `surfacePattern`（表面图样）；自定义形状生成 `carrierShape`（几何载体形状）。两者不能互换。
- C 每次重新生成递增 `generationRevision`；形状、图样、编法或工艺参数变化时递增 `designRevision`。检查、材料和教程记录 `generatedFromRevision`；不等于当前 `designRevision` 时立即过期。仅缩放、平移等视图状态不递增。
- 工艺状态独立于用户确认状态。检查依据不足时，仅允许查看明确标注为“演示内容”的预览或页面，不生成或导出正式材料清单与制作教程。
- 所有工艺参数范围、编法适用性和计算公式由 B 提供依据后填入规则表；当前字段可存在，值与结论不得伪造。

## V0.1 数据对象

| 字段 | 类型与含义 | 写入方 | 读取方 |
| --- | --- | --- | --- |
| `schemaVersion` | 字符串，数据格式版本 | A | 全员 |
| `designId`, `designRevision`, `generationRevision` | 稳定设计标识、设计编辑版本、C 的重新生成版本 | A / C / D | 全员 |
| `carrier.type` | `fan` 或 `custom` | A | C / D / E |
| `carrier.geometry` | 毫米坐标几何；自定义形状含 `components`、`outerBoundary`、按需的 `holes`，以及闭合和填充规则 | C / 标准样例 | D / E |
| `input.channel`, `input.sourceRef` | `referenceImage`、`text`、`drawing`；原始内容或资源引用 | A / C | C / D |
| `generation.resultType` | 互斥的 `surface_pattern` 或 `carrier_shape`，由 A 传入的载体类型决定 | C | A / D / E |
| `generation.confirmed` | 用户是否确认当前生成结果 | A | D / E |
| `surfacePattern` / `carrierShape` | C 的编法无关结果；扇面为结构化表面图样，自定义为几何载体形状，两者互斥。C 不负责最终竹条网格 | C | A / D |
| `weave.methodId` | 编法标识；实际允许值待 B 确认 | A / D | SVG / E |
| `parameters` | 疏密、竹条宽度、图样大小、配色等用户可调值；单位逐项注明 | D | SVG / E |
| `strips` / `interlace.crossings` | D 派生的竹条唯一编号、方向、路径、宽度、颜色及带稳定 ID 的交织关系 | D | SVG / E |
| `validation` | `generatedFromRevision`、检查状态、问题位置、依据与建议 | E | A / D |
| `guide` | `generatedFromRevision`、材料、沿用 D 编号的竹条表和步骤；仅检查通过后作为正式资料生成 | E | A |

`carrier.geometry` 和 `strips` 的路径应能还原毫米坐标；**路径只表达几何，不代表工艺可行**。自定义形状的开口、自交、多部件或复杂轮廓应有结构化问题记录；能否继续编辑仍待 B、D、E 确认。图片原件只保留资源引用，不直接塞进设计 JSON。`weaveModel` 的公式文本只能作说明，不作为跨模块可执行代码。

## SVG 实时预览约定

1. D 根据毫米坐标的载体几何，定义 `viewTransform`（`mmToSvg`、`originSvg`、`yAxis`）并创建 SVG `viewBox` 与裁剪区域。
2. 扇面将 C 的编法无关表面图样映射到有效区域；自定义形状使用 C 的几何载体形状。D 在选编法后负责网格化或重采样，具体规则由 C、D 对齐。
3. D 根据编法和参数计算 `strips` 与 `interlace.crossings`，在 SVG 中按竹条方向、颜色和交织层次绘制；调参时重新计算并更新 SVG。竹条 ID 由 D 分配，E 沿用。
4. 同一份更新后的 `Design` 交给 E。E 不从 SVG 像素反推材料或工艺数据。
5. 若编法规则或竹条计算尚缺 B 的依据，SVG 可显示**演示预览**，检查状态标为待验证；只能展示明确标注的演示内容，不生成或导出正式制作资料。

## 最小状态规则

`validation.status` 暂用 `unchecked`、`pending`、`passed`、`failed`；`pending` 必须注明是检查中还是缺少工艺依据。检查问题至少记录严重度、位置、规则标识、原因、建议、依据引用和验证状态。`validation.generatedFromRevision !== designRevision` 或 `guide.generatedFromRevision !== designRevision` 时对应结果过期。用户确认生成结果不等于工艺检查通过。

## 待共同确认

1. C：三种输入各如何产出图样网格或闭合几何形状？自定义形状如何处理非闭合、多部件或过于复杂的轮廓？
2. D：SVG 的设计坐标、竹条派生数据和交织绘制如何表示？哪些参数变化需要重新计算？
3. E：检查和教程需要哪些必填字段？缺工艺依据时如何展示 `unverified`？
4. B：标准扇面尺寸、有效编织区域、编法、竹条规格、参数边界、材料计算与真实制作顺序的依据和验证状态。
