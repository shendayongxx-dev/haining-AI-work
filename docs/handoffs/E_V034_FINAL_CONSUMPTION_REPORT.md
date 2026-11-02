# E：D Structure Snapshot v0.3.4 最终消费回归

日期：2026-11-02

结论：**E 最终消费回归通过，无接口冻结阻断意见。同意由 A 确认三组固定载体 surface_pattern 的 v0.3.4 接口冻结，并由 A 决定合入 main。**

本次基于 D 提交 `8e9fba7042124b8939dee2ae0cacb12a23faff8b` 的真实 JSON 独立消费，未以 D 的 PASS 报告代替 E 检查。本交付位于独立分支 `codex/e-v03-consumption`；未合入 main、未发布网站。

## 三组案例

| 案例 | 原竹条 | 毛坯交点／操作 | 成品可见交点 | 可见段 | 步骤组 | E 消费 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 圆形／课程十字编 | 42 | 441 | 285 | 38 | 21 | 通过 |
| 长圆式／人字编 | 42 | 441 | 259 | 36 | 21 | 通过 |
| 八角式／四角孔编 | 26 | 169 | 109 | 22 | 13 | 通过 |

输入位置：`examples/d-v03-integration/<caseId>/structure-snapshot.json`。

## E 已完成的适配

1. 只从顶层 `strips[]` 读取完整竹条；复核 `rawBlank.stripIds` 与 `trimmedProduct.visibleStripIds`。不再依赖旧阶段内的复制对象树。
2. 按 `weavingOrder` 原顺序生成结构步骤预览，检查工作条、参考条、交点、段 ID 和挑压动作；裁切后不可见的毛坯操作保留，不伪装成可见成品操作。
3. 按唯一 `stripId` 计数。三组备料长度、准备余量及裁切余量仍未知；总备料长度保持 `null`，材料状态保持 `pending`，不使用毛坯长度或可见长度替代采购量。
4. 独立复核颜色来源、图样坐标、C 来源结果、上游问题域、ID 唯一性、段与交点双向引用，以及工程预警定位。
5. E 输出分开保存 `craftValidation: {status: "pending", owner: "E"}` 与 `physicalValidation: {status: "not-completed", owner: "B"}`，正式导出仍为禁用。

## 完整来源键及失效机制

检查、材料和教程预览均原样携带以下十项 `sourceKey`：

`schemaVersion`、`structureGeneratorVersion`、`designId`、`designRevision`、`generatedFromRevision`、`carrierId`、`carrierSpecVersion`、`weaveId`、`weaveSpecVersion`、`craftRuleVersion`。

- 三组案例分别验证十项任一变化后旧结果拒收；键顺序改变不失效，缺字段拒收。
- 顶层来源字段必须与来源键逐项一致。
- `designRevision !== generatedFromRevision` 的快照拒收。
- 即使设计版本不变，旧 D 生成器版本结果也不能复用；迟到的旧结果不能覆盖当前结果。

## 验证证据

- E 程序回归：27/27 通过，含 C 来源异常、重复色板／元素 ID、来源版本、索引异常、旧边界缺陷回归及材料替代负向测试。
- 三组独立报告：`examples/e-v03-consumption-v034/`，均为通过；每组含十项来源字段变化、键顺序和缺字段测试；另有十项结构／材料负向案例通过。
- 真实浏览器交互：16/16 通过；结果及截图在 `.e-qa/`。
- TypeScript、主项目生产构建、E 独立页面生产构建通过。E 页面静态打包三组案例，仍有 bundle 大小提示，不阻断本次本地联调。

复现：

```powershell
node --test src/modules/e/v03/consume.test.mjs src/modules/e/v03/browserInput.test.mjs
node scripts/verify-e-v03-consumption.mjs
pnpm build
pnpm exec vite build --config e-preview.vite.config.mjs
```

启动本地页面：运行 `start-e-preview.cmd`，访问 `http://127.0.0.1:5174/e-preview.html`。启动后可运行 `node scripts/qa-e-v03-browser.mjs` 重放网页测试。

## 冻结范围与后续对接

本次通过只覆盖上述三组固定载体的 `surface_pattern` 数据消费及 E 本地页面，不覆盖 `carrier_shape`、主站端到端接入、正式材料采购量、实物操作教程或工艺可制作性。

旧版读取代码保留在原 `bamboo-diy` 工作目录，本次新版页面不将旧布局静默升级为新快照。历史边界样例在测试中显式转换对象布局后复用其错误拓扑；未经转换的原始历史 JSON 仍完整保留。A 主站的双读迁移需另行集成验收。

下一位对接人为 A：确认接口冻结，审核 E 代码接入，再决定 D 分支与 E 改动的合并顺序。工艺验证保持 `pending`，实物验证保持 `not-completed`；接口冻结不代表工艺或实物验证通过。
