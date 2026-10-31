import type { CarrierShape, GenerationIssue, Point } from '../../model';

export type CustomStructureParameters = { density: number; stripWidthMm: number; warpColor: string; weftColor: string; shapeScale: number };
export type CustomStructureInput = {
  schemaVersion: '0.2'; designId: string; designRevision: number; confirmedGenerationId: string;
  shape: CarrierShape; generationIssues: GenerationIssue[]; weaveId: 'CROSS-1X1-V1'; parameters: CustomStructureParameters;
};
export type CustomStrip = {
  id: string; direction: 'warp' | 'weft'; axisIndex: number; segmentIndex: number; axisMm: number;
  widthMm: number; color: string; startMm: Point; endMm: Point; geometryLengthMm: number;
};
export type CustomCrossing = {
  id: string; warpStripId: string; weftStripId: string; positionMm: Point; top: 'warp' | 'weft';
};
export type CustomStructureSnapshot = {
  schemaVersion: '0.2'; designId: string; designRevision: number; generatedFromRevision: number;
  confirmedGenerationId: string; shapeId: string; coordinateSpace: CarrierShape['coordinateSpace']; boundary: Point[];
  weave: { id: 'CROSS-1X1-V1'; rule: 'over-under-1-1' }; parameters: CustomStructureParameters;
  strips: { list: CustomStrip[] }; interlace: { crossings: CustomCrossing[] };
  craft: { status: 'pending'; pendingReason: string };
};
export type CustomStructureResult =
  | { status: 'ok'; snapshot: CustomStructureSnapshot }
  | { status: 'blocked'; code: string; message: string };
