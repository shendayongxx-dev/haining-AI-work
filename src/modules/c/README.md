# C 组：创意输入与候选结果

本模块负责把参考图、自然语言和用户直接绘制转成编法无关的候选结果：固定扇面输出 `surface_pattern`，自定义载体输出 `carrier_shape`。候选必须先预览，由 A 写入确认状态后才能交给 D。C 不生成竹条、交织关系、材料清单、教程或工艺通过结论。

## 文件

- `CreativeInputPanel.tsx`：三个输入通道、生成状态、失败重试和候选预览入口。
- `DrawingInput.tsx`：Pointer Events 直接绘制，兼容鼠标、触屏和触控笔。
- `TextInput.tsx`：自然语言输入。
- `ReferenceImageInput.tsx`：参考图校验与 `assetRef` 接入；图片二进制不进入设计 JSON。
- `CandidateResultPreview.tsx`：预览、返回修改和确认回调。
- `types.ts`：C 模块的 V0.2 候选类型。公共字段须由 A 组织确认后才能视为冻结接口。
- `../creative-input/`：无框架的坐标转换、几何检查、历史、预览和适配器核心。

## 接入 React + TypeScript 网站

```tsx
import { CreativeInputPanel } from "./modules/c";

<CreativeInputPanel
  carrier={selectedCarrier}
  generateCandidate={cGenerationAdapter.generate}
  createAssetRef={uploadReferenceImage}
  onConfirm={candidate => appState.confirmGeneration(candidate)}
/>
```

A 必须注入以下能力：

1. `selectedCarrier`：载体 ID、边界 ID、有效图样区域 ID 和毫米坐标空间；
2. `generateCandidate`：真实生成服务适配器；
3. `createAssetRef`：参考图上传/临时资源引用服务；
4. `onConfirm`：把确认结果写入 A 的设计状态，并递增正式 `designRevision`。

密钥只能放在 A 管理的服务端或 API 网关，不能写入本模块或浏览器代码。自然语言和参考图的真实模型尚未注入时，应保持输入和错误状态，不得用假结果冒充正式生成。

## 共同案例

候选结果：`examples/c-to-d/fan-green-triangle.candidate.json`。

- 一个绿色有限色板；
- 一个闭合 `polygon`；
- 坐标单位为 `mm`；
- 稳定的 `patternId`、`elementId` 和 `sourceInputId`；
- `confirmed=false`，D 不得作为正式输入读取；
- 工艺状态为 `demo_pending_validation`。

A 确认状态示意见 `fan-green-triangle.confirmed-by-a.json`。自定义单闭合叶片候选见 `custom-leaf-shape.candidate.json`。

## 运行与验证

本模块已经合并 A 的 React/Vite/TypeScript 骨架，并通过 A 的 `src/modules/c/generateCandidate.ts` 接入现有页面。运行：

```powershell
pnpm dev
pnpm build
node --test src/modules/creative-input/*.test.mjs
```

页面路径为“选扇面/自定义形状 → 三类输入 → 候选预览 → 明确确认”。

## 已知限制

- 当前按 `docs/DESIGN_DATA.md` V0.2 团队联调草案实现；公共字段继续遵守共同评审要求。
- 绿色三角形使用 210×297 mm A4 页面演示坐标；这不是正式扇面边界，有效图样区域仍待 B 验证。
- B 提供的 A4 210×297 mm 是纸样最大包络，不是固定扇面尺寸；正式边界由 A/B 交付后再替换。
- 参考图和自然语言已提供输入组件和可注入适配器，真实 AI 服务尚未接入。
- 摄像头手势属于增强输入，已有无框架原型，不阻塞首轮三个标准通道。
- 自定义形状只对开口、自交和非正面积做结构阻断；工艺可行性由后续 B/E 判断。

## 下一位对接

- A：提供稳定 `assetRef` 上传/读取服务和真实生成 API，并继续管理确认状态与正式设计版本。
- D：读取 A 已确认的绿色三角形结果，核对 `patternId`、`elementId`、`sourceInputId`、有限色板和毫米坐标。
- B：继续提供正式扇面边界、有效图样区域及工艺验证状态；未验证内容保持“待验证”。
