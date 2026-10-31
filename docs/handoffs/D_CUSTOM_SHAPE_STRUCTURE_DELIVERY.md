# D 自定义形状结构快照交付

## 已完成

- 输入：A 已确认的 `carrier_shape`，首版支持单一、闭合、无孔、不自交轮廓。
- 计算：`calculateCustomStructure()` 在毫米坐标中计算轮廓内每段经纬竹条的端点、长度、稳定 ID 及交织点 `top`。
- 预览：`CustomStructurePreview` 只读取同次计算的快照，不再依靠 SVG 裁切伪造结构数据。
- 版本：快照同时携带 `designRevision` 和 `generatedFromRevision`，二者与当前页面参数版本一致。
- 状态：工艺仍为 `pending`，不生成正式材料清单或制作教程。

## 快照字段示例

```json
{
  "schemaVersion": "0.2",
  "designId": "design-custom-leaf-001",
  "designRevision": 1,
  "generatedFromRevision": 1,
  "confirmedGenerationId": "generation-custom-leaf-001",
  "shapeId": "shape-custom-leaf-001",
  "weave": { "id": "CROSS-1X1-V1", "rule": "over-under-1-1" },
  "strips": {
    "list": [{
      "id": "V001-S01",
      "direction": "warp",
      "startMm": { "x": 27.8571, "y": 140.5562 },
      "endMm": { "x": 27.8571, "y": 156.4438 },
      "geometryLengthMm": 15.8876
    }]
  },
  "interlace": {
    "crossings": [{
      "id": "X-V001-S01-H011-S01",
      "warpStripId": "V001-S01",
      "weftStripId": "H011-S01",
      "positionMm": { "x": 27.8571, "y": 148.5 },
      "top": "weft"
    }]
  },
  "craft": { "status": "pending" }
}
```

默认 21×21 叶片案例程序化检查结果：42 段竹条、321 个交织点，竹条 ID 唯一，交织点关联 ID 均可解析。

## 明确拦截

- `OPEN_BOUNDARY`：轮廓未闭合。
- `SELF_INTERSECTION`：轮廓自交。
- `HOLES_UNSUPPORTED`：首版不支持孔洞。
- `MULTIPLE_COMPONENTS_UNSUPPORTED`：首版不支持多部件。
- `SHAPE_TOO_NARROW_FOR_STRIP`：整体外接尺寸小于竹条宽度。

## 待 B／C／E 对齐

- B：最小窄颈、最小残段、边缘收边与装柄规则。
- C：如需在生成侧预先拦截窄颈，待 B 给出毫米阈值后再对齐。
- E：直接读取快照的竹条和交点，不从 SVG 反推数据。
