# 统一设计数据格式 V0.1（讨论草案）

> 供 A、C、D、E 对齐接口，待 B 补充工艺依据。本文不规定任何未经验证的尺寸、竹条规格或可编织阈值。实时预览使用 SVG，不依赖 Grasshopper。

## 核心约定

- 一份 `Design` 是唯一当前数据源。C 生成初稿，D 修改设计，SVG 预览读取设计，E 检查同一版本并生成材料、编号和教程。
- 坐标与尺寸使用毫米（`mm`）。SVG 用 `viewBox` 映射设计坐标，页面缩放不改变设计数据。
- 扇面生成 `surfacePattern`（表面图样）；自定义形状生成 `carrierShape`（几何载体形状）。两者不能互换。
- 每次改变形状、图样、编法或工艺参数，都递增 `revision`，将旧检查与教程标为过期。仅缩放、平移等视图状态不递增。
- 所有工艺参数范围、编法适用性和计算公式由 B 提供依据后填入规则表；当前字段可存在，值与结论不得伪造。

## V0.1 数据对象

| 字段 | 类型与含义 | 写入方 | 读取方 |
| --- | --- | --- | --- |
| `schemaVersion` | 字符串，数据格式版本 | A | 全员 |
| `designId`, `revision` | 设计标识、递增整数版本 | A / D | 全员 |
| `carrier.type` | `fan` 或 `custom` | A | C / D / E |
| `carrier.geometry` | 载体边界的闭合路径及尺寸；扇面可由标准案例提供，自定义由 C 生成 | C / 标准样例 | D / E |
| `input.channel`, `input.sourceRef` | `referenceImage`、`text`、`drawing`；原始内容或资源引用 | A / C | C / D |
| `generation.kind` | `surfacePattern` 或 `carrierShape`，与载体类型匹配 | C | A / D / E |
| `generation.confirmed` | 用户是否确认当前生成结果 | A | D / E |
| `pattern` | 扇面图样：颜色索引网格、位置与比例；自定义形状可为 `null` | C / D | SVG / E |
| `weave.methodId` | 编法标识；实际允许值待 B 确认 | A / D | SVG / E |
| `parameters` | 疏密、竹条宽度、图样大小、配色等用户可调值；单位逐项注明 | D | SVG / E |
| `strips` | 竹条编号、方向、几何路径、宽度、颜色、交织顺序；可由预览计算器从设计派生 | D 的计算模块 | SVG / E |
| `check` | 检查所依据的 `revision`、状态、问题位置与建议 | E | A / D |
| `guide` | 教程所依据的 `revision`、材料、竹条编号和步骤 | E | A |

`carrier.geometry` 和 `strips` 的路径建议统一为设计坐标中的点列或 SVG path 数据；**路径只表达几何，不代表工艺可行**。若使用 SVG path，需记录其坐标系和闭合状态。图片原件只保留资源引用，不直接塞进设计 JSON。

## SVG 实时预览约定

1. D 根据 `carrier.geometry` 创建 SVG `viewBox` 和载体裁剪区域。
2. 扇面将 `pattern` 映射到有效区域；自定义形状直接显示已确认的几何载体。
3. D 根据编法和参数计算 `strips`，在 SVG 中按竹条方向、颜色和交织层次绘制；调参时重新计算并更新 SVG。
4. 同一份更新后的 `Design` 交给 E。E 不从 SVG 像素反推材料或工艺数据。
5. 若编法规则或竹条计算尚缺 B 的依据，SVG 可显示**演示预览**，检查状态标为 `unverified`，不可称为可制作方案。

## 最小状态规则

`check.status` 取 `notRun`、`pass`、`warning`、`fail`、`unverified`。`check.designRevision !== revision` 时检查过期。`guide.designRevision !== revision` 时教程过期；重新检查前不得将旧教程标为当前有效。检查问题至少记录严重度、位置、规则标识、原因、建议及规则验证状态。

## 待共同确认

1. C：三种输入各如何产出图样网格或闭合几何形状？自定义形状如何处理非闭合、多部件或过于复杂的轮廓？
2. D：SVG 的设计坐标、竹条派生数据和交织绘制如何表示？哪些参数变化需要重新计算？
3. E：检查和教程需要哪些必填字段？缺工艺依据时如何展示 `unverified`？
4. B：标准扇面尺寸、有效编织区域、编法、竹条规格、参数边界、材料计算与真实制作顺序的依据和验证状态。
