# D→E 版本失效联调样例

正常版本使用：

- `../d-v03-integration/round-cross-course/structure-snapshot.json`
- `designRevision = 1`
- `patternPlacementKey = 1:0:0:0:105:110`

修改版本使用：

- `./round-cross-course.revision-2.json`
- `designRevision = 2`
- 图样缩放改为 `1.1`
- `patternPlacementKey = 1.1:0:0:0:105:110`

两份快照均由 `calculateStructureV03()` 正常生成并通过 `validateStructureV03()`。E 应比较完整 `sourceKey`；设计版本或图样放置键变化后，revision 1 的检查、材料和教程结果应失效。

复现命令：

```sh
node node_modules/vite/bin/vite.js build --ssr scripts/generate-d-to-e-invalidation-case.ts --outDir /tmp/d-to-e-invalidation --emptyOutDir
node /tmp/d-to-e-invalidation/generate-d-to-e-invalidation-case.js
```
