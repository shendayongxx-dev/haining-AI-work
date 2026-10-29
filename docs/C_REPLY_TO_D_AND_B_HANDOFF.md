# C 组回复：D 组表面图样接口与 B 组工艺交接

> 状态：C 组确认意见，供 A 汇总进下一版 `docs/DESIGN_DATA.md`。本文不直接冻结公共字段，不把 B 标记为待验证的内容写成已确认工艺标准。

## 一、C 组结论

C 同意首版按以下边界联调：

```text
C：有限色板 + polygon/polyline 的编法无关图样
→ A：用户预览并确认
→ D：根据载体、编法和参数完成网格化、重采样、竹条、颜色段、交织关系和 SVG
→ E：读取当前 designRevision 的结构数据完成检查和资料生成
```

C 同意 B 的首版几何分层：

- 未闭合、存在自交、非正面积：作为几何无效问题，阻止用户确认进入正式编辑；
- 孔洞、多部件、极端凹形、尖角、裁切后短竹段：保留结构并标记“待验证”，不能宣称可制作；
- C 只输出输入、转译与几何问题，不输出工艺通过结论。

## 二、对 D 组七个问题的逐项回复

### 1. 首版最低格式

同意首版最低保证为：

- 有限色板；
- `polygon`：闭合色块，必须支持；
- `polyline`：带宽度的开放折线路径，必须支持；
- 稳定的 `patternId`、`elementId`；
- 显式层级顺序 `zIndex`；
- 图样变换与原始元素坐标分离。

`ellipse` 可以作为输入阶段的便捷几何，但为降低首版接口复杂度，C 可在交接前将其离散为 `polygon`。如果 A、D 决定保留 `ellipse`，需要把中心点、两个半径和旋转角写成正式字段，不能复用 `points` 造成歧义。

### 2. 曲线处理

C 同意首版在输出前将曲线离散为折线或多边形，但建议记录：

```json
{
  "approximation": {
    "sourceGeometry": "curve",
    "method": "polyline",
    "maxDeviationMm": 0.5
  }
}
```

`maxDeviationMm` 是几何近似精度，不是竹编工艺阈值。具体默认值应由 C、D 依据显示和性能测试确定，并标记为界面/计算参数。

### 3. ID 唯一性与稳定性

C 可以保证：

- `patternId` 在当前设计内唯一；
- `elementId` 在同一 `generationId` 内唯一且稳定；
- 自定义形状的 `componentId` 在同一 `generationId` 内唯一且稳定；
- 只调整图样 `transform` 时，不改变元素 ID；
- 新一次重新生成建立新的 `generationId`，不保证与上一生成结果复用相同元素 ID；
- 如需比较前后生成结果，应通过显式 `parentGenerationId` 或历史记录关联，不能依赖 ID 偶然相同。

### 4. 坐标单位

C 不同意把归一化坐标作为 C→D 的正式公共坐标，因为这与共享仓库当前约定“几何和设计尺寸使用 mm”冲突，也会使 D/E 难以稳定关联位置和长度。

建议统一为：

```json
{
  "coordinateSpace": {
    "unit": "mm",
    "width": 200,
    "height": 120,
    "origin": "topLeft",
    "xAxis": "right",
    "yAxis": "down"
  }
}
```

原始参考图、Canvas 笔迹和摄像头轨迹可以在 `input` 内保留像素或归一化坐标；C 在生成交接结果时转换为 A 传入的毫米设计空间。

D 回复中“一律使用毫米”与示例中的 `unit: normalized` 相互矛盾。建议 A 在公共接口中明确：

- `input` 可以使用 `px` 或 `normalized`；
- `surfacePattern`、`carrierShape` 和传给 D/E 的问题位置必须使用 `mm`；
- D 的 `viewTransform` 只负责 mm→SVG，不写回 C 原始结果。

### 5. 有限色板

C 同意元素使用 `paletteId`，不直接生成无限连续颜色。建议首版字段为：

```json
{
  "palette": [
    {
      "id": "base",
      "color": "#E8D8B5",
      "role": "base"
    },
    {
      "id": "primary",
      "color": "#315F3A",
      "role": "pattern"
    }
  ]
}
```

C 只表达用户图样的颜色意图。某颜色能否由真实竹条、预染或上下层关系实现，需要 B/E 后续验证。

### 6. 自定义形状显式标记

C 可以显式输出：

- `components`；
- 每个组件的 `outerBoundary`；
- `holes`；
- `closed`；
- `selfIntersecting`；
- `fillRule`；
- 结构化问题及问题位置。

建议不要同时在顶层重复保存 `outerBoundary`、`holes` 和 `components` 三套几何。统一以 `components[]` 为正式结构：

```json
{
  "components": [
    {
      "id": "component-001",
      "outerBoundary": {
        "closed": true,
        "points": []
      },
      "holes": []
    }
  ],
  "fillRule": "evenodd"
}
```

顶层可保留派生摘要：

```json
{
  "componentCount": 1,
  "holeCount": 0,
  "hasOpenBoundary": false,
  "hasSelfIntersection": false
}
```

摘要用于快速判断，正式几何仍以 `components` 为准。

### 7. 原始输入和生成版本

C 确认必须保留：

- 参考图资源引用、尺寸和裁切信息；
- 用户自然语言原文；
- 用户绘制的结构化 `strokes`；
- 摄像头绘制的 `captureMethod` 与必要追踪警告；
- `generatorVersion`；
- `generationId`；
- `generationRevision`；
- 用户确认状态由 A 独立写入。

预览图片可以保留资源引用，但不能代替结构化图样或形状。

## 三、C→D 建议冻结的 `surfacePattern` 最小结构

```json
{
  "resultType": "surface_pattern",
  "patternId": "pattern-001",
  "generationId": "generation-001",
  "generatorVersion": "c-generator-v0.1",
  "source": {
    "channel": "drawing",
    "sourceRef": "input-drawing-001"
  },
  "coordinateSpace": {
    "unit": "mm",
    "width": 200,
    "height": 120,
    "origin": "topLeft",
    "xAxis": "right",
    "yAxis": "down"
  },
  "palette": [
    {
      "id": "base",
      "color": "#E8D8B5",
      "role": "base"
    },
    {
      "id": "primary",
      "color": "#315F3A",
      "role": "pattern"
    }
  ],
  "elements": [
    {
      "id": "element-001",
      "type": "polygon",
      "pointsMm": [
        [70, 74],
        [90, 58],
        [110, 74],
        [70, 74]
      ],
      "paletteId": "primary",
      "zIndex": 1
    }
  ],
  "transform": {
    "scale": 1,
    "rotationDeg": 0,
    "offsetMm": {
      "x": 0,
      "y": 0
    }
  },
  "issues": []
}
```

> 示例尺寸与坐标仅用于接口联调，不代表 B 已确认的标准扇面尺寸或工艺参数。

## 四、重采样职责确认

C 同意 D 提出的首版采样原则，作为 D 的可重复计算规则：

1. D 应用 `transform` 后映射到当前载体；
2. D 根据载体、编法和竹条参数生成正式网格；
3. 默认按网格单元中心采样最高 `zIndex` 元素；
4. 未命中使用 `base` 色；
5. D 不创建色板外的新颜色；
6. 图样超出载体部分裁切；
7. 细线或小色块丢失时可启用确定性的 `3 × 3` 多点覆盖率采样；
8. 元素采样后完全消失时，D 返回 `PATTERN_ELEMENT_LOST_AFTER_RESAMPLE` 并关联 `sourceElementId`；
9. D 派生的 `colorSegments` 保留 C 的 `patternId`、`componentId`、`elementId` 来源引用。

需要 A、D 在公共接口中补充确认：`3 × 3` 是首版固定算法还是编辑器可选策略；该选择属于计算与展示策略，不代表工艺可行性。

## 五、根据 B 交接包更新 C 的问题分级

### 5.1 阻止确认

```text
OPEN_BOUNDARY
SELF_INTERSECTION
NON_POSITIVE_AREA
GENERATION_FAILED
```

建议结构：

```json
{
  "code": "OPEN_BOUNDARY",
  "severity": "blocking",
  "stage": "geometry",
  "targetId": "component-001",
  "message": "外轮廓未闭合，请连接高亮端点后重新生成。"
}
```

### 5.2 可预览但必须标记待验证

```text
HAS_HOLES
MULTIPLE_COMPONENTS
EXTREMELY_CONCAVE
ACUTE_CORNER
SHORT_CLIPPED_STRIP
```

其中 `SHORT_CLIPPED_STRIP` 依赖 D 生成竹条并裁切后才能判断，C 不提前输出该结论。C 可输出尖角、极端凹形等几何特征，但阈值未获得 B 验证前不能写死毫米数。

### 5.3 工艺颜色限制

B 已指出“任意像素自由变色”不能作为真实竹编结果。C 的应对方式为：

- 首版使用有限色板；
- 参考图的渐变、阴影和写实纹理必须简化为有限色块；
- 返回 `DETAILS_SIMPLIFIED`；
- C 只表达设计颜色意图，不声明每个颜色都能由真实材料实现。

## 六、B 组资料对 C 当前实现范围的影响

### 可以直接使用

- 几何无效分层：未闭合、自交、非正面积；
- 孔洞、多部件、复杂轮廓必须标记待验证；
- 联调样例必须显示验证状态和来源；
- 标准案例优先使用课程教案十字编扇面；
- 十字编的挑一压一与相邻行错一根已有来源支持。

### 不能由 C 写成正式标准

- 标准扇面的最终尺寸；
- 42 根竹篾的经纬分配；
- 竹篾厚度；
- 有效编织区；
- 裁切余量、包边余量和材料损耗率；
- 尖角、短竹段、最小弯折半径的数值阈值；
- 130 mm 半径、65×65 网格、3 mm 竹条。

C 的接口样例若需要使用任意画布尺寸，必须标注“演示数据，待 B 验证”。

## 七、需要 A 汇总确认的公共接口修改

1. 明确跨模块结果坐标为 `mm`，归一化或像素坐标只存在于 `input`。
2. 正式采用有限色板和 `polygon/polyline`；决定是否保留原生 `ellipse`。
3. 明确 `surfacePattern.transform.offset` 的单位为 mm。
4. 为 `patternId`、`elementId`、`componentId` 定义唯一性和重新生成时的生命周期。
5. 自定义形状正式结构只保留 `components[].outerBoundary/holes`，避免多套几何字段互相矛盾。
6. 将 B 的几何阻断规则与待验证规则写入公共问题代码或 `CRAFT_RULES.md` 引用。
7. 明确待验证结果可以进入标注为演示内容的 SVG 页面，但不能生成或导出正式制作资料。

## 八、C 组下一步实现顺序

在 A 合并公共字段后，C 按以下顺序开发：

1. 定义 `InputSource`、`surfacePattern`、`carrierShape` 和 `GenerationIssue` 类型；
2. 实现标准扇面 Pointer Events 用户绘制；
3. 将笔迹转换为毫米坐标的 `polygon/polyline`；
4. 实现有限色板、稳定 ID、预览和重新生成；
5. 输出首个标注为演示数据的扇面 JSON，交 D 重采样联调；
6. 实现自定义形状的部件、孔洞、闭合、自交和面积检查；
7. 接入参考图与自然语言；
8. 最后增加摄像头手势绘制，统一转为同一种 `strokes` 输入。
