export type Carrier = 'fan' | 'custom';
export type InputChannel = 'drawing' | 'text' | 'referenceImage';
export type Step = 'carrier' | 'input' | 'generating' | 'confirm' | 'weave' | 'edit' | 'check' | 'materials';
export type Point = { x: number; y: number };
export type CarrierRef = { carrierId: 'FAN-ROUND-170-V1' | 'FAN-OVAL-150X180-V1' | 'FAN-OCTAGON-170-V1'; carrierSpecVersion: 'CARRIER-SPEC-v1.2' };
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
type CandidateBase = {
  generationId: string;
  generationRevision: number;
  inputVersionId: string;
  status: 'succeeded' | 'failed';
  generatorVersion: string;
  issues: GenerationIssue[];
  label: string;
  // Compatibility projection for A's current layout and D's visual fixture.
  // D should consume `result` when its structured adapter lands.
  pointsMm: Point[];
  color: string;
};
export type Candidate = CandidateBase & (
  | { carrierRef: CarrierRef; resultType: 'surface_pattern'; result: SurfacePattern }
  | { carrierRef: null; resultType: 'carrier_shape'; result: CarrierShape }
);

