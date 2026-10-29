# C 组回复：生成结果与输入页面状态

> 状态：C 组对 A 页面状态回复草案的接口反馈。第 1、4、7 项仍以 A 最终确认为准；本文不单独改变公共状态含义。

## 一、总体结论

A 提出的七项规则均可以实现，与 C 当前接口方案总体兼容。

C 建议补充一个明确的版本切换时点：

```text
修改输入或生成新候选
→ 不立即替换当前已确认设计
→ 新候选生成成功后供用户比较
→ 用户确认新候选
→ 才切换当前生成结果
→ 旧的编辑结果、检查和教程失效
```

如果新候选生成失败或用户放弃，新候选不影响当前已确认设计及其下游数据。这样与 A 提出的“新结果成功前不覆盖当前结果”保持一致，也避免生成失败导致已有设计被错误作废。

## 二、逐项回复

### 1. `blocking` 与 `warning`

C 可以实现：

- `blocking`：阻止“确认当前结果”，页面展示问题位置、原因和修改建议；
- `warning`：允许预览；A 最终确认后可允许用户确认，但警告必须持续显示并传递给 D/E；
- 用户确认创意结果不等于通过工艺检查；
- E 的工艺问题与 C 的生成问题分开保存。

C 产生的问题只来自以下阶段：

```ts
type GenerationIssueStage =
  | "input"
  | "translation"
  | "geometry";
```

C 不使用 `generation.issues` 输出工艺检查结果。E 的问题应写入独立的 `validation.issues`。

建议结构：

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

首版问题分级：

| 问题 | 严重度 | 是否允许确认 |
| --- | --- | --- |
| 生成失败 | `blocking` | 否 |
| 自定义形状外轮廓未闭合 | `blocking` | 否 |
| 自定义形状自交 | `blocking` | 否 |
| 自定义形状非正面积 | `blocking` | 否 |
| 图样被载体边界裁切 | `warning` | A 确认后可允许 |
| 图样细节被简化 | `warning` | A 确认后可允许 |
| 自定义形状包含孔洞 | `warning` | 可确认创意结果，但工艺状态为待验证 |
| 自定义形状包含多个部件 | `warning` | 可确认创意结果，但工艺状态为待验证 |
| 摄像头轨迹短暂丢失但已形成有效路径 | `warning` | 可确认，但需展示提示 |

`canConfirm` 建议由 A 根据当前生成结果是否存在 `blocking` 问题实时派生，不必作为 C 的重复持久化字段：

```ts
const canConfirm =
  generation.status === "succeeded" &&
  !generation.issues.some(issue => issue.severity === "blocking");
```

### 2. 重新生成与历史候选

C 同意保留当前生成结果作为历史候选。建议每次生成创建不可变的生成记录：

```ts
type GenerationRecord = {
  generationId: string;
  generationRevision: number;
  inputVersionId: string;
  status: "generating" | "succeeded" | "failed";
  result?: SurfacePatternResult | CarrierShapeResult;
  issues: GenerationIssue[];
  createdAt: string;
};
```

新生成记录不能覆盖旧记录。A 另外保存：

```ts
type GenerationSelection = {
  activeGenerationId?: string;
  confirmedGenerationId?: string;
};
```

- `activeGenerationId`：当前在确认页面查看的候选；
- `confirmedGenerationId`：当前正式进入 D 的已确认结果；
- 生成失败时只更新失败记录，不修改 `confirmedGenerationId`。

### 3. 输入版本

C 同意修改输入时建立新版本，不覆盖旧输入。

建议结构：

```ts
type InputVersion = {
  inputVersionId: string;
  inputRevision: number;
  parentInputVersionId?: string;
  channel: "referenceImage" | "text" | "drawing";
  source: ReferenceImageInput | TextInput | DrawingInput;
  createdAt: string;
};
```

关联规则：

```text
一个 InputVersion
→ 可以对应多次 GenerationRecord

一个 GenerationRecord
→ 必须且只能引用一个 inputVersionId

修改输入
→ 新建 InputVersion

使用同一输入直接重试
→ 不新建 InputVersion，只新增 generationRevision
```

建议版本含义：

| 字段 | 递增条件 | 写入方 |
| --- | --- | --- |
| `inputRevision` | 用户实际修改参考图裁切、文字或笔迹 | A / C 输入组件 |
| `generationRevision` | C 发起一次新的生成尝试 | C |
| `designRevision` | 确认新结果，或 D 修改形状、图样、编法和工艺参数 | A / D |

### 4. 确认后返回输入页

C 同意“仅返回查看不失效”。建议区分三个动作：

```text
查看旧输入
→ 不改变任何版本或下游状态

编辑输入但尚未生成
→ 建立输入草稿，不改变当前已确认设计

确认新的生成结果
→ 切换 confirmedGenerationId
→ designRevision 递增
→ 原检查、材料、编号和教程标记过期
```

C 建议不要在用户刚开始编辑输入或刚点击“重新生成”时立即使旧下游结果失效。应在用户确认新生成结果时执行切换和失效，这样用户可以安全比较候选或放弃修改。

如果 A 最终决定“开始重新生成即失效”，C 也能实现，但页面必须清楚说明即使生成失败，旧的正式设计也会失效；C 不推荐该行为。

### 5. 摄像头失败回退

C 同意不自动跳转，提供明确按钮：

```text
摄像头不可用
→ 显示原因
→ 保留已经采集的有效笔迹
→ “重试摄像头” / “改用直接绘制”
```

切换到直接绘制后仍然是：

```json
{
  "channel": "drawing",
  "captureMethod": "pointer"
}
```

如果保留了摄像头已采集的笔迹，新旧笔迹应进入同一个 `strokes` 数组，并在笔画级可选记录来源：

```ts
type DrawingStroke = {
  id: string;
  captureMethod: "pointer" | "cameraGesture";
  points: DrawingPoint[];
};
```

### 6. 参考图上传与 `assetRef`

C 同意由 A 的页面负责：

- 用户选择文件；
- 上传进度；
- 上传失败和重试；
- 文件权限与生命周期；
- 生成持久化 `assetRef`。

C 接收资源引用后读取图像并完成转译。

#### 最小持久化格式

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

必填字段：

| 字段 | 原因 |
| --- | --- |
| `assetId` | 稳定引用，不暴露用户本机路径 |
| `mimeType` | C 选择解码方式并拒绝不支持格式 |
| `pixelSize` | 预检分辨率、建立裁切和坐标转换 |
| `byteSize` | 上传和生成前进行体积限制检查 |

`checksumSha256` 建议填写，用于去重、缓存和确认读取的是同一资源，但不作为首版必填。

裁切信息属于输入版本，不属于资源本身：

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

#### C 的资源访问要求

1. C 可以通过 `assetId` 调用 A 提供的资源解析接口获得短时可读地址或二进制流；
2. 资源地址使用 HTTPS，或在本地开发环境使用同源地址；
3. 跨域资源必须提供允许当前应用读取的 CORS 配置；
4. 资源在本次生成任务结束前保持可访问；
5. 访问授权沿用当前用户会话，不把长期令牌、Cookie 或签名密钥写入设计 JSON；
6. A 应定义允许的文件格式、最大体积和最大像素尺寸；C 对不满足条件的资源返回结构化输入问题；
7. 资源删除或过期后，历史设计仍保留结构化生成结果，但不能重新打开原图进行修改，页面需明确提示；
8. 不允许将用户本机绝对路径作为 `assetId` 或公共接口字段。

建议 A 提供：

```ts
resolveAsset(assetId: string): Promise<{
  readUrl: string;
  expiresAt: string;
}>;
```

或直接提供：

```ts
readAsset(assetId: string): Promise<Blob>;
```

C 不要求持久化短时签名 URL。

### 7. 自定义形状 `warning`

C 同意允许用户确认带 `warning` 的创意形状，但页面必须持续显示：

- 问题类型和位置；
- “确认创意形状不等于工艺通过”；
- 工艺状态为 `unchecked` 或 `pending`；
- 后续可能因缺少 B 的依据而只能查看演示预览，不能生成正式制作资料。

`blocking` 问题仍然不得确认。

## 三、建议的页面状态机

```ts
type InputPageState =
  | "editing_input"
  | "uploading_asset"
  | "ready_to_generate"
  | "generating"
  | "generation_failed"
  | "previewing_candidate"
  | "confirm_blocked"
  | "confirmed";
```

主要转换：

```text
editing_input
→ ready_to_generate
→ generating
→ generation_failed（保留输入和已确认设计）
  或 previewing_candidate

previewing_candidate + 存在 blocking
→ confirm_blocked
→ 修改输入或重新生成

previewing_candidate + 无 blocking
→ confirmed
→ designRevision 递增
→ 旧下游数据失效
```

## 四、建议 A 最终确认的事项

1. 旧下游状态的失效时点是否正式采用“确认新候选时”。
2. `warning` 是否全部允许确认，还是允许某些代码由产品配置为阻断。
3. 历史候选保留数量、存储期限和删除方式。
4. 参考图允许格式、最大文件体积和最大像素尺寸。
5. `assetId` 的资源解析接口由前端服务还是后端服务提供。
6. 摄像头采集笔迹切换到直接绘制后是否默认保留。

## 五、对 C 实现的直接影响

C 将按以下方式实现：

1. 输入与生成记录使用不可变版本，不直接覆盖；
2. 每个生成记录明确关联 `inputVersionId`；
3. 生成失败保留输入、当前候选和当前已确认设计；
4. C 输出结构化 `issues`，A 根据 `blocking` 派生确认按钮状态；
5. 参考图组件接收 A 生成的 `assetRef`，不负责长期资源管理；
6. 摄像头失败显示回退选择，不自动切换；
7. 自定义形状的 warning 保留到 D/E，用户确认只表示确认创意结果。
