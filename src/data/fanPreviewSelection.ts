import type { FixedFanCarrierId } from './fixedFanRegistry';

export function weaveForFanPreview(weaveId: string, carrierId: FixedFanCarrierId): string {
  return weaveId === 'CROSS-1X1-V1' && carrierId !== 'FAN-ROUND-170-V1'
    ? 'CROSS-COURSE-2X2-V1'
    : weaveId;
}
