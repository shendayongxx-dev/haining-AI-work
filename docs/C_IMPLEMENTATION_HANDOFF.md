# C 组首个实现切片交接

## 本次完成

C 组已完成不依赖整站框架的创意输入核心，用于先跑通：

```text
用户绘制
→ 输入坐标转换
→ 毫米坐标结构化结果
→ 几何问题检查
→ 交给 A 预览确认 / 交给 D 联调
```

当前支持：

- Pointer Events 事件转结构化笔迹；
- 鼠标、触摸、触控笔压感和单指控制；
- 撤销、重做和可恢复清空；
- 路径去重、平滑、简化和显式闭合；
- normalized 或 px 用户笔迹转换为 mm；
- 扇面输出 `surface_pattern`；
- 自定义形状输出 `carrier_shape`；
- 有限色板；
- `polygon/polyline`；
- 稳定的生成结果 ID；
- 自定义形状的开口、自交、非正面积检查；
- 多部件待验证警告；
- `blocking` 问题阻止确认。
- 自交交点和线段位置输出；
- 结果数据校验和安全 SVG 预览；
- 自然语言输入与生成适配器；
- 参考图元数据、裁切与资源读取适配器；
- 摄像头生命周期与捏合手势笔迹控制器。

## 修改文件

```text
src/modules/creative-input/core.mjs
src/modules/creative-input/core.test.mjs
src/modules/creative-input/pointer-controller.mjs
src/modules/creative-input/drawing-history.mjs
src/modules/creative-input/path-processing.mjs
src/modules/creative-input/geometry-analysis.mjs
src/modules/creative-input/result-validator.mjs
src/modules/creative-input/preview-svg.mjs
src/modules/creative-input/text-input.mjs
src/modules/creative-input/reference-image.mjs
src/modules/creative-input/camera-interaction.mjs
src/modules/creative-input/index.mjs
src/modules/creative-input/README.md
scripts/generate-c-demo-results.mjs
examples/c/fan-drawing-input.demo.json
examples/c/fan-surface-pattern-output.demo.json
examples/c/custom-shape-input.demo.json
examples/c/custom-carrier-shape-output.demo.json
examples/c/text-input.demo.json
examples/c/reference-image-input.demo.json
examples/c/camera-drawing-input.demo.json
```

## 数据格式版本

当前为 C 组联调实现 `c-core-v0.1`，对应公共 `DESIGN_DATA V0.1` 的建议结构，尚未替代 A 最终冻结的公共版本。

所有样例均明确标记：

```text
演示数据，待 B 验证
```

## 如何验证

测试命令：

```text
node --test src/modules/creative-input/core.test.mjs
```

重新生成联调 JSON：

```text
node scripts/generate-c-demo-results.mjs
```

当前自动测试覆盖包括：

1. normalized 笔迹转毫米扇面图样；
2. 开放笔迹保留为 `polyline`；
3. 自定义形状开口阻止确认；
4. 自定义形状自交阻止确认；
5. 面积与自交几何工具；
6. px 笔迹转同一毫米空间；
7. 多部件形状返回 warning；
8. 空输入生成失败并阻止确认；
9. Pointer Events 单指、压感、坐标和取消；
10. 撤销、重做和可恢复清空；
11. 路径平滑、简化与显式闭合；
12. 自交交点定位；
13. 结果数据校验与 SVG 预览；
14. 自然语言版本、模糊输入和失败恢复；
15. 参考图格式、体积、像素、裁切与资源读取；
16. 摄像头权限、关闭媒体轨道、捏合绘制与追踪丢失。

## 当前已知限制

- A 尚未建立网页框架，因此没有 React 页面和真实 Canvas；
- 未收到正式扇面边界，当前只转换坐标，尚未执行真实扇面边界裁切；
- 自然语言和参考图已完成输入与适配层，但未接入正式 AI 服务；
- 自定义形状当前将每条闭合笔迹视为一个部件，尚未实现孔洞绘制交互；
- 摄像头手势核心已实现，但尚未接入真实手部关键点识别器；
- 不计算网格、竹条、交织关系、材料和教程；
- 不输出任何“可制作”结论。

## 下一步对接

### A

提供网站框架、载体边界、页面状态和 `assetRef` 接口后，C 接入绘制页面、预览和确认流程。

### D

请读取：

```text
examples/c/fan-surface-pattern-output.demo.json
examples/c/custom-carrier-shape-output.demo.json
```

并反馈 `surface_pattern.elements`、毫米坐标、色板和来源 ID 是否满足重采样入口。

### B

请继续补充标准扇面真实边界及有效图样区域。未确认前，当前 200×120 mm 只作为坐标接口演示。

### E

当前只提供 C 的 `generation.issues`。正式工艺问题应继续写入独立的 `validation.issues`。
