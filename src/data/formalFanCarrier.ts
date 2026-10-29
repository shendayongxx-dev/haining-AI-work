import type { Point } from '../model';

export const FORMAL_FAN_CARRIER_V1 = {
  carrierId: 'FAN-ROUND-170-V1',
  carrierName: '圆形／月圆式竹编团扇',
  boundaryId: 'BOUNDARY-ROUND-170-V1',
  effectivePatternBoundaryId: 'PATTERN-ROUND-150-V1',
  coordinateSpace: {
    unit: 'mm' as const,
    width: 210,
    height: 297,
    origin: 'topLeft' as const,
    xAxis: 'right' as const,
    yAxis: 'down' as const,
  },
  boundary: {
    type: 'circle' as const,
    centerMm: { x: 105, y: 110 },
    radiusMm: 85,
  },
  effectivePatternBoundary: {
    type: 'circle' as const,
    centerMm: { x: 105, y: 110 },
    radiusMm: 75,
  },
  handleReserve: {
    id: 'HANDLE-RESERVE-20X25-V1',
    x: 95,
    y: 170,
    width: 20,
    height: 25,
    restriction: 'noCriticalPattern' as const,
  },
  craftRuleVersion: 'CROSS-1X1-V1',
} as const;

export function distanceFromFanCenter(point: Point) {
  const center = FORMAL_FAN_CARRIER_V1.boundary.centerMm;
  return Math.hypot(point.x - center.x, point.y - center.y);
}

export function clampToEffectivePatternBoundary(point: Point): Point {
  const center = FORMAL_FAN_CARRIER_V1.effectivePatternBoundary.centerMm;
  const radius = FORMAL_FAN_CARRIER_V1.effectivePatternBoundary.radiusMm;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= radius || distance === 0) return point;
  const scale = radius / distance;
  return { x: round(center.x + dx * scale), y: round(center.y + dy * scale) };
}

export function pointInHandleReserve(point: Point) {
  const zone = FORMAL_FAN_CARRIER_V1.handleReserve;
  return point.x >= zone.x && point.x <= zone.x + zone.width
    && point.y >= zone.y && point.y <= zone.y + zone.height;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
