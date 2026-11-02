import type { FixedFanCarrierId } from './fixedFanRegistry';

const availableForEveryFan = new Set(['CROSS-COURSE-2X2-V1', 'HERRING-3X3-V1', 'SQUARE-HOLE-1X1-V1']);

export function canAdjustFanStructure(carrierId: FixedFanCarrierId): boolean {
  return ['FAN-ROUND-170-V1', 'FAN-OVAL-150X180-V1', 'FAN-OCTAGON-170-V1'].includes(carrierId);
}

export function isFanWeaveAllowed(carrierId: FixedFanCarrierId, weaveId: string): boolean {
  return availableForEveryFan.has(weaveId) || (carrierId === 'FAN-ROUND-170-V1' && weaveId === 'CROSS-1X1-V1');
}

export function weaveForFanPreview(weaveId: string, carrierId: FixedFanCarrierId): string {
  return weaveId === 'CROSS-1X1-V1' && carrierId !== 'FAN-ROUND-170-V1'
    ? 'CROSS-COURSE-2X2-V1'
    : weaveId;
}
