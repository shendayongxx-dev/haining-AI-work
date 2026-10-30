# C 组→A 组：自定义形状自动闭合与平滑交付

## 用户问题

原实现要求自定义轮廓首尾距离不超过 2 mm，普通手绘很容易生成 `OPEN_BOUNDARY` 阻断问题，导致“确认当前结果”不可用。

## 本次修改

- 新增 `src/modules/c/shapeProcessing.ts`，对自定义形状的直接绘制输入做去重、轮廓意图判定、自动闭合和两轮轻量平滑。
- 修改 `src/modules/c/generateCandidate.ts`，自定义绘制在几何检查前先经过上述处理；处理成功时增加 `OUTLINE_AUTO_REFINED` info，不改变公共数据结构。
- 修改 `src/App.tsx`，自定义形状绘制区直接预览闭合、平滑后的轮廓，并说明无需精准回到起点。

## 保留的安全边界

- 少于 3 个有效点、路径长度不足 8 mm，或包围盒面积不足 4 mm² 的输入不自动闭合。
- 自交和非正面积仍是 blocking；本次只降低用户绘制精度要求，不放弃基本几何有效性。
- “确认创意结果”仍不代表工艺通过。

## A 组合并文件

1. `src/modules/c/shapeProcessing.ts`
2. `src/modules/c/generateCandidate.ts`
3. `src/App.tsx`

## 验证结果

- TypeScript `tsc -b`：通过。
- Vite 生产构建：通过。
- C 组现有 Node 回归测试：31/31 通过。
- 新增行为断言：开口有效轮廓会自动闭合；退化直线不会被误闭合。

## 已知限制

本次处理针对单笔自定义外轮廓。多部件、孔洞及笔画意图分类仍延用现有 C/A 数据约定。
