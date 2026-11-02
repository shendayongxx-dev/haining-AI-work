import type { FixedFanCarrierId } from './fixedFanRegistry';

const availableForEveryFan = new Set(['CROSS-COURSE-2X2-V1', 'HERRING-3X3-V1', 'SQUARE-HOLE-1X1-V1']);

export function canAdjustFanStructure(carrierId: FixedFanCarrierId): boolean {
  return carrierId === 'FAN-ROUND-170-V1';
}

export function isFanWeaveAllowed(carrierId: FixedFanCarrierId, weaveId: string): boolean {
  return availableForEveryFan.has(weaveId) || (canAdjustFanStructure(carrierId) && weaveId === 'CROSS-1X1-V1');
}

export function weaveForFanPreview(weaveId: string, carrierId: FixedFanCarrierId): string {
  return weaveId === 'CROSS-1X1-V1' && !canAdjustFanStructure(carrierId)
    ? 'CROSS-COURSE-2X2-V1'
    : weaveId;
}
