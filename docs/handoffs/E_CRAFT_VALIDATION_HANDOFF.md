# E：固定扇面与自定义形状工艺检查接入

日期：2026-11-02。基线：远端 `main@8c4ebe6`。工作分支：`codex/e-craft-validation`。

## 本次范围与发现

按用户最新要求，当前只开发工艺检查，固定扇面和自定义形状都进入检查。通过后的制作流程转换后续开发；不开放正式材料、教程或导出。

核对时远端 main 与已推送 A 分支的 `src/modules/e/validation.ts` 仍为 `validateDemo` 占位函数，未包含附件所述 E 消费器接入。此实现以实际代码为基础补齐。阶段范围调整记录在本文件，供 A/B/D 对齐；未直接改动 D 公共快照格式或单位，也未修改 main。

## 实现内容

- 固定扇面独立消费 D v0.3.6，完整保留十一项来源键，含 `patternPlacementKey`；复核来源、裁切、颜色、交点、矩阵、操作、材料字段、预警与阶段索引。
- 自定义形状实际检查当前轮廓、缩放、版面范围、竹条段编号与求交端点、长度、交点完整性、编法和上下关系；支持单闭合无孔凸形及凹形多段。短段与宽度／间距问题作为待复核工程提示。
- 带孔／多连通形状尚无 D 可消费快照，返回具体 `pending` 能力问题；不伪造已完成检查。非闭合、自交及损坏数据明确指出结构错误。
- 检查页显示状态、原因、位置、建议、规则 ID 和依据状态；可定位竹条和毫米坐标。移除原“查看演示资料页”入口。
- 每次进入检查重新执行；离开检查立即卸载旧结果。异步旧结果取消挂载。输入摘要包含完整输入、完整快照、当前规则数据、E 引擎和规则集版本。

## E 结果接口草案（供 A 复核）

入口：`validateCraft(input: CraftInput): Promise<CraftResult>`，类型见 `src/modules/e/craftTypes.ts`。这是 E 自有结果类型，不改变 D 公共接口。

- `status`：`passed / failed / pending`。
- `structuralStatus`：与工艺状态分开。`failed` 可表示输入或结构无法可信消费，并不等于已依据实物证明工艺不合格；问题域 `domain` 明确区分 `structure / craft / evidence`。
- `issues[]`：每项携带 `ruleId`、原因、建议、位置、依据引用和验证状态。
- `sourceKey`：固定扇面原样保留 D 的十一项来源键；自定义快照目前仍为 v0.2，缺少完整 D sourceKey，因此显式返回 `null`，不编造 D 版本字段。
- `inputDigest`：稳定序列化后 SHA-256，绑定所有形状、参数、来源、颜色、规则数据和快照内容；对象键顺序变化不失效。自定义来源缺口额外用摘要拒绝复用旧结果，但不宣称已补齐 D 公共来源合同。
- `engineVersion / ruleSetVersion`：E 引擎与规则集版本；`acceptCraftResult` 拒绝摘要或版本不匹配的迟到结果。
- `formalMaterialsAllowed / tutorialAllowed / exportAllowed`：全部固定为 `false`，即使未来工艺通过也不因本次接口而自动开放后续功能。

当前没有登记可作为正式工艺验收阈值的 B 规则，因此所有可正常消费的当前案例为 `pending`，不是固定返回成功。状态聚合已支持未来完整规则覆盖后的 `passed`；本次不提供随意注入“已验证”规则的前端入口。

## 验证与运行

```powershell
pnpm install --frozen-lockfile
node scripts/test-e-craft.mjs
pnpm build
pnpm exec vite --host 127.0.0.1 --port 5175 --strictPort
# 服务启动后，可用本机 Edge 运行网页交互测试：
node scripts/qa-e-craft-browser.mjs
```

样例结果位于 `examples/e-craft-validation/`；脚本基于真实 D 计算器生成输入，E 不调用 D 的验证器代替独立检查。网页使用原主站导航进入固定扇面或自定义形状，选编法后提交工艺检查。

本次验证：30/30 程序测试通过，10/10 浏览器交互通过，TypeScript 与主站生产构建通过。覆盖三种固定扇面×四种编法、参数变化、自定义凸形／凹形／多段、缺失交点、伪造自交、上游阻断、孔洞及多连通能力待补齐，以及旧结果失效。状态聚合的 `passed` 只在单元测试用完整覆盖的模拟条件验证，不代表任何当前真实设计通过工艺验证。

测试摘要与网页截图位于 `examples/e-craft-validation/qa/`。自定义形状默认数量与宽度可能形成重叠，页面会提示 B 复核，并建议用户尝试减宽或减少条数；不擅自宣称推荐参数已合格。

## 后续负责人

1. A：复核 E 自有结果接口和主站接入改动；可先使用当前待验证状态与问题定位。公共接口如需变更，仍由 A 组织受影响成员评审。
2. B：按 `E_CRAFT_B_EVIDENCE_REQUEST.md` 补齐规则与试编依据。E 不代写未验证的工艺事实。
3. D：后续确认自定义形状完整来源键及孔洞、多连通形状的结构能力。
4. E：收到依据后登记明确适用范围的工艺规则，再验证真实 `passed / failed` 案例。本次不开发制作流程转换。
