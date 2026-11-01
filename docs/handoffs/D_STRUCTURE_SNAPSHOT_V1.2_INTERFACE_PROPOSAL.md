# D：结构快照 v0.3 公共接口提案

评审状态：`accepted-for-integration`（B 组第三轮复审通过）
结构验证状态：`validationStatus: pending`
实物验证状态：`physicalValidation: not-completed`
适用规则：`CARRIER-SPEC-v1.2`、`WEAVE-SPEC-v1.2`
主送：A、B、E
同步：C

## 1. 变更目的

D 需要支持六种正式载体、三种正式编法，以及凹形轮廓产生的多段竹篾。当前 `schemaVersion: 0.2` 的单一 `startMm/endMm` 无法稳定表达这些结果，因此 D→E 快照升级为 `schemaVersion: 0.3`。

本次只确定公共输出结构，不改变 C→A 的 `surface_pattern` 输入合同。所有工艺状态继续为 `pending`，结构计算成功不代表工艺通过。

## 2. 顶层版本字段

```json
{
  "schemaVersion": "0.3",
  "designId": "design-001",
  "generatedFromRevision": 12,
  "carrierId": "FAN-OVAL-150X180-V1",
  "carrierSpecVersion": "CARRIER-SPEC-v1.2",
  "weaveId": "HERRING-3X3-V1",
  "weaveSpecVersion": "WEAVE-SPEC-v1.2",
  "craftRuleVersion": "CRAFT-HERRING-3X3-v1.0",
  "validationStatus": "pending",
  "physicalValidation": "not-completed",
  "sourceKey": {
    "schemaVersion": "0.3",
    "structureGeneratorVersion": "D-STRUCTURE-v0.3.1",
    "designId": "design-001",
    "generatedFromRevision": 12,
    "carrierId": "FAN-OVAL-150X180-V1",
    "carrierSpecVersion": "CARRIER-SPEC-v1.2",
    "weaveId": "HERRING-3X3-V1",
    "weaveSpecVersion": "WEAVE-SPEC-v1.2",
    "craftRuleVersion": "CRAFT-HERRING-3X3-v1.0"
  }
}
```

`carrierId`、`weaveId`、规则版本与 `generatedFromRevision` 必须由同一次计算产生。A 接收异步结果时必须再次核对当前设计版本，旧结果不得覆盖新版本。

## 3. `visibleSegments[]`：多段可见竹篾

```json
{
  "stripId": "V005",
  "direction": "warp",
  "order": 5,
  "widthMm": 9,
  "thicknessMm": 0.5,
  "pitchMm": 9,
  "rawBlankSegment": {
    "startMm": { "x": 51, "y": 15.5 },
    "endMm": { "x": 51, "y": 204.5 },
    "lengthMm": 189
  },
  "visibleSegments": [
    {
      "segmentId": "V005-S01",
      "ordinal": 1,
      "startMm": { "x": 51, "y": 47.54 },
      "endMm": { "x": 51, "y": 172.46 },
      "stripOffsetStartMm": 32.04,
      "stripOffsetEndMm": 156.96,
      "lengthMm": 124.92,
      "crossingIds": ["X-V005-H005", "X-V005-H006", "X-V005-H007", "X-V005-H008", "X-V005-H009", "X-V005-H010", "X-V005-H011", "X-V005-H012", "X-V005-H013", "X-V005-H014", "X-V005-H015", "X-V005-H016", "X-V005-H017"],
      "colorSegments": [
        { "stripOffsetStartMm": 32.04, "stripOffsetEndMm": 49.97, "scope": "outer-base", "color": "#e7cda9", "sourceElementId": null },
        { "stripOffsetStartMm": 49.97, "stripOffsetEndMm": 80, "scope": "base", "color": "#e7cda9", "sourceElementId": null },
        { "stripOffsetStartMm": 80, "stripOffsetEndMm": 120, "scope": "motif", "color": "#315F3A", "sourceElementId": "element-green-triangle-001" },
        { "stripOffsetStartMm": 120, "stripOffsetEndMm": 139.03, "scope": "base", "color": "#e7cda9", "sourceElementId": null },
        { "stripOffsetStartMm": 139.03, "stripOffsetEndMm": 156.96, "scope": "outer-base", "color": "#e7cda9", "sourceElementId": null }
      ]
    }
  ],
  "stockLengthMm": 290,
  "rawBlankLengthMm": 189,
  "visibleLengthMm": 124.92,
  "setupAllowanceMm": 101,
  "trimWasteLengthMm": 64.08
}
```

约定：

- `stripId` 在毛坯、有效图样区、外侧基础编织区和裁切成品中始终不变；
- `segmentId` 只表示同一根竹篾裁切后形成的可见几何段，不得作为新竹篾编号；
- 每个可见段必须列出属于该段的 `crossingIds`，与交点记录中的段 ID 构成双向追溯；
- `visibleLengthMm` 是 `visibleSegments[].lengthMm` 之和；
- 材料计算使用 `stockLengthMm` 或毛坯备料长度，不能用 `visibleLengthMm` 替代；
- v0.3 下 E 必须读取 `visibleSegments[]`。旧 `startMm/endMm` 不再作为正式消费字段。

该示例使用 `FAN-OVAL-150X180-V1` 的椭圆 `cx=105, cy=110, rx=75, ry=90`。在 `x=51` 时，直线与凸椭圆只有一个连续交集，计算得到约 `y=47.54..172.46`。多段数组用于支持后续凹形载体，凸椭圆示例不得构造不连续的两个可见段。

### 3.1 段排序、空结果与端点归属

- `stripOffsetStartMm/stripOffsetEndMm` 均以 `rawBlankSegment.startMm` 为原点，沿原竹篾方向递增；
- 经篾 `visibleSegments[]` 按 Y 从小到大排序，纬篾按 X 从小到大排序；依次生成 `ordinal: 1,2...` 和 `S01、S02……`；
- 几何结果在规定容差内未变化时，`segmentId` 必须稳定；小于几何容差的零长度段或相切碎片不生成；
- 使用 `CARRIER-SPEC-v1.2` 的交点容差 `0.01 mm`、闭合误差 `0.05 mm` 和曲线最大弦误差 `0.25 mm`；
- 竹篾被正式轮廓完全裁掉时仍保留原 `stripId`，使用 `visibleSegments: []`、`visibleLengthMm: 0`；材料计数仍以毛坯竹篾为准；
- 每个可见段采用沿竹篾正方向的半开区间 `[start, end)`；最后一段的终点闭合；
- 交点位于两个相邻段的公共端点时归入正方向上的后一段；位于整根竹篾最后终点时归入最后一段；
- 边界判断使用 `CARRIER-SPEC-v1.2.geometryTolerance.intersectionToleranceMm`，当前为 `0.01 mm`。

### 3.2 颜色分段坐标

`colorSegments.stripOffsetStartMm/stripOffsetEndMm` 统一使用原竹篾毛坯轴线坐标，原点固定为 `rawBlankSegment.startMm`，沿竹篾方向递增。不得在每个可见段内重新从 0 开始：

```json
{
  "segmentId": "V005-S01",
  "lengthMm": 124.92,
  "colorSegments": [
    {
      "stripOffsetStartMm": 32.04,
      "stripOffsetEndMm": 49.97,
      "scope": "outer-base",
      "color": "#e7cda9",
      "sourceElementId": null
    },
    {
      "stripOffsetStartMm": 49.97,
      "stripOffsetEndMm": 80,
      "scope": "base",
      "color": "#e7cda9",
      "sourceElementId": null
    },
    {
      "stripOffsetStartMm": 80,
      "stripOffsetEndMm": 120,
      "scope": "motif",
      "color": "#315F3A",
      "sourceElementId": "element-green-triangle-001"
    },
    {
      "stripOffsetStartMm": 120,
      "stripOffsetEndMm": 139.03,
      "scope": "base",
      "color": "#e7cda9",
      "sourceElementId": null
    },
    {
      "stripOffsetStartMm": 139.03,
      "stripOffsetEndMm": 156.96,
      "scope": "outer-base",
      "color": "#e7cda9",
      "sourceElementId": null
    }
  ]
}
```

约束为 `visibleSegment.stripOffsetStartMm <= colorSegment.stripOffsetStartMm < colorSegment.stripOffsetEndMm <= visibleSegment.stripOffsetEndMm`，按 `stripOffsetStartMm` 升序排列，不重叠。`colorSegments` 的并集必须在几何容差内完整覆盖所属 `visibleSegment`，不得留缝；容差内小间隙归并到相邻基础色段。E 如需段内局部距离，应减去 `visibleSegment.stripOffsetStartMm`。没有用户图样的范围仍须输出 `base` 或 `outer-base` 颜色段，不能用空白代替竹编。

该颜色示例中，有效椭圆在 `x=51` 处的边界偏移约为 `49.97` 和 `139.03 mm`，因此两端为 `outer-base`，有效区内未被图样覆盖的范围为 `base`。

## 4. `outerBaseWeaveZone`：外侧基础编织区

```json
{
  "outerBaseWeaveZone": {
    "operation": "boundary-minus-effectivePatternBoundary",
    "baseWeaveRequired": true,
    "carrierBoundaryRef": {
      "carrierId": "FAN-OVAL-150X180-V1",
      "carrierSpecVersion": "CARRIER-SPEC-v1.2",
      "field": "boundary"
    },
    "effectivePatternBoundaryRef": {
      "carrierId": "FAN-OVAL-150X180-V1",
      "carrierSpecVersion": "CARRIER-SPEC-v1.2",
      "field": "effectivePatternBoundary"
    },
    "patternApplication": {
      "insideEffectiveBoundary": "user-pattern",
      "outsideEffectiveBoundary": "base-color"
    },
    "continuity": {
      "preserveStripId": true,
      "preserveOrder": true,
      "preserveDirection": true,
      "preservePitch": true,
      "preserveWidth": true,
      "preserveThickness": true,
      "preserveCrossingPhase": true,
      "preserveWeavingOrder": true
    }
  }
}
```

颜色段增加 `scope`：

```json
{
  "stripOffsetStartMm": 20,
  "stripOffsetEndMm": 36,
  "color": "#e7cda9",
  "scope": "outer-base",
  "sourceElementId": null
}
```

`scope` 取值：

- `motif`：有效图样区内，由 C 的元素映射而来，保留 `sourceElementId/sourceInputId/paletteId`；
- `base`：有效图样区内未被图样覆盖的基础色；
- `outer-base`：有效图样区外、正式载体边界内的基础编织。

外侧区域只恢复基础色，不重置竹篾 ID、节距或压挑循环。手柄区不是挖空区域，基础竹编继续存在，另行增加加固预警。

## 5. `engineeringWarnings[]`：工程预警

```json
{
  "engineeringWarnings": [
    {
      "warningId": "WARN-V019-S01-SHORT",
      "code": "SHORT_VISIBLE_SEGMENT",
      "status": "pending",
      "severity": "review",
      "carrierId": "FAN-PALACE-WAIST-SQUARE-160X180-V1",
      "weaveId": "HERRING-3X3-V1",
      "stripId": "V019",
      "segmentId": "V019-S01",
      "crossingIds": [],
      "positionMm": { "x": 177, "y": 65 },
      "measurement": {
        "measuredValue": 17.8,
        "referenceValue": 18,
        "operator": "<",
        "unit": "mm"
      },
      "ruleSource": "WEAVE-SPEC-v1.2.edgeAcceptanceRules.shortStrip",
      "message": "可见段短于2倍节距，需人工检查加固。"
    }
  ]
}
```

首批 `code`：

- `SHORT_VISIBLE_SEGMENT`
- `OPEN_HALF_HOLE_AT_EDGE`
- `CORNER_REINFORCEMENT_REQUIRED`
- `LOBE_VALLEY_REINFORCEMENT_REQUIRED`
- `HANDLE_REINFORCEMENT_REQUIRED`

约定：

- `status` 当前固定为 `pending`；
- `severity: review` 表示需要人工复核，不等于工艺不合格；
- 必填：`warningId/code/status/severity/carrierId/weaveId/measurement/ruleSource/message`；
- 条件必填：竹篾问题填写 `stripId`，可见段问题同时填写 `segmentId`，交点问题填写 `crossingIds`，几何位置问题填写 `positionMm`；
- 可空：`stripId/segmentId/crossingIds/positionMm`，仅在对应规则不产生该类定位时为 `null`，不得用缺字段表达；
- 数值型预警的 `measurement` 必须为对象，且 `measuredValue/referenceValue/operator/unit` 全部必填；`operator` 取 `<`、`<=`、`>`、`>=`、`=`，`unit` 首批取 `mm`、`count` 或 `ratio`；
- 非数值型预警统一使用 `measurement: null`，不伪造比较符或阈值；
- 存在数值阈值时，`measurement` 必须能直接复算是否触发；
- B 当前阈值是工程检查依据，未完成实物验证前 E 不得将其转换成自动 PASS。

上例为独立的预警字段示例，对应 `V019-S01.lengthMm = 17.8 mm`、`pitchMm = 9 mm`，规则为 `17.8 < 2 × 9`，因此预警数据可复算一致；它不引用第3节的凸椭圆单段示例。该阈值仍是 `pending` 工程预警，不是实物 PASS/FAIL 标准。

三组结构集成样例中的所有预警必须来自该案例同一份真实结构快照；`stripId/segmentId/crossingIds/positionMm` 必须能在同一 JSON 内完成追溯，以上独立字段示例不得直接充当案例证据。

## 6. `crossings` 与 `weavingOrder`：制作步骤关联

### 6.1 交点结构

```json
{
  "crossingId": "X-V003-H014",
  "warpStripId": "V003",
  "warpSegmentId": "V003-S02",
  "weftStripId": "H014",
  "weftSegmentId": "H014-S01",
  "positionMm": { "x": 33, "y": 137 },
  "topStripId": "H014",
  "rawBlank": true,
  "trimmedProduct": {
    "visible": true
  }
}
```

- `crossingId` 在毛坯和裁切成品中不改变；
- `visible` 表示该交点是否位于正式成品边界内；
- `warpSegmentId/weftSegmentId` 按第3.1节端点规则关联，并必须出现在相应可见段的 `crossingIds` 中；完全裁掉或交点不可见时为 `null`；
- `topStripId` 必须等于 `warpStripId` 或 `weftStripId`，由编法矩阵计算；
- 即使交点在成品中不可见，毛坯 `crossings` 仍保留，供 E 生成完整穿织过程。

### 6.2 穿织操作顺序

```json
{
  "weavingOrder": [
    {
      "step": 14,
      "operationId": "OP-H014-003",
      "workingStripId": "H014",
      "workingDirection": "weft",
      "crossingSequence": 3,
      "crossingId": "X-V003-H014",
      "referenceStripId": "V003",
      "action": "over",
      "positionMm": { "x": 33, "y": 137 },
      "trimmedProduct": {
        "visible": true,
        "workingSegmentId": "H014-S01",
        "referenceSegmentId": "V003-S02"
      }
    }
  ]
}
```

约定：

- `step` 表示工作竹篾的投放顺序；首批正交编法按纬篾从上到下；
- 同一 `step` 内按工作方向递增排列 `crossingSequence`；
- `action` 从工作竹篾视角取 `over/under`；`over` 时交点 `topStripId` 必须等于 `workingStripId`，`under` 时必须等于 `referenceStripId`；
- `operationId` 在同一快照中唯一，建议格式 `OP-{workingStripId}-{crossingSequence三位数}`；
- E 以 `weavingOrder` 生成步骤，以 `crossings` 校验上下关系，以 `trimmedProduct.*SegmentId` 定位裁剪后的可见位置；
- 成品中不可见的操作仍属于毛坯编织步骤，其 `visible` 为 `false`、两个段 ID 为 `null`，不得从 `weavingOrder` 删除。

## 7. 材料计算约定

```json
{
  "materialAccounting": {
    "identityKey": "stripId",
    "countRule": "count-each-stripId-once",
    "lengthSourcePriority": ["stockLengthMm", "verifiedAllowanceFormula"],
    "fallbackStatus": "pending",
    "forbiddenLengthSources": ["rawBlankSegment.lengthMm", "visibleLengthMm"]
  }
}
```

- E 按唯一 `stripId` 统计材料，多段可见几何不得重复计数；
- 长度优先读取 `stockLengthMm`；
- 每根竹篾分别记录 `stockLengthMm`、`rawBlankLengthMm`、`visibleLengthMm`、`setupAllowanceMm` 和 `trimWasteLengthMm`；其中 `setupAllowanceMm = stockLengthMm - rawBlankLengthMm`，`trimWasteLengthMm = rawBlankLengthMm - visibleLengthMm`；
- `setupAllowanceMm/trimWasteLengthMm` 是几何记账值，不能自动解释为已验证的工艺损耗；
- 若缺少 `stockLengthMm`，只有在快照同时提供已验证的余量公式、公式版本和输入值时才允许计算；
- 两者均缺失时返回 `pending`，不得用毛坯几何长度或裁切后可见长度代替。

## 8. 快照阶段结构

```json
{
  "sourceKey": {
    "schemaVersion": "0.3",
    "structureGeneratorVersion": "D-STRUCTURE-v0.3.1",
    "designId": "design-001",
    "generatedFromRevision": 12,
    "carrierId": "FAN-OVAL-150X180-V1",
    "carrierSpecVersion": "CARRIER-SPEC-v1.2",
    "weaveId": "HERRING-3X3-V1",
    "weaveSpecVersion": "WEAVE-SPEC-v1.2",
    "craftRuleVersion": "CRAFT-HERRING-3X3-v1.0"
  },
  "validationStatus": "pending",
  "physicalValidation": "not-completed",
  "stages": {
    "rawBlank": {
      "boundary": {},
      "strips": [],
      "crossings": [],
      "weavingOrder": []
    },
    "trimmedProduct": {
      "boundary": {},
      "effectivePatternBoundary": {},
      "outerBaseWeaveZone": {},
      "strips": [],
      "visibleCrossingIds": []
    }
  },
  "engineeringWarnings": [],
  "materialAccounting": {}
}
```

SVG 预览必须直接读取该快照，不能另算一份显示几何。E 读取 JSON，不从 SVG 反推结构数据。

## 9. 版本失效规则

所有 D、E 派生结果必须携带同一个来源键：

```json
{
  "sourceKey": {
    "schemaVersion": "0.3",
    "structureGeneratorVersion": "D-STRUCTURE-v0.3.1",
    "designId": "design-001",
    "generatedFromRevision": 12,
    "carrierId": "FAN-OVAL-150X180-V1",
    "carrierSpecVersion": "CARRIER-SPEC-v1.2",
    "weaveId": "HERRING-3X3-V1",
    "weaveSpecVersion": "WEAVE-SPEC-v1.2",
    "craftRuleVersion": "CRAFT-HERRING-3X3-v1.0"
  }
}
```

以下任意值改变，旧的结构快照、E检查结果、材料结果和教程全部失效并重新计算：

- `schemaVersion` 或 `structureGeneratorVersion`；
- `designId` 或 `generatedFromRevision`；
- `carrierId` 或 `carrierSpecVersion`；
- `weaveId`、`weaveSpecVersion` 或 `craftRuleVersion`。

E 的输出必须原样保存 `sourceKey`。A 以完整 `sourceKey` 判断结果是否仍对应当前设计，不能只比较 `designRevision`。D 修复裁切、段排序、颜色切分或交点归属算法时必须递增 `structureGeneratorVersion`，即使 A 设计和 B 规范版本没有变化。

版本字段统一约定：`designRevision` 是 A 的当前输入设计版本；D 输出只使用 `generatedFromRevision` 表示本快照实际消费的 A 版本。计算完成时必须满足 `generatedFromRevision === designRevision`，保存后以下游结果的 `generatedFromRevision` 为追溯依据，不再另存第二个含义相同的版本字段。

## 10. 圆扇手柄区约定

圆扇唯一权威范围为 `x=95..115 mm, y=170..195 mm`，引用 `CARRIER-SPEC-v1.2 / ROUND-HANDLE-v1.1`。

- 手柄区不是挖空区，基础竹编和原交点继续保留；
- `HANDLE_REINFORCEMENT_REQUIRED.ruleSource` 必须填写 `CARRIER-SPEC-v1.2.carriers[FAN-ROUND-170-V1].handleExclusion@ROUND-HANDLE-v1.1`；
- 图样避让、装柄加固位置和相关预警按该范围重新计算；圆形边界、毛坯网格和裁切弦段不因此重算。

## 11. 各组确认责任

### A 组：接口负责人和合并门禁

- 确认 `schemaVersion: 0.3` 的升级与兼容策略；
- 确认载体、编法、图样或参数变化时 `designRevision` 的递增规则；
- 确认第9节完整 `sourceKey` 为结构、检查、材料和教程的统一失效键；
- 在三组共同案例通过组合构建后决定是否合入 `main`。

### B 组：规则语义确认

- 确认多段裁切没有改变原竹篾身份；
- 确认 `outerBaseWeaveZone` 的连续性字段完整；
- 确认五类工程预警及规则来源表达准确；
- 不负责把当前 `pending` 提升为 PASS，除非补齐实物记录。

### E 组：下游消费确认

- 确认制作步骤可按 `stripId → segmentId → crossingId` 定位；
- 确认 `weavingOrder` 可直接生成操作顺序，并与 `crossings.topStripId` 相互校验；
- 确认材料量读取毛坯/备料长度，不读取裁切后可见弦长；
- 确认工程预警不会被误判为自动工艺结论。

### C 组：同步，不作为 D→E 接口门禁

- 继续输出已确认的 `surface_pattern`；
- 图样只在 `effectivePatternBoundary` 内生效；
- 不需要生成竹篾、交点、外侧基础编织区或工程预警。

## 12. 验收案例

接口用以下三组案例验证后进入合并评审：

1. `FAN-ROUND-170-V1 + CROSS-COURSE-2X2-V1`
2. `FAN-OVAL-150X180-V1 + HERRING-3X3-V1`
3. `FAN-OCTAGON-170-V1 + SQUARE-HOLE-1X1-V1`

每组必须提供确认设计、D→E 快照 JSON、SVG 截图、交点矩阵检查、边界裁切检查和 `pending` 风险清单。

## 13. 评审结论与集成门禁

- B 组第三轮复审已确认 `accepted-for-integration`；D 可以开始提交三组结构集成样例；
- 最终是否合入 `main` 仍由 A 依据版本兼容策略、E 的消费验证和三组结构集成结果决定；
- C 的输入合同没有变化，因此 C 的反馈为同步意见，不阻断 D→E 接口；
- 实物验证缺失不阻断结构联调，但快照和页面必须持续标记 `pending`。
