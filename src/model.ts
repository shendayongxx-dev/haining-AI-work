export type Carrier = 'fan' | 'custom';
export type InputChannel = 'drawing' | 'text' | 'referenceImage';
export type Step = 'carrier' | 'input' | 'generating' | 'confirm' | 'weave' | 'edit' | 'check' | 'materials';
export type Point = { x: number; y: number };
export type Candidate = {
  generationId: string;
  inputVersionId: string;
  resultType: 'surface_pattern' | 'carrier_shape';
  label: string;
  pointsMm: Point[];
  color: string;
};

// Interface fixture only. B has not validated this geometry or any craft thresholds.
export const DEMO_FAN_BOUNDARY_V0_1 = {
  id: 'DEMO_FAN_BOUNDARY_V0.1',
  unit: 'mm' as const,
  width: 260,
  height: 150,
  label: '演示尺寸，待 B 实物验证',
};

export function makeCandidate(carrier: Carrier, channel: InputChannel, inputVersionId: string): Candidate {
  return {
    generationId: crypto.randomUUID(),
    inputVersionId,
    resultType: carrier === 'fan' ? 'surface_pattern' : 'carrier_shape',
    label: channel === 'drawing' ? '绿色三角形联调样例' : '通道占位候选（等待 C 接入）',
    pointsMm: carrier === 'fan'
      ? [{ x: 130, y: 35 }, { x: 95, y: 105 }, { x: 165, y: 105 }]
      : [{ x: 130, y: 15 }, { x: 65, y: 75 }, { x: 130, y: 135 }, { x: 195, y: 75 }],
    color: '#488b5c',
  };
}
