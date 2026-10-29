# C 组创意输入核心模块

本目录是 C 组首个可联调的无框架核心，只实现当前能够独立确定的数据转换与几何检查，不决定整站框架、路由、上传服务或竹编工艺规则。

## 当前实现

- Pointer Events 事件转归一化笔迹；
- 单一主要指针、防多指误触和触控笔压感；
- 撤销、重做、可恢复清空；
- 去重、平滑、折线简化和显式闭合；
- 用户绘制的 normalized/px 坐标转换为毫米坐标；
- 扇面绘制输出 `surface_pattern`；
- 自定义形状绘制输出 `carrier_shape`；
- 有限色板、稳定生成结果 ID、`polygon/polyline`；
- 自定义形状的未闭合、自交、交点定位和非正面积检查；
- 多部件、孔洞的待验证警告接口；
- 根据 `blocking` 问题判断结果是否允许确认。
- `surface_pattern` 与 `carrier_shape` 数据校验；
- C 的创意结果 SVG 预览；
- 自然语言输入版本、校验、失败恢复和生成适配器；
- 参考图资源、格式、体积、像素和裁切校验；
- 摄像头启动/停止、权限错误和捏合手势转笔迹。

## 明确不包含

- 最终编织网格、竹条和交织关系；
- 材料、编号和教程；
- 工艺可制作结论；
- React/Vue 页面；
- A 的图片上传后端；
- 正式自然语言或图像生成模型；
- MediaPipe 等手部关键点识别器。

自然语言、参考图和摄像头均已完成可替换适配层，但正式外部服务需要由网站环境注入。代码不会假装演示适配器是正式 AI 能力。

## 运行测试

项目尚未冻结 Node 工具链，可直接使用支持 Node Test Runner 的 Node.js：

```text
node --test src/modules/creative-input/core.test.mjs
```

运行全部 C 核心测试：

```text
node --test src/modules/creative-input/*.test.mjs
```

生成可交给 D 联调的示例输出：

```text
node scripts/generate-c-demo-results.mjs
```

生成结果位于：

```text
examples/c/fan-surface-pattern-output.demo.json
examples/c/custom-carrier-shape-output.demo.json
```

## 接入方式

统一入口：

```js
import {
  createPointerDrawingController,
  createDrawingHistory,
  translateDrawing,
  renderGenerationPreviewSvg,
} from "./index.mjs";
```

页面收集用户笔迹后调用：

```js
import { translateDrawing } from "./core.mjs";

const generation = translateDrawing(request);
```

`request.carrier.type` 决定结果类型：

```text
fan    → surface_pattern
custom → carrier_shape
```

公开结果几何统一使用 `mm`。原始输入可以使用 `normalized` 或 `px`。

## 浏览器接入边界

- 页面负责 `setPointerCapture`、`releasePointerCapture` 和 Canvas 重绘；
- `pointer-controller.mjs` 负责将事件转换成结构化笔迹；
- `camera-interaction.mjs` 接收外部识别器提供的 21 个手部关键点；
- `reference-image.mjs` 通过 A 注入的 `readAsset(assetId)` 获取图片；
- `text-input.mjs` 通过注入的生成适配器调用正式模型；
- 所有失败均返回或抛出可恢复信息，原始输入由页面状态保留。

## 摄像头手势体验页

无需 React 骨架即可先验证摄像头交互：

```text
node scripts/serve-camera-demo.mjs
```

然后访问：

```text
http://127.0.0.1:4173/demos/camera-gesture/
```

该页面是技术预览：移动食指控制光标，拇指与食指捏合开始绘制，松开停止。页面通过 MediaPipe 在浏览器本地提取手部关键点，不上传或保存摄像头视频。演示扇面边界仅用于交互验证，正式尺寸与工艺结论仍由 B 组验证。
