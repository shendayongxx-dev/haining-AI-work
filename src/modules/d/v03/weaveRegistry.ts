import weaveSpecJson from '../../../../data/WEAVE_SPEC_V1_2.json';
import type { WeaveId, WeaveSpecVersion } from './types';

export type ResolvedWeaveSpec = {
  weaveId: WeaveId;
  weaveSpecVersion: WeaveSpecVersion;
  craftRuleVersion: string;
  gridType: string;
  topLayerMatrix: string[][];
};

const plainWeave: ResolvedWeaveSpec = {
  weaveId: 'CROSS-1X1-V1',
  weaveSpecVersion: 'D-CANDIDATE-WEAVE-v0.1',
  craftRuleVersion: 'CRAFT-CROSS-1X1-DEMO-v1',
  gridType: 'orthogonal-dense',
  topLayerMatrix: [['W', 'V'], ['V', 'W']],
};

export function resolveWeaveSpec(weaveId: WeaveId): ResolvedWeaveSpec {
  if (weaveId === plainWeave.weaveId) return plainWeave;
  const value = weaveSpecJson.weaves.find(entry => entry.weaveId === weaveId);
  if (!value) throw new Error(`Unsupported weaveId: ${weaveId}`);
  return { ...value, weaveId, weaveSpecVersion: 'WEAVE-SPEC-v1.2' };
}
