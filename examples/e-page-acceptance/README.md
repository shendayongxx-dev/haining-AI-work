# E 检查页验收案例

本目录供 A 接入验收与课堂演示。各 JSON 的 `case` 记录预期状态和是否故障注入，`result` 是 E 实际运行的 B v1.5 结果。

- 生成／验证：`node scripts/test-e-page.mjs`。
- 构造代码：`tests/e-check/fixtures.ts`。
- 页面验收：先启动 5176 服务，再执行 `node scripts/qa-e-page-browser.mjs`。
- 真实页面截图与验收结果：`qa/`。

正常结构的工艺结果仍是 pending。颜色缺口、坏引用、错误矩阵和旧输入等均是主动构造的负向测试，不是 D 交付缺陷，也不是 B 实物失败证据。故障测试仅在临时浏览器挂载组件，不为产品增加故障入口。
