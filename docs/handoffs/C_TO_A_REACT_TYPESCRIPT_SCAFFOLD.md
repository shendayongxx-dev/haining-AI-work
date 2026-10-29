# C 组发给 A：React + TypeScript 网站骨架需求

> 目的：请 A 建立团队共用的最小可运行网站骨架，使 C 可以直接接入 Pointer Events 用户绘制、生成预览和结果确认。本文只描述 C 接入所需条件，不要求 A 实现 C 的绘制或转译逻辑。

## 一、C 需要的结果

A 完成后，团队成员应能在共享仓库中运行同一个网站，并走通以下占位流程：

```text
进入平台
→ 选择载体
→ 选择输入通道
→ 创意输入
→ 生成结果预览与确认
→ 选择编法
→ SVG 编辑
→ 工艺检查
→ 制作资料
```

没有完成的页面可以显示“模块正在接入”，但页面入口、返回关系和共享状态必须存在。

## 二、建议技术方案

建议使用：

```text
React
TypeScript
Vite
```

A 可以根据团队约定调整具体版本，但需要保证：

- 支持 `.tsx` 组件；
- 支持 ES Module；
- 支持 Canvas 和 Pointer Events；
- 支持导入 JSON 联调样例；
- 提供开发、构建和测试命令；
- 不把密钥或用户文件写进代码仓库。

## 三、最小项目文件

请至少建立：

```text
haining-AI-work/
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ index.html
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ pages/
│  ├─ components/
│  ├─ modules/
│  │  └─ creative-input/       # C 组接入位置
│  ├─ state/
│  ├─ types/
│  ├─ services/
│  └─ styles/
├─ public/
├─ examples/
└─ docs/
```

请不要另外创建第二套网站目录。C、D、E 都应接入这一份项目。

## 四、A 需要先建立的页面

建议最小页面或页面状态：

```text
/                         进入平台
/carrier                  选择载体
/input                    选择输入通道并输入
/generation/preview       生成结果预览与确认
/weave                    选择编法
/editor                   SVG 编辑与实时预览
/validation               工艺检查
/guide                    制作资料
```

路由库由 A 决定。即使首版暂时不使用 URL 路由，也需要提供等价、可返回的页面状态。

## 五、C 模块的接入位置

C 需要在以下目录继续开发：

```text
src/modules/creative-input/
├─ components/
│  ├─ InputChannelSelector.tsx
│  ├─ FanDrawingCanvas.tsx
│  ├─ DrawingToolbar.tsx
│  └─ GenerationPreview.tsx
├─ core/
├─ types/
└─ index.ts
```

当前 C 已完成的无框架原型位于：

```text
src/modules/creative-input/core.mjs
src/modules/creative-input/core.test.mjs
```

骨架确定后，C 会将核心迁移或封装成 TypeScript 模块；A 不需要重写 C 的转换逻辑。

## 六、A 需要传给 C 的数据

C 组件至少需要：

```ts
type CreativeInputContext = {
  designId: string;
  selectedCarrier: CarrierContext;
  inputVersionId: string;
  nextGenerationRevision: number;
};
```

扇面上下文至少包含：

```ts
type FanCarrierContext = {
  type: "fan";
  coordinateSpace: {
    unit: "mm";
    width: number;
    height: number;
    origin: "topLeft";
    xAxis: "right";
    yAxis: "down";
  };
  boundary: {
    id: string;
    pointsMm: Array<{ x: number; y: number }>;
    closed: true;
  };
  validPatternRegion: {
    id: string;
    pointsMm: Array<{ x: number; y: number }>;
    closed: true;
  };
  validationStatus: "demo_only" | "confirmed_source";
};
```

如果 B 尚未确认真实尺寸，A 可以先提供演示边界，但必须标记：

```text
演示数据，待 B 验证
```

C 不负责自行发明扇面边界或尺寸。

## 七、C 向 A 返回的事件

建议 A 为 C 页面预留以下回调：

```ts
type CreativeInputCallbacks = {
  onInputVersionChange: (input: InputVersion) => void;
  onGenerationStarted: (generationId: string) => void;
  onGenerationSucceeded: (generation: GenerationRecord) => void;
  onGenerationFailed: (generation: GenerationRecord) => void;
  onCandidateSelected: (generationId: string) => void;
  onGenerationConfirmed: (generationId: string) => void;
  onBack: () => void;
};
```

页面状态含义：

- C 产生候选结果；
- A 保存当前候选和历史候选；
- A 管理用户最终确认；
- 用户确认新候选时，A 才切换正式结果并使旧下游数据失效。

## 八、A 需要提供的共享状态

首版至少需要保存：

```ts
type AppDesignState = {
  designId: string;
  selectedCarrier?: CarrierContext;
  selectedInputChannel?: "referenceImage" | "text" | "drawing";
  inputVersions: InputVersion[];
  generations: GenerationRecord[];
  activeGenerationId?: string;
  confirmedGenerationId?: string;
  designRevision: number;
};
```

状态管理方案由 A 决定，可以先使用 React Context、`useReducer` 或团队认可的状态库。

必须保证：

- 页面返回时用户笔迹不丢失；
- 生成失败时原始输入不丢失；
- 新候选生成前不覆盖当前已确认结果；
- 仅查看旧输入不使下游状态失效；
- 确认新候选后 `designRevision` 递增。

## 九、预览与确认页面

A 需要建立结果确认页面容器，C 向其中提供预览内容和结构化问题。

页面至少显示：

- 当前载体；
- 表面图样或候选载体形状；
- 生成中、成功、失败状态；
- `info`、`warning`、`blocking` 问题；
- “返回修改”；
- “重新生成”；
- “确认当前结果”。

确认按钮规则：

```ts
const canConfirm =
  generation.status === "succeeded" &&
  !generation.issues.some(issue => issue.severity === "blocking");
```

有 `warning` 时可以预览；是否允许确认以 A 最终冻结的页面规则为准。

## 十、参考图资源接口

A 负责建立或预留：

```ts
uploadAsset(file: File): Promise<ImageAssetRef>;
readAsset(assetId: string): Promise<Blob>;
```

最小资源引用：

```ts
type ImageAssetRef = {
  assetId: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  pixelSize: {
    width: number;
    height: number;
  };
  byteSize: number;
  checksumSha256?: string;
};
```

如果首版没有后端，可以先提供明确标注为 mock 的本地服务接口，但不能把浏览器临时 URL 描述成永久云端存储。

设计数据中不得保存：

- 用户本机绝对路径；
- Cookie；
- 长期访问令牌；
- 私钥或签名密钥。

## 十一、样式和响应式基础

A 只需要提供全局页面布局和基础样式，C 自己负责绘制组件的具体样式。

骨架需保证：

- 桌面和手机均能正常显示；
- 主内容区域允许 Canvas 自适应宽度；
- 页面不会强制 Canvas 使用固定屏幕像素尺寸；
- 提供按钮、错误提示、警告提示和加载状态的统一基础样式；
- 支持键盘操作和可见焦点。

C 会在绘制画布中设置：

```css
touch-action: none;
user-select: none;
```

以避免手机绘制时页面滚动或误选文字。

## 十二、A 完成骨架的验收标准

完成后应满足：

- [ ] 安装依赖后可以启动开发网站；
- [ ] 可以执行正式构建；
- [ ] TypeScript 检查通过；
- [ ] 从选择载体可以进入创意输入页面；
- [ ] 创意输入页面能够读取当前载体上下文；
- [ ] 可以进入结果预览页并返回修改；
- [ ] 未完成页面有明确占位状态；
- [ ] 页面返回时共享状态仍然存在；
- [ ] C 有明确的组件目录和导出入口；
- [ ] 提供演示扇面边界或明确其数据加载位置；
- [ ] `README.md` 写明安装、启动、构建和测试方法；
- [ ] 没有把密钥、用户文件或本机路径提交到仓库。

## 十三、A 完成后请回复 C

请 A 提供：

```text
骨架提交或分支：
Node 与包管理器版本：
安装命令：
启动命令：
构建命令：
测试命令：
C 模块目录：
载体上下文类型位置：
共享状态类型位置：
演示扇面边界位置：
预览确认页面位置：
assetRef 服务位置：
已知限制：
```

收到这些信息后，C 将直接实现：

```text
FanDrawingCanvas
→ Pointer Events
→ strokes
→ mm surface_pattern
→ 生成结果预览
```
