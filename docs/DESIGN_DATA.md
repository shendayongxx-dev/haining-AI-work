# 统一设计数据接口 V0.2（团队联调草案）

> 汇总 C、D、E 的正式反馈及 A 已确认的产品决定。用于本轮扇面与自定义形状 Demo 的接口联调；工艺尺寸、阈值、材料用量和真实制作顺序仍待 B 提供依据并验证。字段变更须由受影响成员共同评审，关键产品决定由 A 确认。

## 1. 本轮范围与职责

| 环节 | 责任与输出 |
| --- | --- |
| A | 传入已选载体；管理输入、候选、用户确认、正式设计版本和页面状态；参考图上传后提供稳定 `assetRef`。 |
| C | 处理参考图、自然语言、**直接绘制**；输出与编法无关的 `surface_pattern`（扇面）或 `carrier_shape`（自定义形状），以及生成阶段问题。 |
| D | 用户确认并选编法后，将 C 结果网格化或重采样，计算竹条和交织结构，绘制 SVG，并向 E 提供同版本结构快照。 |
| E | 读取 D 的结构快照，输出工艺检查、材料清单、竹条编号和教程；沿用 D 的竹条 ID。 |
| B | 提供有来源、注明验证状态的工艺规则、材料计算和真实制作顺序。 |

箱盒、包只显示载体选项，不进入生成。摄像头手势绘制属于**后续开发方案**，本轮 Demo 不实现，也不作为用户绘制通道的验收条件。

## 2. 唯一数据源、坐标与状态

- 结构化设计数据是唯一当前数据源；SVG 和预览图片只是视图，不用于反推竹条、材料或检查结果。
- C→D 的 `surface_pattern`、`carrier_shape` 和生成问题位置统一使用 **mm**，原点在左上，X 向右、Y 向下。原始图片或绘制采集可用 px／归一化坐标，但 C 在交接前转换。
- `surface_pattern` 可先使用与编法无关的图形坐标；D 在已选载体上定位后计算实际编织网格。SVG `viewBox` 使用无单位显示坐标，通过 D 的 `viewTransform`（`mmToSvg`、`originSvg`、轴方向）映射；该变换只供显示，E 不用于材料计算。
- `resultType` 只能是 `surface_pattern` 或 `carrier_shape`。扇面必须采用前者，自定义形状必须采用后者；两种结果互斥。
- 用户确认候选只表示接受创意结果，不表示工艺检查通过。C 的 `generation.issues` 与 E 的 `validation.issues` 分开保存。

## 3. 版本与候选切换

| 字段 | 含义与变化时点 |
| --- | --- |
| `schemaVersion` | 公共接口格式版本，不用于判断检查或教程是否过期。 |
| `designId` | 同一设计的稳定 ID。 |
| `inputVersionId`, `inputRevision` | 输入不可变版本；用户实际修改图片裁切、文字或笔迹时新增版本并递增序号。 |
| `generationId`, `generationRevision` | 每次生成或重试新建记录并递增序号；必须引用一个 `inputVersionId`。 |
| `activeGenerationId` | 确认页当前查看的候选，可与正式采用的结果不同。 |
| `confirmedGenerationId` | 当前正式采用的生成结果；仅用户确认新候选时切换。 |
| `designRevision` | 确认新候选，或正式设计的形状、图样、编法、配色及工艺参数变化时递增。 |
| `generatedFromRevision` | D 快照及 E 的检查、材料、教程对应的 `designRevision`。不相等即过期。 |

修改输入、开始重新生成、生成失败或放弃候选时，不覆盖当前已确认设计，也不使其下游结果失效。**确认新候选时**才切换正式结果、递增 `designRevision` 并使旧编辑结果、检查与教程失效。仅缩放、平移、预览模式或面板状态变化不递增设计版本。异步检查或教程返回时再次核对 `designId` 和 `generatedFromRevision`，不得覆盖更新版本。

## 4. A→C 输入与 C→A 候选

A 调用 C 时必须传入 `carrier.type`（`fan`／`custom`）、输入版本与资源引用；C 不根据输入内容猜测载体类型。三种输入通道为 `referenceImage`、`text`、`drawing`，本轮 `drawing` 使用 Pointer Events 等直接绘制方式。

参考图的 `assetRef` 至少包含 `assetId`、`mimeType`（PNG／JPEG／WebP）、`pixelSize.width`、`pixelSize.height`、`byteSize`；裁切信息保存在输入版本中。A 负责上传、失败重试、权限与资源生命周期，并提供按 `assetId` 读取图片的接口。公共 JSON 不保存本机绝对路径、长期令牌、Cookie 或短时签名 URL。文件大小、像素上限与持久化方案待 A 和实现成员确定。

C 的每次生成记录包含 `generationId`、`generationRevision`、`inputVersionId`、`status`（`generating`／`succeeded`／`failed`）、`result` 和 `issues`。成功但有警告的候选可预览；有 `blocking` 问题不能确认。`canConfirm` 由 A 根据成功状态和是否存在阻断问题派生，无需重复持久化。

生成问题对象至少包含稳定 `id`、`code`、`severity`（`info`／`warning`／`blocking`）、`stage`（`input`／`translation`／`geometry`）、`message`，按需包含目标元素 ID、毫米位置、建议、生成器版本。未闭合、自交、非正面积的自定义外轮廓阻止确认；孔洞、多部件、极端凹形或尖角可作为警告确认创意结果，但须持续显示并传给 D/E，工艺状态仍为未检查或待验证。具体工艺可行性待 B 确认。

## 5. C 的两种互斥结果

### 5.1 扇面 `surface_pattern`

首版最小结构：稳定 `patternId`；有限色板 `palette[]`（稳定 `paletteId` 与颜色）；元素 `elements[]`（稳定 `elementId`、`kind`、`paletteId`、`zIndex`、毫米坐标点列）；图样 `transform`（比例、旋转角、毫米位移）。`kind` 首版为闭合色块 `polygon` 或开放折线 `polyline`。C 可在输出前把曲线、椭圆离散成点列；原生 `ellipse` 暂非必填格式。初步栅格可作为可选提示，不能成为 C 的必填输出或最终竹条网格。

D 根据载体、编法和参数生成实际竹条网格，再将图样投影并采样。离散色块使用色板 ID，不产生未定义的中间色；超出载体的部分裁切，未覆盖区域使用底色。低分辨率输入可显示演示预览并给出重采样提示。**采样细则和图样变换的边界行为仍需 C、D 用同一扇面样例验证。**

### 5.2 自定义形状 `carrier_shape`

首版使用 `components[]`，每个部件有稳定 `componentId`、`outerBoundary` 和按需的 `holes[]`，并记录 `closed`、`fillRule` 与结构化几何问题。外轮廓和孔洞只在所属部件内保存，不在顶层重复存多套几何。所有路径以 mm 点列记录；开口、自交、非正面积作为阻断确认的问题。孔洞、多部件等可以确认创意形状并进入演示编辑，但不因此获得可制作结论。

## 6. D→E 结构快照与 SVG

D 在每次正式设计变化后以同一次计算产生：网格、`strips.list`、`interlace.crossings`、SVG 预览和 D→E 快照。快照至少携带 `schemaVersion`、`designId`、`designRevision`、`generatedFromRevision`、载体类型、已确认生成结果 ID、编法、有效编织区域、毫米坐标与单位、当前参数、竹条、交织点和演示／验证标记。

- 每根竹条：同版本唯一 `id`、方向、毫米位置或路径、宽度、几何长度、颜色或分段颜色。几何长度**不是**含损耗与收边的备料长度。
- 每个交织点：同版本唯一 `id`、`warpId`、`weftId`、索引、毫米位置、`top`（经／纬在上）、规则验证状态。E 通过 ID 关联，不能依赖数组下标反查。
- D 提供结构化编法规则；公式字符串仅作说明，不作为跨模块执行代码。真实穿织顺序待 B 验证，E 的演示教程优先读取 D 已算出的交织点。
- ID 在同一 `designRevision` 内唯一且稳定。新版本由 D 生成完整快照；旧问题定位必须同时带旧 `generatedFromRevision`，不得误指向新版本竹条。
- SVG 高亮依据竹条 ID、交织点 ID 或毫米位置。E 不读取 `viewTransform` 做检查或材料计算。

当前 A4 矩形直条演示中，`warp.axisMm` 表示中心线 X 坐标，竹条从 `(axisMm, 0)` 沿 Y 正方向延伸；`weft.axisMm` 表示中心线 Y 坐标，竹条从 `(0, axisMm)` 沿 X 正方向延伸。边界中心线竹条的宽度仅在预览中裁切。`colorSegments[].fromMm/toMm` 表示从竹条起点沿长度方向的距离，必须满足 `0 <= fromMm < toMm <= geometryLengthMm`。明确坐标保留两位小数，E 以竹条坐标为准，不用显示用的网格间距反推；几何比较采用 `0.01 mm` 容差。该简化规则不扩展解释为正式扇面或任意形状路径。

`parameters.density` 表示经、纬每个方向各自的竹条数量，不是每毫米密度。`weave.id` 是输出快照的权威编法 ID，`parameters.weaveId` 是输入参数的同值副本。颜色分段仅表示图样映射后的视觉目标色，不直接等同于采购材料、拼接或已验证染色方案。快照内由 D 写入的初始状态标记 `validation.source = "d-initial"`，并携带 `designId` 与 `generatedFromRevision`；它不是 E 的检查结果，E 独立生成并保存自己的版本化结果。

D 提议的半径 130 mm、65 经×65 纬、3 mm 竹条及 3313 个交织点仅可用于联调，并应标注**“演示数据，待 B 验证”**，不得作为正式工艺规格。

## 7. E 的检查、材料与教程

`validation.status` 使用 `unchecked`、`checking`、`passed`、`failed`、`pending`。`failed` 仅对应已有依据的阻断问题；缺少必要数据或工艺依据时用 `pending` 并写 `pendingReason`。若同时有已确认阻断问题和待验证项，状态为 `failed`，问题列表保留两类问题。

检查问题至少包含 `code`、严重程度、说明、建议；能定位时提供 `stripIds[]`、`crossingIds[]` 或 `positionMm`。工艺问题还须带规则标识、依据引用及验证状态。材料、竹条编号和教程分别记录 `designId` 与 `generatedFromRevision`，均使用当前 D 快照；设计变化后旧结果立即标记过期。

`pending` 时可以展示明确标注**“演示内容，未经工艺验证”**的页面或示例，但不生成或导出正式材料清单与制作教程。正式资料的生成和导出入口都需核对检查状态与版本。备料长度、余量、损耗、收边和真实步骤待 B、E 根据依据确认，不能由几何长度或示例公式直接推定。

## 8. 仍待联调确认

1. C、D 用同一用户绘制扇面样例验证毫米坐标、`polygon/polyline`、图样变换、底色、裁切和最终竹条采样；形成一份 C 输出及一份 D 输出。
2. D、E 对齐竹条／交织点 ID 与 SVG 高亮调用，并提供调参前后两个版本的快照验证过期处理。
3. A 与实现成员确定参考图文件上限、资源读取接口、历史候选保留策略；这几项暂不填写猜测值。
4. B 补充有来源的尺寸、编法、竹条规格、可编织边界、材料计算和实物试编状态。没有依据时保持 `pending`。
