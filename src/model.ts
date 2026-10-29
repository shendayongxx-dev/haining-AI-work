export type Carrier = 'fan' | 'custom';
export type InputChannel = 'drawing' | 'text' | 'referenceImage';
export type Step = 'carrier' | 'input' | 'generating' | 'confirm' | 'weave' | 'edit' | 'check' | 'materials';
export type Point = { x: number; y: number };
export type GenerationIssue = {
  id: string;
  code: string;
  severity: 'info' | 'warning' | 'blocking';
  stage: 'input' | 'translation' | 'geometry';
  message: string;
  targetId?: string;
  suggestion?: string;
  generatorVersion: string;
};
export type SurfacePattern = {
  patternId: string;
  coordinateSpace: { unit: 'mm'; width: number; height: number; origin: 'topLeft'; xAxis: 'right'; yAxis: 'down' };
  palette: { paletteId: string; color: string }[];
  elements: {
    elementId: string;
    sourceInputId: string;
    kind: 'polygon' | 'polyline';
    paletteId: string;
    zIndex: number;
    pointsMm: Point[];
  }[];
  transform: { scale: number; rotationDeg: number; offsetMm: Point };
};
export type CarrierShape = {
  shapeId: string;
  coordinateSpace: SurfacePattern['coordinateSpace'];
  fillRule: 'evenodd';
  components: {
    componentId: string;
    outerBoundary: { closed: boolean; pointsMm: Point[] };
    holes: { holeId: string; closed: boolean; pointsMm: Point[] }[];
  }[];
};
export type Candidate = {
  generationId: string;
  generationRevision: number;
  inputVersionId: string;
  status: 'succeeded' | 'failed';
  resultType: 'surface_pattern' | 'carrier_shape';
  generatorVersion: string;
  issues: GenerationIssue[];
  result: SurfacePattern | CarrierShape;
  label: string;
  // Compatibility projection for A's current layout and D's visual fixture.
  // D should consume `result` when its structured adapter lands.
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

