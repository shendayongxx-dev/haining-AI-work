import type { Candidate, SurfacePattern as CandidateSurfacePattern } from '../../model';
import type { ConfirmationState, FanStructureInput, SurfacePattern } from './types';

export type ConfirmedCandidateOptions = {
  designId: string;
  designRevision: number;
  density: number;
  stripWidthMm: number;
  baseColor: string;
  patternColor?: string;
  patternScale?: number;
};

export function adaptConfirmedCandidate(
  candidate: Candidate,
  confirmation: ConfirmationState,
  options: ConfirmedCandidateOptions,
): FanStructureInput {
  if (candidate.status !== 'succeeded') throw new Error('D 只能读取生成成功的候选。');
  if (candidate.issues.some(issue => issue.severity === 'blocking')) throw new Error('存在阻断问题的候选不能进入 D。');
  if (candidate.resultType !== 'surface_pattern') throw new Error('当前 D 第一批只接收扇面 surface_pattern。');
  if (confirmation.status !== 'confirmed') throw new Error('候选尚未由 A 确认。');
  if (confirmation.confirmedGenerationId !== candidate.generationId) throw new Error('A 确认的 generationId 与候选不一致。');
  if (confirmation.confirmedGenerationRevision !== candidate.generationRevision) throw new Error('A 确认的生成版本与候选不一致。');

  const source = candidate.result as CandidateSurfacePattern;
  const pattern: SurfacePattern = {
    ...source,
    palette: source.palette.map(entry => ({
      ...entry,
      color: options.patternColor ?? entry.color,
    })),
    transform: {
      scale: source.transform.scale * (options.patternScale ?? 1),
      rotationDeg: source.transform.rotationDeg,
      offsetMm: source.transform.offsetMm,
    },
  };

  return {
    schemaVersion: '0.2',
    designId: options.designId,
    designRevision: options.designRevision,
    confirmedGenerationId: candidate.generationId,
    pattern,
    parameters: {
      density: options.density,
      stripWidthMm: options.stripWidthMm,
      weaveId: 'plain-demo',
      baseColor: options.baseColor,
    },
  };
}
