import type { FixedFanCarrierId } from './data/fixedFanRegistry';
import { resolveFixedFan, fixedFanRef } from './data/fixedFanRegistry';

export default function FixedFanShape({ id, field, ...props }: { id: FixedFanCarrierId; field: 'boundary' | 'effectivePatternBoundary'; fill?: string; stroke?: string; strokeWidth?: number; strokeDasharray?: string }) {
  const shape = resolveFixedFan(fixedFanRef(id))[field];
  if (shape.type === 'circle') return <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...props} />;
  if (shape.type === 'ellipse') return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...props} />;
  return <polygon points={shape.pointsMm!.map(point => point.join(',')).join(' ')} {...props} />;
}
