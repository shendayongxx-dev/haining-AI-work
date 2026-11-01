# D 对 B 组 v0.3 第二轮复审的修订回复

状态：`re-review`
接口工艺状态：`validationStatus: pending`
实物验证：`physicalValidation: not-completed`

D 已接受 B 组第二轮 `changes-requested`，并完成以下修订。

## 1. 椭圆示例改为真实单段裁切

示例改用 `FAN-OVAL-150X180-V1` 的 `V005, x=51 mm`：

```text
外椭圆：cx=105, cy=110, rx=75, ry=90
直线：x=51
求交：y≈47.54..172.46
毛坯偏移：32.04..156.96
可见长度：124.92 mm
```

凸椭圆示例只输出一个 `V005-S01`。公共接口继续允许凹形载体输出多个 `visibleSegments`，但不再用凸椭圆构造不成立的多段结果。

## 2. 颜色段完整覆盖可见段

`V005-S01` 的颜色段现在从 `32.04` 连续覆盖到 `156.96 mm`：

```text
32.04..49.97   outer-base
49.97..80.00   base
80.00..120.00  motif
120.00..139.03 base
139.03..156.96 outer-base
```

新增自动检查约束：颜色段并集必须在几何容差内完整覆盖所属可见段，不能重叠或留缝；容差内小间隙归并到相邻基础色段。

## 3. 工程预警改为通用测量对象

数值型预警统一使用：

```json
{
  "measurement": {
    "measuredValue": 17.8,
    "referenceValue": 18,
    "operator": "<",
    "unit": "mm"
  }
}
```

非数值型预警使用 `measurement: null`。不再使用带 `Mm` 后缀却允许 `count/ratio` 的字段，也不强制非数值预警伪造比较符。

## 4. `sourceKey` 增加接口与生成器版本

已增加：

```json
{
  "schemaVersion": "0.3",
  "structureGeneratorVersion": "D-STRUCTURE-v0.3.0"
}
```

两者任一变化，旧结构快照、E检查、材料结果、工程预警和教程全部失效。裁切、段排序、颜色切分或交点归属算法改变时，D 必须递增 `structureGeneratorVersion`。

## 5. 命名同步

- E 校验字段统一为 `crossings.topStripId`；
- “三组正式样例”统一改为“三组结构集成样例”。

请 B 组复核修订后的《D：结构快照 v0.3 公共接口提案》。若无新增阻断，请将接口状态更新为：

```text
accepted-for-integration
validationStatus: pending
physicalValidation: not-completed
```

该状态仅允许进入三组结构集成案例联调，不代表工艺、材料、收边或教程已通过实物验收。
