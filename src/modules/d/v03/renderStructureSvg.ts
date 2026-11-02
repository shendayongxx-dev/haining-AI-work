import type { PointMm } from '../types';
import type { StripV03, StructureSnapshotV03 } from './types';

type Shape = { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { type: 'polygon'; pointsMm: number[][] };

const esc = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function directionalShade(color: string, direction: StripV03['direction']) {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return color;
  const amount = direction === 'warp' ? 7 : -7;
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

function topPatch(strip: StripV03, start: PointMm, end: PointMm, color: string, breakColor: string) {
  const highlightStart = strip.direction === 'warp' ? { x: start.x - .45, y: start.y } : { x: start.x, y: start.y - .45 };
  const highlightEnd = strip.direction === 'warp' ? { x: end.x - .45, y: end.y } : { x: end.x, y: end.y - .45 };
  return `${line({ ...strip, widthMm: strip.widthMm + 1.2 }, start, end, breakColor)}
${line({ ...strip, widthMm: strip.widthMm + .65 }, start, end, '#2f2117', 'opacity="0.38" filter="url(#lift)"')}
${line(strip, start, end, color)}
${line({ ...strip, widthMm: Math.max(.45, strip.widthMm * .08) }, highlightStart, highlightEnd, '#fff8e8', 'opacity="0.24"')}`;
}

type TopRun = { strip: StripV03; start: number; end: number; color: string };

function topRuns(snapshot: StructureSnapshotV03, stripMap: Map<string, StripV03>) {
  const intervals = new Map<string, TopRun[]>();
  for (const crossing of snapshot.stages.rawBlank.crossings) {
    if (!crossing.trimmedProduct.visible) continue;
    const strip = stripMap.get(crossing.topStripId);
    if (!strip) continue;
    const lower = stripMap.get(crossing.topStripId === crossing.warpStripId ? crossing.weftStripId : crossing.warpStripId);
    const half = Math.min(strip.pitchMm / 2, (lower?.widthMm ?? strip.widthMm) / 2 + .25);
    const coordinate = strip.direction === 'warp' ? crossing.positionMm.y : crossing.positionMm.x;
    const run = { strip, start: coordinate - half, end: coordinate + half, color: colorAt(strip, crossing.positionMm) };
    intervals.set(strip.stripId, [...(intervals.get(strip.stripId) ?? []), run]);
  }
  return [...intervals.values()].flatMap(values => {
    const sorted = values.sort((a, b) => a.start - b.start);
    const merged: TopRun[] = [];
    for (const value of sorted) {
      const previous = merged.at(-1);
      if (previous && previous.color === value.color && value.start <= previous.end + .01) previous.end = Math.max(previous.end, value.end);
      else merged.push({ ...value });
    }
    return merged;
  });
}

export function renderStructureSvg(snapshot: StructureSnapshotV03) {
  const boundary = snapshot.carrierGeometry.boundary as Shape;
  const strips = snapshot.strips;
  const openWeave = snapshot.weaveId === 'SQUARE-HOLE-1X1-V1';
  const breakColor = '#cfb98f';
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
  const runs = topRuns(snapshot, stripMap);
  const patches = runs.map(run => {
    const start = run.strip.direction === 'warp' ? { x: run.strip.axisMm, y: run.start } : { x: run.start, y: run.strip.axisMm };
    const end = run.strip.direction === 'warp' ? { x: run.strip.axisMm, y: run.end } : { x: run.end, y: run.strip.axisMm };
    return topPatch(run.strip, start, end, run.color, breakColor);
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" width="840" height="1188">
  <defs>
    <filter id="lift" x="-35%" y="-35%" width="170%" height="170%"><feDropShadow dx="0.45" dy="0.6" stdDeviation="0.45" flood-color="#2f1f11" flood-opacity="0.48"/></filter>
    <clipPath id="product-boundary">${shape(boundary, '')}</clipPath>
  </defs>
${openWeave ? '' : `  ${shape(boundary, `fill="${breakColor}"`)}\n`}
  <g clip-path="url(#product-boundary)">${base}</g>
  <g clip-path="url(#product-boundary)" data-weave-id="${esc(snapshot.weaveId)}" data-top-runs="${runs.length}">${patches}</g>
  ${shape(boundary, 'fill="none" stroke="#9b6637" stroke-width="2"')}
</svg>`;
}
