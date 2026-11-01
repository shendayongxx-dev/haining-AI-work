# D v0.3.2 三组共同案例

| 案例 | 完整 JSON | SVG 预览 | PNG 截图 | 交点矩阵 | 检查报告 |
|---|---|---|---|---|---|
| FAN-ROUND-170-V1 + CROSS-COURSE-2X2-V1 | [JSON](./round-cross-course/structure-snapshot.json) | [SVG](./round-cross-course/preview.svg) | [PNG](./round-cross-course/preview.png) | [CSV](./round-cross-course/crossing-matrix.csv) | [报告](./round-cross-course/validation-report.md) |
| FAN-OVAL-150X180-V1 + HERRING-3X3-V1 | [JSON](./oval-herring/structure-snapshot.json) | [SVG](./oval-herring/preview.svg) | [PNG](./oval-herring/preview.png) | [CSV](./oval-herring/crossing-matrix.csv) | [报告](./oval-herring/validation-report.md) |
| FAN-OCTAGON-170-V1 + SQUARE-HOLE-1X1-V1 | [JSON](./octagon-square-hole/structure-snapshot.json) | [SVG](./octagon-square-hole/preview.svg) | [PNG](./octagon-square-hole/preview.png) | [CSV](./octagon-square-hole/crossing-matrix.csv) | [报告](./octagon-square-hole/validation-report.md) |

三组案例统一使用 C 的绿色三角形 `surface_pattern` 作为联调图样。完整结构由 D v0.3.2 同一次计算生成 JSON 与 SVG；E 应读取 JSON，不从 SVG 取数。顶层 `strips[]` 是唯一完整竹条对象树，阶段对象只保存 ID 索引。

未确定的 `stockLengthMm`、`setupAllowanceMm`、`trimWasteLengthMm` 均为 `null`。D 结构验证为 `passed`；E 工艺与 B 实物状态保持 `pending` / `not-completed`。

## 复现与验证

生成三组案例：

`node node_modules/vite/bin/vite.js build --ssr scripts/generate-d-v03-cases.ts --outDir /tmp/d-v03-generator --emptyOutDir && node /tmp/d-v03-generator/generate-d-v03-cases.js`

验证结构合同：

`node scripts/verify-d-v03-cases.mjs`
