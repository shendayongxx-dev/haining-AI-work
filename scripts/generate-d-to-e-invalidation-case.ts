import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { calculateStructureV03 } from '../src/modules/d/v03/calculateStructureV03';
import { validateStructureV03 } from '../src/modules/d/v03/validateStructureV03';
import type { SurfacePattern } from '../src/modules/d/types';
import type { GenerationIssue } from '../src/model';

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
const output = join(root, 'examples/d-to-e-invalidation');
mkdirSync(output, { recursive: true });

const snapshot = calculateStructureV03({
  designId: `${source.designId}-round-cross-course`,
  designRevision: source.designRevision + 1,
  creativeSource: {
    confirmedGenerationId: source.confirmedGenerationId,
    generationRevision: source.generation.generationRevision,
    generatorVersion: source.generation.generatorVersion,
    inputVersionId: source.generation.inputVersionId,
    generationIssues: source.generation.issues,
  },
  carrierId: 'FAN-ROUND-170-V1',
  weaveId: 'CROSS-COURSE-2X2-V1',
  pattern,
  patternPlacement: { scale: 1.1, rotationDeg: 0, offsetMm: { x: 0, y: 0 }, pivotMm: { x: 105, y: 110 } },
  baseColor: '#D9BC83',
});

const validation = validateStructureV03(snapshot);
if (!validation.pass) throw new Error(validation.checks.filter(check => !check.pass).map(check => check.id).join(', '));
writeFileSync(join(output, 'round-cross-course.revision-2.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
