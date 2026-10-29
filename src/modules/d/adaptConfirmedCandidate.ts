import type { Candidate, SurfacePattern as CandidateSurfacePattern } from '../../model';
import { FORMAL_FAN_CARRIER_V1 } from '../../data/formalFanCarrier';
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

export type CToDCandidateFile = {
  schemaVersion: '0.2';
  designId: string;
  carrier: {
    id: 'FAN-ROUND-170-V1';
    boundaryId: 'BOUNDARY-ROUND-170-V1';
    effectivePatternBoundaryId: 'PATTERN-ROUND-150-V1';
  };
  generation: {
    generationId: string;
    generationRevision: number;
    status: 'succeeded' | 'failed';
    result: CandidateSurfacePattern & { resultType: 'surface_pattern' };
    issues: Candidate['issues'];
  };
};

export type ConfirmedDesignFile = CToDCandidateFile & {
  designRevision: number;
  generationRevision: number;
  confirmation: ConfirmationState & { confirmedBy: string };
  confirmedGenerationId: string;
  activeGenerationId: string;
};

function formalCarrier(): FanStructureInput['carrier'] {
  const value = FORMAL_FAN_CARRIER_V1;
  return {
    id: value.carrierId,
    boundaryId: value.boundaryId,
    effectivePatternBoundaryId: value.effectivePatternBoundaryId,
    centerMm: value.boundary.centerMm,
    radiusMm: value.boundary.radiusMm,
    effectivePatternRadiusMm: value.effectivePatternBoundary.radiusMm,
    craftRuleVersion: value.craftRuleVersion,
  };
}

function withOverrides(source: CandidateSurfacePattern, options: ConfirmedCandidateOptions): SurfacePattern {
  return {
    ...source,
    palette: source.palette.map(entry => ({ ...entry, color: options.patternColor ?? entry.color })),
    transform: {
      scale: source.transform.scale * (options.patternScale ?? 1),
      rotationDeg: source.transform.rotationDeg,
      offsetMm: source.transform.offsetMm,
    },
  };
}

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

  return {
    schemaVersion: '0.2',
    designId: options.designId,
    designRevision: options.designRevision,
    confirmedGenerationId: candidate.generationId,
    carrier: formalCarrier(),
    pattern: withOverrides(candidate.result as CandidateSurfacePattern, options),
    generationIssues: candidate.issues,
    parameters: {
      density: options.density,
      stripWidthMm: options.stripWidthMm,
      weaveId: 'CROSS-1X1-V1',
      baseColor: options.baseColor,
    },
  };
}

/** Reads the checked-in C→D envelope without using legacy candidate.pointsMm/color fields. */
export function adaptConfirmedCandidateFile(
  file: CToDCandidateFile,
  confirmation: ConfirmationState,
  options: ConfirmedCandidateOptions,
): FanStructureInput {
  const generation = file.generation;
  if (file.carrier.id !== FORMAL_FAN_CARRIER_V1.carrierId
    || file.carrier.boundaryId !== FORMAL_FAN_CARRIER_V1.boundaryId
    || file.carrier.effectivePatternBoundaryId !== FORMAL_FAN_CARRIER_V1.effectivePatternBoundaryId) {
    throw new Error('C 候选引用的正式扇面载体版本与 D 当前支持版本不一致。');
  }
  if (generation.status !== 'succeeded') throw new Error('D 只能读取生成成功的候选。');
  if (generation.result.resultType !== 'surface_pattern') throw new Error('当前 D 第一批只接收扇面 surface_pattern。');
  if (generation.issues.some(issue => issue.severity === 'blocking')) throw new Error('存在阻断问题的候选不能进入 D。');
  if (confirmation.confirmedGenerationId !== generation.generationId
    || confirmation.confirmedGenerationRevision !== generation.generationRevision) {
    throw new Error('A 确认状态与 C 候选生成版本不一致。');
  }
  const { resultType: _resultType, ...pattern } = generation.result;
  return {
    schemaVersion: file.schemaVersion,
    designId: options.designId,
    designRevision: options.designRevision,
    confirmedGenerationId: generation.generationId,
    carrier: formalCarrier(),
    pattern: withOverrides(pattern, options),
    generationIssues: generation.issues,
    parameters: {
      density: options.density,
      stripWidthMm: options.stripWidthMm,
      weaveId: 'CROSS-1X1-V1',
      baseColor: options.baseColor,
    },
  };
}

/** Formal A→D entrypoint. Reads one version-bound confirmed Design atomically. */
export function adaptConfirmedDesign(
  design: ConfirmedDesignFile,
  options: Omit<ConfirmedCandidateOptions, 'designId' | 'designRevision'>,
): FanStructureInput {
  const generation = design.generation;
  const confirmation = design.confirmation;
  if (design.designId.length === 0 || design.designRevision < 1) throw new Error('A Design 缺少有效设计标识或版本。');
  if (generation.status !== 'succeeded') throw new Error('A Design 的当前生成结果未成功。');
  if (generation.issues.some(issue => issue.severity === 'blocking')) throw new Error('A Design 存在 blocking 生成问题。');
  if (generation.result.resultType !== 'surface_pattern') throw new Error('当前 D 第一批只接收 surface_pattern。');
  if (confirmation.status !== 'confirmed') throw new Error('A Design 的当前生成结果尚未确认。');
  if (design.confirmedGenerationId !== generation.generationId
    || design.activeGenerationId !== generation.generationId
    || confirmation.confirmedGenerationId !== generation.generationId) {
    throw new Error('A Design 的确认生成 ID、活动生成 ID 与 generationId 不一致。');
  }
  if (design.generationRevision !== generation.generationRevision
    || confirmation.confirmedGenerationRevision !== generation.generationRevision) {
    throw new Error('A Design 的确认版本与生成版本不一致。');
  }
  return adaptConfirmedCandidateFile(design, confirmation, {
    ...options,
    designId: design.designId,
    designRevision: design.designRevision,
  });
}
