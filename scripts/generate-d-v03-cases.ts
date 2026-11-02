import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { calculateStructureV03 } from '../src/modules/d/v03/calculateStructureV03';
import { renderStructureSvg } from '../src/modules/d/v03/renderStructureSvg';
import { validateStructureV03 } from '../src/modules/d/v03/validateStructureV03';
import type { SurfacePattern } from '../src/modules/d/types';
import type { GenerationIssue } from '../src/model';
import type { CarrierId, WeaveId } from '../src/modules/d/v03/types';

type ConfirmedDesign = {
  designId: string;
  designRevision: number;
  confirmedGenerationId: string;
  generation: {
    generationId: string;
    generationRevision: number;
    inputVersionId: string;
    generatorVersion: string;
    issues: GenerationIssue[];
    result: SurfacePattern & { resultType: 'surface_pattern' };
  };
};

const root = process.cwd();
const source = JSON.parse(readFileSync(join(root, 'examples/a-to-d/fan-green-triangle.confirmed-design.json'), 'utf8')) as ConfirmedDesign;
const { resultType: _resultType, ...pattern } = source.generation.result;
const outputRoot = join(root, 'examples/d-v03-integration');
const cases: { slug: string; carrierId: CarrierId; weaveId: WeaveId }[] = [
  { slug: 'round-cross-course', carrierId: 'FAN-ROUND-170-V1', weaveId: 'CROSS-COURSE-2X2-V1' },
  { slug: 'oval-herring', carrierId: 'FAN-OVAL-150X180-V1', weaveId: 'HERRING-3X3-V1' },
  { slug: 'octagon-square-hole', carrierId: 'FAN-OCTAGON-170-V1', weaveId: 'SQUARE-HOLE-1X1-V1' },
];

mkdirSync(outputRoot, { recursive: true });
for (const entry of cases) {
  const directory = join(outputRoot, entry.slug);
  mkdirSync(directory, { recursive: true });
  const snapshot = calculateStructureV03({
    designId: `${source.designId}-${entry.slug}`,
    designRevision: source.designRevision,
    creativeSource: {
      confirmedGenerationId: source.confirmedGenerationId,
      generationRevision: source.generation.generationRevision,
      generatorVersion: source.generation.generatorVersion,
      inputVersionId: source.generation.inputVersionId,
      generationIssues: source.generation.issues,
    },
    carrierId: entry.carrierId,
    weaveId: entry.weaveId,
    pattern,
    baseColor: '#D9BC83',
  });
  const validation = validateStructureV03(snapshot);
  if (!validation.pass) {
    const failures = validation.checks.filter(check => !check.pass).map(check => check.id).join(', ');
    throw new Error(`${entry.slug} failed structural validation: ${failures}`);
  }
  const report = `# ${entry.carrierId} + ${entry.weaveId} 验证报告

- 自动检查：${validation.pass ? '通过' : '失败'}
- 结构验证：\`${snapshot.structuralValidation.status}\`
- 工艺验证：\`${snapshot.craftValidation.status}\`
- 实物验证：\`${snapshot.physicalValidation.status}\`
- 毛坯竹条：${snapshot.strips.length} 根
- 毛坯交点：${snapshot.stages.rawBlank.crossings.length} 个
- 裁切后可见交点：${snapshot.stages.trimmedProduct.visibleCrossingIds.length} 个
- 工程预警：${snapshot.engineeringWarnings.length} 项，均为 \`review/pending\`

## 自动检查

| 检查项 | 结果 | 说明 |
|---|---|---|
${validation.checks.map(check => `| \`${check.id}\` | ${check.pass ? 'PASS' : 'FAIL'} | ${check.details} |`).join('\n')}

## 边界裁切检查

- 先按 189×189 mm 毛坯建立全局竹条、交点矩阵及连续挑压相位，再按载体边界生成 \`visibleSegments[]\`。
- 裁切不改变 \`stripId\`、竹条方向、顺序、节距或交点相位；可见交点通过 \`warpSegmentId\` / \`weftSegmentId\` 双向追溯。
- 有效图样区只控制颜色映射；外侧区域继续显示基础编法，不截断竹条。

## pending 风险

- \`PHYSICAL-VALIDATION\`：尚无真实测量、试编照片或实物验收记录（pending）。
${snapshot.engineeringWarnings.map(warning => `- \`${warning.warningId}\`：${warning.message}（${warning.status}）`).join('\n') || '- 本案例未触发额外的自动工程预警。'}

## 验证方法

在仓库根目录运行：

\`node scripts/verify-d-v03-cases.mjs\`

SVG 仅作结构预览；JSON 是 E 组消费的权威数据源。
`;
  writeFileSync(join(directory, 'structure-snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
  const crossings = snapshot.stages.rawBlank.crossings;
  const matrix = [
    ['', ...Array.from({ length: snapshot.grid.warpCount }, (_, index) => `V${String(index + 1).padStart(3, '0')}`)].join(','),
    ...Array.from({ length: snapshot.grid.weftCount }, (_, weftIndex) => [
      `H${String(weftIndex + 1).padStart(3, '0')}`,
      ...Array.from({ length: snapshot.grid.warpCount }, (_, warpIndex) => {
        const crossing = crossings.find(value => value.warpStripId === `V${String(warpIndex + 1).padStart(3, '0')}`
          && value.weftStripId === `H${String(weftIndex + 1).padStart(3, '0')}`)!;
        return crossing.topStripId.startsWith('V') ? 'V' : 'H';
      }),
    ].join(',')),
  ].join('\n');
  writeFileSync(join(directory, 'crossing-matrix.csv'), `${matrix}\n`);
  writeFileSync(join(directory, 'preview.svg'), renderStructureSvg(snapshot));
  writeFileSync(join(directory, 'validation-report.json'), `${JSON.stringify(validation, null, 2)}\n`);
  writeFileSync(join(directory, 'validation-report.md'), report);
}

writeFileSync(join(outputRoot, 'README.md'), `# D v0.3.6 三组共同案例

[公共合同制品与验证命令](./ARTIFACT_MANIFEST.md)

| 案例 | 完整 JSON | SVG 预览 | PNG 截图 | 交点矩阵 | 检查报告 |
|---|---|---|---|---|---|
${cases.map(entry => `| ${entry.carrierId} + ${entry.weaveId} | [JSON](./${entry.slug}/structure-snapshot.json) | [SVG](./${entry.slug}/preview.svg) | [PNG](./${entry.slug}/preview.png) | [CSV](./${entry.slug}/crossing-matrix.csv) | [报告](./${entry.slug}/validation-report.md) |`).join('\n')}

三组案例统一使用 C 的绿色三角形 \`surface_pattern\` 作为联调图样。完整结构由 D v0.3.6 同一次计算生成 JSON 与 SVG；E 应读取 JSON，不从 SVG 取数。顶层 \`strips[]\` 是唯一完整竹条对象树，阶段对象只保存 ID 索引。\`creativeSource\` 与不可变 \`sourcePattern\` 保存 C 的完整来源链，\`patternPlacement\` 记录 D 的图样缩放。

未确定的 \`stockLengthMm\`、\`setupAllowanceMm\`、\`trimWasteLengthMm\` 均为 \`null\`。D 结构验证为 \`passed\`；E 工艺与 B 实物状态保持 \`pending\` / \`not-completed\`。

## 复现与验证

生成三组案例：

\`node node_modules/vite/bin/vite.js build --ssr scripts/generate-d-v03-cases.ts --outDir /tmp/d-v03-generator --emptyOutDir && node /tmp/d-v03-generator/generate-d-v03-cases.js\`

验证结构合同：

\`node scripts/verify-d-v03-cases.mjs\`

来源合同篡改失败测试见 \`ARTIFACT_MANIFEST.md\`。
`);
