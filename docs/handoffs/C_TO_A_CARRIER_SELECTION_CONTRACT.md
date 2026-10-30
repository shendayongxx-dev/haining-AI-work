# C 组交付 A：扇面载体选择与候选生成对接约定

版本：`C-A-CARRIER-CONTRACT-v0.1`  
日期：2026-10-30  
C 分支：`codex/c-input-generation-v0.2-candidate`  
C 正式扇面基线：`9f2b910`  
D 正式圆扇联调基线：`577e644`

## 1. 交付目的

A 负责在“选择载体”页面保存用户所选载体，并把同一载体上下文传给 C、D。C 根据载体类型生成候选：

- 固定扇面：输出适配该载体的 `surface_pattern`；
- 自定义形状：输出 `carrier_shape`；
- 候选必须带载体 ID 和边界版本，先预览、再由用户明确确认；
- C 不选择编法，不生成竹条、交织点、材料清单或工艺通过结论。

## 2. 当前可用范围

目前只有以下固定扇面完成 C→A→D 联调：

| 项目 | 当前值 |
| --- | --- |
| `carrierId` | `FAN-ROUND-170-V1` |
| `boundaryId` | `BOUNDARY-ROUND-170-V1` |
| `effectivePatternBoundaryId` | `PATTERN-ROUND-150-V1` |
| 坐标空间 | `210 × 297 mm`，左上原点，X 向右，Y 向下 |
| 外轮廓 | 圆心 `(105,110) mm`，半径 `85 mm` |
| 有效图样区域 | 同心圆，半径 `75 mm` |
| 扇柄连接保留区 | `x=95–115 mm`，`y=170–195 mm` |
| C 输出 | `surface_pattern` |
| 当前联调编法 | `CROSS-1X1-V1`，由 A/D 在候选确认后使用 |

长圆式和八角式当前**没有经过共同确认的载体 ID、边界、有效图样区域和工艺状态**。A 可以展示选项，但在 B 提交版本化载体数据、团队确认接口并完成 C/D 联调前，必须标记“待接入”，不能进入生成或沿用圆扇数据。

C 不为长圆式、八角式自行命名 `carrierId`，也不推断尺寸、边界、桩位或适用编法。

## 3. A→C 必须传入的载体上下文

A 不能只传“圆扇”“长圆式”等显示名称。调用 C 时至少传入：

```ts
type CarrierContext = {
  id: string;
  type: "fan" | "custom";
  boundaryId?: string;
  effectivePatternBoundaryId?: string;
  coordinateSpace: {
    unit: "mm";
    width: number;
    height: number;
    origin: "topLeft";
    xAxis: "right";
    yAxis: "down";
  };
};
```

圆扇请求示例：

```json
{
  "carrier": {
    "id": "FAN-ROUND-170-V1",
    "type": "fan",
    "boundaryId": "BOUNDARY-ROUND-170-V1",
    "effectivePatternBoundaryId": "PATTERN-ROUND-150-V1",
    "coordinateSpace": {
      "unit": "mm",
      "width": 210,
      "height": 297,
      "origin": "topLeft",
      "xAxis": "right",
      "yAxis": "down"
    }
  },
  "input": {
    "channel": "drawing",
    "inputVersionId": "input-example-001"
  }
}
```

正式公共字段仍以 `docs/DESIGN_DATA.md` 为准；新增载体类型或调整字段时需 A、B、C、D、E 共同确认，不能由单组静默修改。

## 4. C→A 候选输出

固定扇面候选必须满足：

```text
carrier.id = A 传入的 carrier.id
carrier.boundaryId = A 传入的 boundaryId
carrier.effectivePatternBoundaryId = A 传入的 effectivePatternBoundaryId
generation.result.resultType = surface_pattern
```

C 正式结构位于：

```text
generation.result.palette
generation.result.elements
generation.result.transform
generation.issues
```

图样点位于：

```text
generation.result.elements[].pointsMm
```

当前圆扇共同样例：

```text
examples/c-to-d/fan-green-triangle.candidate.json
```

旧运行时兼容字段 `candidate.pointsMm`、`candidate.color` 不属于正式 C→D 数据。D 已在 `577e644` 使用正式 `generation.result` 读取；A 的旧预览迁移完成前可以暂时保留兼容字段，但不得让新模块继续依赖。

## 5. C 的载体校验职责

### 固定扇面

C 根据 A 传入并经 B/团队确认的载体边界执行图样区域检查。当前圆扇规则为：

- 图样位于半径 `75 mm` 有效区域内：正常；
- 超出有效区域：生成结构化警告，并按当前圆扇适配逻辑处理；
- 图样完全位于外轮廓之外：`blocking`，不可确认；
- 与扇柄保留区重叠：警告。C 不自行判断“主体”或“背景”的工艺结论。

长圆式、八角式不能直接复用圆形距离计算。收到正式几何后，C 才能分别实现椭圆或多边形有效区域检查并增加共同样例。

### 自定义形状

C 输出 `carrier_shape`，检查开口、自交和非正面积。形状生成成功不等于通过工艺检查；可制作性由 B/E 根据正式依据判断。

## 6. A 的页面与状态要求

### 载体选择页

- 圆扇：当前可选并进入生成；
- 长圆式、八角式：数据未接入时显示“待接入”，禁止进入生成；
- 自定义形状：进入 `carrier_shape` 流程；
- A 保存稳定 `selectedCarrierId`，后续页面不依靠显示名称反推载体。

### 切换载体

当用户从一个固定载体切换到另一个载体时：

1. 新页面必须使用新的 `carrierId`、边界和有效区域；
2. 旧载体候选不能在新载体下显示或确认；
3. 旧 D 结构快照不能作为新载体预览；
4. 用户尚未确认新候选前，可以保留旧正式设计作为历史状态，但不得把它冒充为新载体设计；
5. 用户确认新载体候选时，A 递增 `designRevision`，并使旧 D/E 快照、检查、材料和教程失效。

### 确认后交给 D

A 应输出一份完整的已确认 Design，而不是长期让 D 拼接“C 候选文件＋A 确认状态文件”。完整对象至少包含：

- `designId`、`designRevision`；
- 当前 `carrier`；
- 当前输入版本；
- C 的完整 `generation`；
- `activeGenerationId`；
- `confirmedGenerationId`；
- `confirmation`；
- 下游结果状态和 `generatedFromRevision`。

以下关系必须成立：

```text
confirmation.confirmedGenerationId
= generation.generationId
= confirmedGenerationId

confirmation.confirmedGenerationRevision
= generation.generationRevision

generation.inputVersionId
= input.inputVersionId
```

存在 `blocking` 问题、确认 ID 不一致或载体 ID 不一致时，A 不得把候选交给 D 正式计算。

## 7. B 后续新增固定扇面时，C 需要的最小数据

每个新载体至少需要：

- 稳定 `carrierId` 和版本；
- `boundaryId`、几何类型和毫米坐标；
- `effectivePatternBoundaryId`、有效图样区域；
- 排除区／保留区及其限制语义；
- 坐标空间；
- 适用编法 ID 及验证状态；
- 参数的依据状态和实物验证状态。

缺少上述数据时，C 只能显示“待接入”，不能用轮廓图替代可计算边界。

## 8. A 接收清单

- [ ] A 读取 `FAN-ROUND-170-V1` 作为当前唯一可用固定扇面；
- [ ] 载体选择跨页面保存稳定 `carrierId`；
- [ ] A 调用 C 时传入完整 `CarrierContext`；
- [ ] C 候选携带同一载体 ID 和边界版本；
- [ ] 用户确认前不进入 D；
- [ ] 切换载体后不沿用旧候选和旧结构快照；
- [ ] 长圆式、八角式在正式数据到位前显示“待接入”；
- [ ] A 产出完整已确认 Design 交给 D；
- [ ] 工艺状态与创意确认状态分开；
- [ ] 不把 `CROSS-1X1-V1` 与其他课程编法使用同一 ID 或同一计算结果。

## 9. 当前不在本次交付范围

- 长圆式和八角式的具体几何及工艺规则；
- 自然语言真实模型 API；
- 参考图真实视觉模型服务；
- 摄像头手势正式页面；
- D 的竹条／交织计算实现；
- E 的工艺检查、材料和教程实现。

