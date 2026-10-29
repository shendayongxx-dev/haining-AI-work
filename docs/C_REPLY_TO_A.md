# C 组回复 A：生成结果接口与页面状态

> 状态：C 组正式评审回复，供 A 汇总进下一版 `docs/DESIGN_DATA.md`。本文不直接冻结公共字段，也不包含未经 B 验证的工艺结论。

## 一、生成结果接口

### 1. C 组输出边界

C 同意输出与编法无关的结构化结果：

- 扇面输出 `surface_pattern`；
- 自定义形状输出 `carrier_shape`；
- C 不生成最终网格、竹条和交织关系；
- D 在用户确认并选择编法后，负责网格化、重采样、竹条、交织关系和 SVG。

### 2. `surface_pattern` 首版结构

建议首版冻结为：

- 有限色板；
- `polygon` 闭合色块；
- `polyline` 开放折线路径；
- 稳定的 `patternId` 和 `elementId`；
- 元素通过 `paletteId` 引用颜色；
- 使用 `zIndex` 表达覆盖顺序；
- 图样元素坐标与 `transform` 分离。

曲线首版可由 C 在输出前离散为折线或多边形。初步栅格只能作为可选生成提示，不能成为 C 的必填输出或最终竹条网格。

### 3. 公共坐标

建议统一为：

- 原始图片、Canvas 和摄像头轨迹可以使用 `px` 或 `normalized`；
- C 交给 D 的 `surfacePattern`、`carrierShape` 和问题位置统一使用 `mm`；
- 坐标原点为左上；
- X 轴向右；
- Y 轴向下；
- D 单独维护 mm 到 SVG 的 `viewTransform`。

D 回复中的接口摘要使用毫米，但示例使用 `normalized`。请 A 在下一版公共接口中消除该冲突。

### 4. `carrier_shape` 首版结构

建议统一使用：

```text
components[]
├─ component.id
├─ outerBoundary
└─ holes[]
```

同时保存：

- `closed`；
- `fillRule`；
- 结构化几何问题；
- 可选的派生摘要，例如部件数、孔洞数、是否存在开口和自交。

不建议在顶层和组件内部重复保存多套外轮廓、孔洞和部件几何，以免数据不一致。

### 5. 问题分级

根据 B 组交接材料，建议首版分为：

#### 阻止确认

- 外轮廓未闭合；
- 自交；
- 非正面积；
- 生成失败。

#### 允许预览但标记待验证

- 孔洞；
- 多部件；
- 极端凹形；
- 尖角；
- 其他缺少工艺依据的复杂轮廓。

用户确认自定义形状只表示确认创意结果，不表示已经通过工艺检查。

## 二、页面状态

A 提出的七项规则均可以实现：

- `blocking` 阻止确认；
- `warning` 可允许确认，但必须持续显示并传递给 D/E；
- 重新生成保留历史候选；
- 修改输入建立新版本，不直接覆盖；
- 返回查看旧输入不使下游状态失效；
- 摄像头失败后提供“重试摄像头”和“改用直接绘制”，不自动跳转；
- A 负责参考图上传并生成 `assetRef`；
- 带 warning 的自定义形状可以确认创意结果，但工艺状态保持未检查或待验证。

### 建议明确旧数据的失效时点

建议采用：

```text
修改输入或生成新候选
→ 不立即影响当前已确认设计
→ 新候选生成成功后供用户比较
→ 用户确认新候选
→ 切换 confirmedGenerationId
→ designRevision 递增
→ 旧编辑结果、检查和教程失效
```

如果新候选生成失败或用户放弃修改，当前已确认设计及其下游数据继续有效。

## 三、版本关联

建议明确区分：

| 字段 | 含义 | 递增或变化条件 |
| --- | --- | --- |
| `inputVersionId` | 一次不可变的输入版本 | 用户修改输入时建立新 ID |
| `inputRevision` | 输入修改序号 | 修改参考图裁切、文字或笔迹时递增 |
| `generationId` | 一次具体生成记录 | 每次生成建立新 ID |
| `generationRevision` | C 的生成尝试序号 | 每次生成或重试递增 |
| `confirmedGenerationId` | 当前正式采用的生成结果 | 用户确认新候选时切换 |
| `designRevision` | 当前正式设计版本 | 确认新结果或 D 修改正式设计时递增 |

关联规则：

- 一个输入版本可以对应多次生成尝试；
- 每个生成记录必须引用一个明确的 `inputVersionId`；
- 使用同一输入直接重试时，不新建输入版本；
- 用户修改输入后，建立新的输入版本；
- 生成失败不能覆盖 `confirmedGenerationId`。

## 四、结构化问题

C 建议问题至少包含：

```ts
type GenerationIssue = {
  id: string;
  code: string;
  severity: "info" | "warning" | "blocking";
  stage: "input" | "translation" | "geometry";
  message: string;
  targetRef?: {
    patternId?: string;
    elementId?: string;
    componentId?: string;
  };
  location?: {
    x: number;
    y: number;
    unit: "mm";
  };
  suggestion?: string;
  source: {
    module: "C";
    generatorVersion: string;
  };
};
```

C 的问题阶段只包括输入、转译和几何。E 的工艺检查问题应独立保存在 `validation.issues`，避免把生成问题和工艺问题混为一类。

A 可以根据当前生成结果是否存在 `blocking` 问题派生确认按钮状态：

```ts
const canConfirm =
  generation.status === "succeeded" &&
  !generation.issues.some(issue => issue.severity === "blocking");
```

## 五、参考图 `assetRef`

建议最小格式为：

```ts
type ImageAssetRef = {
  assetId: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  pixelSize: {
    width: number;
    height: number;
  };
  byteSize: number;
  checksumSha256?: string;
};
```

A 负责：

- 上传和上传进度；
- 上传失败与重试；
- 权限和资源生命周期；
- 生成稳定的 `assetId`；
- 提供资源解析或读取接口。

C 通过 `assetId` 获取短时可读地址或二进制流，再完成转译。

公共设计数据中不保存：

- 用户本机绝对路径；
- 长期访问令牌；
- Cookie；
- 签名密钥；
- 短时签名 URL。

裁切信息属于输入版本，而不是资源本身：

```ts
type ReferenceImageInput = {
  channel: "referenceImage";
  assetRef: ImageAssetRef;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
    unit: "normalized";
  };
};
```

## 六、摄像头回退

摄像头不可用、权限拒绝或识别失败时，C 建议：

```text
显示失败原因
→ 保留已有有效笔迹
→ 提供“重试摄像头”
  或“改用直接绘制”
```

切换后仍属于用户绘制通道，只修改：

```json
{
  "channel": "drawing",
  "captureMethod": "pointer"
}
```

摄像头和直接绘制最终都输出相同的结构化 `strokes`。

## 七、请 A 最终确认并合并

请 A 在下一版 `DESIGN_DATA.md` 中确认：

1. C→D 正式坐标统一使用 mm；
2. 首版采用有限色板与 `polygon/polyline`；
3. 是否保留原生 `ellipse`；
4. `transform.offset` 使用 mm；
5. ID 的唯一性和重新生成生命周期；
6. 自定义形状统一使用 `components[].outerBoundary/holes`；
7. `blocking` 与 `warning` 的页面放行规则；
8. 旧下游数据在“确认新候选”时失效；
9. 历史候选的保留数量和期限；
10. 参考图允许格式、最大文件体积和最大像素尺寸；
11. `assetId` 的资源解析接口；
12. 摄像头切换到直接绘制时是否默认保留已有笔迹。

## 八、A 确认后的 C 组实施顺序

公共字段确认后，C 将按以下顺序开发：

1. 建立输入、生成结果、问题和版本类型；
2. 实现标准扇面的 Pointer Events 直接绘制；
3. 将笔迹转成毫米坐标的 `polygon/polyline`；
4. 实现有限色板、稳定 ID、预览和重新生成；
5. 提供首个标注为“演示数据，待 B 验证”的扇面 JSON，与 D 联调重采样；
6. 实现自定义形状的部件、孔洞、闭合、自交和面积检查；
7. 接入参考图与自然语言；
8. 最后增加摄像头手势绘制，并统一转换成 `strokes`。

## 九、相关 C 组详细评审文件

- `docs/C_GENERATION_INTERFACE_REVIEW.md`
- `docs/C_REPLY_TO_D_AND_B_HANDOFF.md`
- `docs/C_REPLY_TO_PAGE_STATE.md`
