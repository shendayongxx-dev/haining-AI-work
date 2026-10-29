# C 组回复：输入生成结果接口建议

> 状态：C 组接口建议稿，供 A、B、D、E 共同评审。本文件不直接修改 `docs/DESIGN_DATA.md`，不包含未经 B 验证的工艺参数或“可制作”结论。

## 一、C 组职责与交接边界

C 接收 A 传入的已选载体和三类输入之一，输出与编法无关、可继续编辑的结构化生成结果：

- 扇面：`surface_pattern`，即适配扇面有效区域的结构化表面图样；
- 自定义形状：`carrier_shape`，即几何载体形状，不是表面图案；
- 预览图仅用于展示，不能作为正式设计数据源；
- 用户确认由 A 写入；
- 编法选择后的网格化、竹条、交织关系和 SVG 由 D 计算；
- 工艺检查、材料、编号与教程由 E 根据 B 的规则处理。

C 不输出最终竹条网格，不判断设计已经可制作。

## 二、建议的字段与类型

以下类型用于说明接口语义，正式命名以团队确认后的 `docs/DESIGN_DATA.md` 为准。

### 2.1 生成请求

```ts
type GenerationRequest = {
  designId: string;
  carrier: CarrierContext;
  input: InputSource;
  previousGenerationRevision?: number;
};

type CarrierContext = FanCarrier | CustomCarrier;

type FanCarrier = {
  type: "fan";
  geometry: {
    boundary: ClosedPathMM;
    validPatternRegion: ClosedPathMM;
  };
  coordinateSpace: CoordinateSpaceMM;
};

type CustomCarrier = {
  type: "custom";
  coordinateSpace: CoordinateSpaceMM;
};
```

`carrier.type` 由 A 根据用户此前选择传入。C 不根据图片、文字或笔迹猜测输出类型。

### 2.2 三类输入

```ts
type InputSource = ReferenceImageInput | TextInput | DrawingInput;

type ReferenceImageInput = {
  channel: "referenceImage";
  assetRef: string;
  mimeType: string;
  pixelSize: { width: number; height: number };
  crop?: NormalizedRect;
};

type TextInput = {
  channel: "text";
  text: string;
  language?: string;
};

type DrawingInput = {
  channel: "drawing";
  captureMethod: "pointer" | "cameraGesture";
  drawingSpace: {
    width: number;
    height: number;
    unit: "normalized" | "px";
    origin: "topLeft";
    xAxis: "right";
    yAxis: "down";
  };
  strokes: DrawingStroke[];
};

type DrawingStroke = {
  id: string;
  color: string;
  width: number;
  points: Array<{
    x: number;
    y: number;
    pressure?: number;
  }>;
};
```

必填条件：

| 字段 | 条件 | 说明 |
| --- | --- | --- |
| `assetRef` | 参考图必填 | 使用受控资源引用，不写用户本机绝对路径，不把图片二进制塞入设计 JSON |
| `text` | 自然语言必填 | 保留用户原始描述，不能只保存生成后的摘要 |
| `strokes` | 用户绘制必填 | 保存结构化笔迹，不能只保存 PNG |
| `captureMethod` | 用户绘制必填 | 鼠标、触摸、触控笔统一为 `pointer`；摄像头手势为 `cameraGesture` |

### 2.3 毫米坐标空间

```ts
type CoordinateSpaceMM = {
  unit: "mm";
  width: number;
  height: number;
  origin: "topLeft";
  xAxis: "right";
  yAxis: "down";
};

type PointMM = {
  x: number;
  y: number;
};
```

所有交给 D 的图样和形状几何均使用毫米坐标。图片像素、Canvas 坐标和摄像头归一化坐标只保留在输入对象中，由 C 转换到 A 传入的设计坐标空间。

### 2.4 C 的生成响应

```ts
type GenerationResponse = {
  designId: string;
  generationId: string;
  generationRevision: number;
  status: "succeeded" | "failed";
  result?: SurfacePatternResult | CarrierShapeResult;
  issues: GenerationIssue[];
  preview?: PreviewAsset;
  generatedAt: string;
};

type SurfacePatternResult = {
  resultType: "surface_pattern";
  coordinateSpace: CoordinateSpaceMM;
  pattern: SurfacePattern;
};

type CarrierShapeResult = {
  resultType: "carrier_shape";
  coordinateSpace: CoordinateSpaceMM;
  shape: CarrierShape;
};
```

约束：

- `status = "succeeded"` 时必须有 `result`；
- `status = "failed"` 时不得生成可确认的 `result`，但 A 应继续保留请求中的原始输入；
- `carrier.type = "fan"` 时只能返回 `surface_pattern`；
- `carrier.type = "custom"` 时只能返回 `carrier_shape`；
- `surface_pattern` 与 `carrier_shape` 互斥。

### 2.5 `surface_pattern` 最小可交接结构

```ts
type SurfacePattern = {
  elements: PatternElement[];
  palette: PaletteColor[];
  clippingBoundaryId: string;
};

type PatternElement = {
  id: string;
  geometry: PatternGeometry;
  fill?: string;
  stroke?: {
    color: string;
    widthMm: number;
  };
};

type PatternGeometry =
  | { kind: "closedPath"; path: ClosedPathMM }
  | { kind: "openPath"; path: OpenPathMM };

type PaletteColor = {
  id: string;
  value: string;
};

type ClosedPathMM = {
  closed: true;
  points: PointMM[];
};

type OpenPathMM = {
  closed: false;
  points: PointMM[];
};
```

最小必填内容：

| 字段 | 类型 | 单位 | 必填条件 |
| --- | --- | --- | --- |
| `elements` | `PatternElement[]` | 几何为 mm | 必填，成功结果至少一个元素 |
| `element.id` | `string` | 无 | 必填，供 D、E 和问题定位稳定引用 |
| `element.geometry` | 路径 | mm | 必填 |
| `fill` / `stroke` | 颜色或描边 | `widthMm` 为 mm | 至少提供一种可见样式 |
| `palette` | 颜色数组 | 无 | 必填，可为空数组但不建议 |
| `clippingBoundaryId` | `string` | 无 | 必填，指向扇面有效图样区域 |

C 建议 V0.1 使用路径与色块作为最小结构，不把编法网格设为必填。参考图中的渐变、纹理和写实明暗若不能稳定转成有限色块，应简化并返回警告，不直接塞入不可编辑位图作为正式结果。

### 2.6 可选的初步栅格

```ts
type SuggestedRaster = {
  role: "generation_hint";
  rows: number;
  columns: number;
  cells: Array<{
    row: number;
    column: number;
    paletteId?: string;
    coverage?: number;
  }>;
};
```

结论：初步栅格只能是可选建议，不是 C 的必填输出，也不能作为最终竹条网格。

原因：用户尚未选择编法；不同编法、竹条宽度和疏密会导致不同重采样结果。D 应在选择编法后根据 `surface_pattern`、载体有效区域和已确认参数生成正式网格、竹条与交织数据。

### 2.7 `carrier_shape` 最小可交接结构

```ts
type CarrierShape = {
  components: ShapeComponent[];
  fillRule: "nonzero" | "evenodd";
};

type ShapeComponent = {
  id: string;
  outerBoundary: ClosedPathMM | OpenPathMM;
  holes: ClosedPathMM[];
};
```

约束与说明：

- `components` 成功结果至少有一个部件；
- 每个部件必须有稳定 `id`；
- `outerBoundary.closed` 明确记录闭合状态；
- `holes` 无孔洞时为空数组；
- `fillRule` 明确孔洞和重叠区域的填充解释；
- 开口、自交、多部件、孔洞和复杂轮廓不等于自动不可编，但必须返回结构化问题；
- 是否允许进入正式编辑及其工艺边界，由 B、D、E 共同确认。

### 2.8 结构化问题

```ts
type GenerationIssue = {
  id: string;
  code: string;
  severity: "info" | "warning" | "blocking";
  stage: "input" | "translation" | "geometry";
  message: string;
  targetId?: string;
  location?: {
    x: number;
    y: number;
    unit: "mm";
  };
};
```

建议问题代码：

| `code` | 含义 | 建议严重度 |
| --- | --- | --- |
| `INPUT_TOO_BLURRY` | 参考图过于模糊 | `warning` 或 `blocking` |
| `TEXT_TOO_AMBIGUOUS` | 自然语言缺少可生成信息 | `warning` |
| `DRAWING_NOISY` | 笔迹噪点过多 | `warning` |
| `PATTERN_CLIPPED` | 图样被载体有效区域裁切 | `info` 或 `warning` |
| `DETAILS_SIMPLIFIED` | 复杂细节已进行视觉简化 | `warning` |
| `OPEN_BOUNDARY` | 自定义外轮廓未闭合 | `blocking`（首版建议） |
| `SELF_INTERSECTION` | 轮廓自交 | `warning` 或 `blocking`，待团队确认 |
| `MULTIPLE_COMPONENTS` | 包含多个不相连部件 | `warning`，待工艺确认 |
| `HAS_HOLES` | 形状包含孔洞 | `info` 或 `warning`，待工艺确认 |
| `CAMERA_TRACKING_LOST` | 摄像头笔迹追踪中断 | `warning` |
| `GENERATION_FAILED` | 未生成稳定结果 | `blocking` |

`blocking` 表示当前结果不能由 A 放行确认；`warning` 允许预览，但是否允许确认需结合问题类型与团队规则。C 的问题只描述输入、转译和几何，不代替 E 的工艺检查。

### 2.9 预览资源

```ts
type PreviewAsset = {
  assetRef: string;
  mimeType: "image/png" | "image/svg+xml";
  generatedFromGenerationRevision: number;
};
```

预览仅供 A 的确认页展示。D 必须读取结构化 `surfacePattern` 或 `carrierShape`，不能从预览图片反推几何。

## 三、生成版本、原始输入与用户确认状态

建议分别管理：

| 信息 | 写入方 | 说明 |
| --- | --- | --- |
| 原始输入 | A / C | 每次重新生成仍保留，供修改和重试 |
| `generationRevision` | C | 每次成功或失败的生成尝试递增 |
| `generation.confirmed` | A | 用户在结果确认页明确确认后更新 |
| `designRevision` | A / D | 用户确认后建立正式设计版本；D 修改图样、形状、编法或工艺参数后递增 |
| `validation.generatedFromRevision` | E | 与当前设计版本不一致时失效 |
| `guide.generatedFromRevision` | E | 与当前设计版本不一致时失效 |

重新生成时：

1. 保留原始输入或用户修改后的输入；
2. `generationRevision` 递增；
3. 当前生成结果回到未确认；
4. 已选编法、D 的竹条派生数据、旧检查和旧教程标记失效；
5. 用户确认新结果后，再进入选编法和编辑。

生成失败时：

- 保留原输入；
- 返回结构化错误；
- 允许修改后重试或直接重试；
- 不产生可确认的结构化结果。

## 四、一份最小示例 JSON：用户绘制扇面

> 数值仅用于接口结构演示，不表示真实扇面尺寸、工艺参数或已验证案例。

```json
{
  "schemaVersion": "0.1-proposal",
  "designId": "design-demo-fan-001",
  "designRevision": 0,
  "generationRevision": 1,
  "carrier": {
    "type": "fan",
    "coordinateSpace": {
      "unit": "mm",
      "width": 200,
      "height": 120,
      "origin": "topLeft",
      "xAxis": "right",
      "yAxis": "down"
    },
    "geometry": {
      "boundaryId": "fan-boundary-demo",
      "validPatternRegionId": "fan-pattern-region-demo"
    }
  },
  "input": {
    "channel": "drawing",
    "captureMethod": "pointer",
    "drawingSpace": {
      "width": 1,
      "height": 1,
      "unit": "normalized",
      "origin": "topLeft",
      "xAxis": "right",
      "yAxis": "down"
    },
    "strokes": [
      {
        "id": "stroke-001",
        "color": "#315F3A",
        "width": 0.02,
        "points": [
          { "x": 0.35, "y": 0.62, "pressure": 0.5 },
          { "x": 0.45, "y": 0.48, "pressure": 0.5 },
          { "x": 0.55, "y": 0.62, "pressure": 0.5 },
          { "x": 0.35, "y": 0.62, "pressure": 0.5 }
        ]
      }
    ]
  },
  "generation": {
    "generationId": "generation-demo-001",
    "status": "succeeded",
    "resultType": "surface_pattern",
    "confirmed": false,
    "coordinateSpace": {
      "unit": "mm",
      "width": 200,
      "height": 120,
      "origin": "topLeft",
      "xAxis": "right",
      "yAxis": "down"
    },
    "surfacePattern": {
      "clippingBoundaryId": "fan-pattern-region-demo",
      "palette": [
        { "id": "green-01", "value": "#315F3A" }
      ],
      "elements": [
        {
          "id": "pattern-element-001",
          "geometry": {
            "kind": "closedPath",
            "path": {
              "closed": true,
              "points": [
                { "x": 70, "y": 74 },
                { "x": 90, "y": 58 },
                { "x": 110, "y": 74 },
                { "x": 70, "y": 74 }
              ]
            }
          },
          "fill": "green-01"
        }
      ]
    },
    "issues": [],
    "preview": {
      "assetRef": "asset://preview/generation-demo-001.png",
      "mimeType": "image/png",
      "generatedFromGenerationRevision": 1
    }
  },
  "validation": {
    "status": "unchecked"
  }
}
```

## 五、三类输入的最小案例

### 5.1 参考图

成功案例：

- 输入：主体清晰、背景简单、轮廓明确的单色叶片参考图；
- 扇面输出：有限数量的毫米坐标色块或轮廓；
- 自定义形状输出：单个候选闭合外轮廓；
- 说明：是否可制作仍由后续工艺检查决定。

失败或需简化案例：

- 写实照片包含复杂背景、渐变、阴影和大量细节；
- C 返回 `DETAILS_SIMPLIFIED`，必要时同时返回 `INPUT_TOO_BLURRY`；
- 无法得到稳定结构时返回失败，并保留原图引用。

### 5.2 自然语言

成功案例：

- 输入：“在扇面中央生成三个大小递减的绿色叶片轮廓”；
- 输出：三个具有稳定 ID 的结构化图样元素；
- 不包含编法、竹条和可制作结论。

失败或需补充案例：

- 输入：“帮我设计一个好看的图案”；
- C 返回 `TEXT_TOO_AMBIGUOUS`，保留原文并提示补充主体、数量、位置或色彩；
- 不自行补造用户未表达的工艺需求。

### 5.3 用户绘制

成功案例：

- 输入：用户在扇面有效区域绘制一个简单闭合图形；
- 输出：毫米坐标下的闭合路径或色块；
- 原始 `strokes` 保留，可返回修改。

失败或需简化案例：

- 输入：大量短线、噪点、密集重叠，或摄像头追踪多次中断；
- C 返回 `DRAWING_NOISY`、`DETAILS_SIMPLIFIED` 或 `CAMERA_TRACKING_LOST`；
- 结果不稳定时阻止确认，但不删除原始笔迹。

## 六、需要 D 确认的重采样或坐标问题

1. 确认 C 到 D 的最小交接采用路径与色块，而非最终网格。
2. 确认 `PatternElement` 支持的最小几何类型，首版是否只接受折线路径，还是需要曲线段。
3. 确认 D 如何把 `surface_pattern` 映射到选定编法的网格和竹条。
4. 确认重采样时图样覆盖率、颜色归属和边界单元的处理规则。
5. 确认图样大小调整由 D 修改变换参数，还是直接改写元素毫米坐标。
6. 确认毫米坐标到 SVG 的原点和 Y 轴映射；建议设计数据统一左上原点、Y 轴向下，D 单独维护 `viewTransform`。
7. 确认自定义形状的孔洞、多部件和开口在 SVG 编辑器中的展示与限制。
8. 确认 D 派生元素如何稳定关联回 C 的 `element.id` 或 `component.id`，便于 E 报告问题位置。

## 七、需要 A 确认的页面状态问题

1. `blocking` 问题是否统一阻止“确认结果”。
2. 用户点击重新生成时，是否保留当前结果作为历史版本供比较。
3. 用户修改输入后，是建立新的输入版本还是覆盖当前输入。
4. 确认结果后返回输入页，是否需要二次提示下游数据将失效。
5. 摄像头权限拒绝或识别失败时，是否自动回退到 Pointer Events 直接绘制。
6. 参考图资源由 A 上传并生成 `assetRef`，还是由 C 的输入组件负责上传。
7. 自定义形状出现 `warning` 时允许确认的统一页面规则。

## 八、尚缺 B 的工艺依据

1. 标准扇面的真实尺寸和有效图样区域。
2. 首版支持的基础编法及适用载体。
3. 图样最小尺度、最小间距、颜色数量或复杂度是否存在已验证限制。
4. 自定义形状的开口、自交、孔洞、多部件和复杂轮廓是否可进入正式编辑与检查。
5. 哪些自定义形状可以宣称通过可编织性检查。
6. 竹条规格、参数边界、材料计算和真实制作顺序。

在 B 提供依据前，C 只返回输入、转译和几何问题，不把任何候选结果标记为“可制作”。

## 九、C 组结论

1. `surface_pattern` 的最小交接结构应为毫米坐标下、带稳定 ID 的路径或色块和色板。
2. C 的初步栅格只能作为可选生成建议；D 在选编法后负责正式网格化、重采样、竹条和交织数据。
3. `carrier_shape` 使用部件、外轮廓、孔洞、闭合状态和填充规则表达；异常通过结构化问题返回。
4. 原始输入、生成版本、用户确认、设计版本和下游来源版本必须分开。
5. 三类输入都必须保留可编辑的结构化源数据或源引用，不能只交预览图片。
