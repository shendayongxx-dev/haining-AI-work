# E → A / B / D：真实快照与 B v1.5 覆盖回归

日期：2026-11-02。E 分支：`codex/e-craft-validation`。

## 结论

E 已基于 D `d1f9ceb` 的三组真实快照和 Revision 2 完成独立消费、B v1.5 的逐条规则记录、Schema 校验、统计一致性及版本失效回归。

**三组结构消费均通过；19 项规则均有记录，不代表 19 项检查全部通过。工艺总体仍为 pending。** 公开适配器命名、上下文摘要合同和自定义来源合同仍待 A/D 评审，本次不宣称公共接口冻结或实物验证通过。

## 输入与结果

四份输入均逐项对照 D 提交原 JSON 内容，记录 Git blob 和当前字节哈希，未自行重造 D 的 Revision 2。来源证明见 `examples/e-v15-regression/D_ARTIFACT_PROVENANCE.json`。

| D 案例 | 原竹条 | 毛坯／可见交点 | 规则通过 | 失败 | 待验证 | 不适用 | 总体 |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| 圆扇＋课程十字编 | 42 | 441／285 | 9 | 0 | 4 | 6 | pending |
| 长圆式＋人字编 | 42 | 441／259 | 9 | 0 | 4 | 6 | pending |
| 八角式＋四角孔编 | 26 | 169／109 | 9 | 0 | 7 | 3 | pending |

结果路径：`examples/e-v15-regression/{round-cross-course,oval-herring,octagon-square-hole}.json`。

## 本次完成

- 接入 `B-CRAFT-CHECK-v1.5 / B-EVIDENCE-v1.5`，E 引擎和内部规则集为 0.3。
- 每次支持范围内的检查生成 19 个唯一机器规则记录，明确 passed、failed、pending、notApplicable。超范围编法另增加 `UNSUPPORTED_WEAVE` 守卫记录，不将其误算为第 20 个正式工艺规则。
- `CUSTOM_HANDLE_CONTEXT` 归入 `CUSTOM_CONTEXT_COMPLETE`，只生成一次父规则和一次对应问题，不重复计数。
- 增加 Ajv 2020-12 对 B 原版结果 Schema 的运行时验证；增加规则覆盖、重复／别名、必检不跳过、summary、问题对应及关闭输出的一致性验证。
- 页面展示 19 项统计和逐条记录；旧的详细诊断仍保存在 `diagnostics`，问题按父规则归并并保留位置。
- 固定扇面原样保留 D 完整 sourceKey；检查来源另存 assessmentKey。摘要和接收门禁同时绑定规则、证据、引擎及完整当前输入。
- 短段由 E 独立重算，避免 D 漏报预警后误认为没有短段；该工程阈值仍不能作为实物不合格阈值。
- 正式材料、教程、导出和制作批准持续关闭。

## Revision 1 → 2

D 提供的设计修订号从 1 升至 2、图样缩放从 1 升至 1.1，两版均通过 E 结构消费。当前输入摘要和完整来源键均变化，旧检查拒收，迟到结果不能覆盖新版。

`revision-invalidation.json` 同时保存旧结果的 stale 展示和当前结果；stale 对象保留旧来源，不把旧对象来源键改写成新版。

材料／教程失效使用模拟的“按来源键绑定的缓存对象”验证拒收，**没有开发或开放正式材料和教程功能**。

## 待验证与合同缺口

1. **固定外侧分区：**已有全局身份、矩阵和连续性合同复核，但 D 的颜色段按 0.5 mm 采样。有效区边缘的精确分区核验合同尚未确认，因此 `OUTER_BASE_WEAVE_CONTINUITY` 仍 pending。请 D/A 确认采样映射的判定口径或补充可独立复核的精确分区数据；不把声明字段直接当作完整通过证据。
2. **重点图案：**尚无明确重点图案或无重点图案声明的输入合同，相关规则 pending。
3. **实物：**柄口加固、收边以及四角孔、转角等适用项目没有有效验收记录，保持 pending。
4. **自定义：**继续读取现有 v0.2，检查可用的几何和交点。有效区、毛坯、手柄声明、原竹篾身份、颜色分段和完整来源缺失的规则分别 pending；不补空值或推算值伪造 D 快照。
5. **公共适配器：**`screening` 是 E 分支中通过 B v1.5 Schema 的拟适配结果，仍需 A 确认公共存储与字段位置。自定义的内部 `sourceKey` 保持 null；拟适配结果中的来源明确标记为 `E-projection-from-legacy-input-not-D-sourceKey`，只投影现有真实字段，不声称 D 已提供 sourceKey。
6. **上下文摘要：**当前使用排序 JSON 后 SHA-256，排除摘要自身，显式包含现有几何、坐标和版本；自定义保留缺项描述。具体规范仍交 A/D 冻结，实际输入的额外变化还由完整 inputDigest 防止旧结果复用。

## 验证与复现

- 程序测试：54/54 通过，包括四份 D 真实输入、来源变化、规则缺席、重复规则、父子重复计数、错误统计、漏问题、错状态、必检跳过、误开输出、遗漏可空字段、示例误入运行及证据版本变化。
- 网页：13/13 交互通过，包括固定扇面、自定义叶片、参数修改后重查、问题定位、19 项统计及子规则归并。
- TypeScript 和主站生产构建通过。

```powershell
pnpm install --frozen-lockfile
node scripts/test-e-craft.mjs
pnpm build
pnpm exec vite --host 127.0.0.1 --port 5175 --strictPort
# 服务启动后，在装有 Edge 的本机运行：
node scripts/qa-e-craft-browser.mjs
```

本次只更新 E 分支。未合并 main、未发布网站、未开发制作流程转换。
