import type { PointMm } from '../types';
import type { StripV03, StructureSnapshotV03 } from './types';

type Shape = { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { type: 'polygon'; pointsMm: number[][] };

const esc = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function directionalShade(color: string, direction: StripV03['direction']) {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return color;
  const amount = direction === 'warp' ? 24 : -18;
  const value = Number.parseInt(match[1], 16);
  const channels = [value >> 16, (value >> 8) & 255, value & 255]
    .map(channel => Math.max(0, Math.min(255, channel + amount)).toString(16).padStart(2, '0'));
  return `#${channels.join('')}`;
}
const shape = (value: Shape, attributes: string) => value.type === 'circle'
  ? `<circle cx="${value.cx}" cy="${value.cy}" r="${value.r}" ${attributes}/>`
  : value.type === 'ellipse'
    ? `<ellipse cx="${value.cx}" cy="${value.cy}" rx="${value.rx}" ry="${value.ry}" ${attributes}/>`
    : `<polygon points="${value.pointsMm.map(point => point.join(',')).join(' ')}" ${attributes}/>`;

function colorAt(strip: StripV03, point: PointMm) {
  const start = strip.direction === 'warp' ? strip.rawBlankSegment.startMm.y : strip.rawBlankSegment.startMm.x;
  const coordinate = strip.direction === 'warp' ? point.y : point.x;
  const offset = coordinate - start;
  for (const segment of strip.visibleSegments) {
    const color = segment.colorSegments.find((entry, index, all) => offset >= entry.stripOffsetStartMm - .01
      && (offset < entry.stripOffsetEndMm - .01 || (index === all.length - 1 && offset <= entry.stripOffsetEndMm + .01)));
    if (color) return directionalShade(color.color, strip.direction);
  }
  return '#D9BC83';
}

function line(strip: StripV03, start: PointMm, end: PointMm, color: string, extra = '') {
  return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${esc(color)}" stroke-width="${strip.widthMm}" stroke-linecap="butt" ${extra}/>`;
}

function topPatch(strip: StripV03, start: PointMm, end: PointMm, color: string) {
  return `${line({ ...strip, widthMm: strip.widthMm + 1.1 }, start, end, '#3c2816', 'opacity="0.4"')}
${line(strip, start, end, color, 'filter="url(#lift)"')}`;
}

export function renderStructureSvg(snapshot: StructureSnapshotV03) {
  const boundary = snapshot.carrierGeometry.boundary as Shape;
  const effective = snapshot.carrierGeometry.effectivePatternBoundary as Shape;
  const strips = snapshot.strips;
  const stripMap = new Map(strips.map(strip => [strip.stripId, strip]));
  const base = strips.flatMap(strip => strip.visibleSegments.flatMap(segment => segment.colorSegments.map(color => {
    const rawStart = strip.direction === 'warp' ? strip.rawBlankSegment.startMm.y : strip.rawBlankSegment.startMm.x;
    const startCoordinate = rawStart + color.stripOffsetStartMm;
    const endCoordinate = rawStart + color.stripOffsetEndMm;
    const start = strip.direction === 'warp' ? { x: strip.axisMm, y: startCoordinate } : { x: startCoordinate, y: strip.axisMm };
    const end = strip.direction === 'warp' ? { x: strip.axisMm, y: endCoordinate } : { x: endCoordinate, y: strip.axisMm };
    return `${line({ ...strip, widthMm: strip.widthMm + .5 }, start, end, '#4b351d', 'opacity="0.18"')}
${line(strip, start, end, directionalShade(color.color, strip.direction))}`;
  }))).join('\n');
  const patches = snapshot.stages.rawBlank.crossings.filter(crossing => crossing.trimmedProduct.visible).map(crossing => {
    const strip = stripMap.get(crossing.topStripId);
    if (!strip) return '';
    const half = strip.widthMm * .76;
    const start = strip.direction === 'warp'
      ? { x: crossing.positionMm.x, y: crossing.positionMm.y - half }
      : { x: crossing.positionMm.x - half, y: crossing.positionMm.y };
    const end = strip.direction === 'warp'
      ? { x: crossing.positionMm.x, y: crossing.positionMm.y + half }
      : { x: crossing.positionMm.x + half, y: crossing.positionMm.y };
    return topPatch(strip, start, end, colorAt(strip, crossing.positionMm));
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" width="840" height="1188">
  <defs>
    <filter id="lift" x="-35%" y="-35%" width="170%" height="170%"><feDropShadow dx="0.65" dy="0.9" stdDeviation="0.7" flood-color="#2f1f11" flood-opacity="0.72"/></filter>
    <clipPath id="product-boundary">${shape(boundary, '')}</clipPath>
  </defs>
  <rect width="210" height="297" fill="#f7f3e9"/>
  ${shape(boundary, 'fill="#ead7ad" stroke="none"')}
  <g clip-path="url(#product-boundary)">${base}</g>
  <g clip-path="url(#product-boundary)">${patches}</g>
  ${shape(effective, 'fill="none" stroke="#8f6b3f" stroke-width="0.7" stroke-dasharray="2 2" opacity="0.8"')}
  ${shape(boundary, 'fill="none" stroke="#9b6637" stroke-width="2"')}
  <text x="105" y="215" text-anchor="middle" font-family="PingFang SC, sans-serif" font-size="5" fill="#4d3b27">${esc(snapshot.carrierId)} · ${esc(snapshot.weaveId)}</text>
  <text x="105" y="223" text-anchor="middle" font-family="PingFang SC, sans-serif" font-size="4" fill="#8a552d">结构联调预览 · 工艺与实物 pending</text>
</svg>`;
}
