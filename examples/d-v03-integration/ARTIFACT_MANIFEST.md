# D v0.3.3 制品清单

评审状态：`contract-accepted-pending-artifact-verification`

## 获取方式

- 分支：`d/fan-structure-snapshot-v0.2`
- 生成器版本：`D-STRUCTURE-v0.3.3`
- 结构校验器：`D-STRUCTURE-VALIDATOR-v0.3.3`

## 公共合同制品

- JSON Schema：`data/D_STRUCTURE_SNAPSHOT_V0_3.schema.json`
- TypeScript 类型：`src/modules/d/v03/types.ts`
- 结构生成器：`src/modules/d/v03/calculateStructureV03.ts`
- 运行时校验器：`src/modules/d/v03/validateStructureV03.ts`
- v0.2→v0.3 迁移文档：`docs/handoffs/D_V02_TO_V03_MIGRATION.md`
- v0.3.3 接口提案：`docs/handoffs/D_STRUCTURE_SNAPSHOT_V1.2_INTERFACE_PROPOSAL.md`
- C 复审回复：`docs/handoffs/D_TO_C_V03_3_REVIEW_RESPONSE.md`

## 三组案例

- `round-cross-course/structure-snapshot.json`
- `oval-herring/structure-snapshot.json`
- `octagon-square-hole/structure-snapshot.json`

每组同时提供 SVG、PNG、交点矩阵和验证报告。

## 验证命令

```bash
node scripts/verify-d-v03-cases.mjs
node node_modules/vite/bin/vite.js build --ssr scripts/verify-d-v03-source-contract.ts --outDir /tmp/d-v03-source-test --emptyOutDir
node /tmp/d-v03-source-test/verify-d-v03-source-contract.js
```

负向测试必须拒绝：`sourceKey` 版本不一致、C `resultId` 被改写、越界传入 `carrier_shape`、palette 色值被篡改、`sourceInputId` 被 D 重命名以及 C `generatorVersion` 缺失。
