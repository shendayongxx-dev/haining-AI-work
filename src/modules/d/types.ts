export type PointMm = { x: number; y: number };

export type SurfacePattern = {
  patternId: string;
  coordinateSpace: {
    unit: 'mm';
    width: number;
    height: number;
    origin: 'topLeft';
    xAxis: 'right';
    yAxis: 'down';
  };
  palette: { paletteId: string; color: string }[];
  elements: {
    elementId: string;
    kind: 'polygon' | 'polyline';
    paletteId: string;
    zIndex: number;
    pointsMm: PointMm[];
    strokeWidthMm?: number;
  }[];
  transform: { scale: number; rotationDeg: number; offsetMm: PointMm };
};

export type FanStructureInput = {
  schemaVersion: '0.2';
  designId: string;
  designRevision: number;
  confirmedGenerationId: string;
  pattern: SurfacePattern;
  parameters: {
    density: number;
    stripWidthMm: number;
    weaveId: 'plain-demo';
    baseColor: string;
  };
};

export type ConfirmationState = {
  status: 'confirmed';
  confirmedGenerationId: string;
  confirmedGenerationRevision: number;
};

export type ColorSegment = {
  fromMm: number;
  toMm: number;
  paletteId: string;
  color: string;
  sourceElementId?: string;
};

export type Strip = {
  id: string;
  direction: 'warp' | 'weft';
  index: number;
  axisMm: number;
  widthMm: number;
  geometryLengthMm: number;
  colorSegments: ColorSegment[];
};

export type Crossing = {
  id: string;
  warpId: string;
  weftId: string;
  warpIndex: number;
  weftIndex: number;
  positionMm: PointMm;
  top: 'warp' | 'weft';
  ruleVerification: 'pending';
};

export type StructureSnapshot = {
  schemaVersion: '0.2';
  designId: string;
  designRevision: number;
  generatedFromRevision: number;
  confirmedGenerationId: string;
  status: { usage: 'demo'; label: '演示数据，待 B 验证' };
  carrier: {
    type: 'fan';
    unit: 'mm';
    boundaryId: 'A4-PAGE-DEMO';
    widthMm: 210;
    heightMm: 297;
    boundaryVerification: 'pending';
  };
  activeArea: { type: 'polygon'; pointsMm: PointMm[] };
  weave: { id: 'plain-demo'; rule: 'over-under-1-1'; verified: false };
  parameters: FanStructureInput['parameters'];
  grid: { warpSpacingMm: number; weftSpacingMm: number; warpCount: number; weftCount: number };
  strips: { list: Strip[] };
  interlace: { crossings: Crossing[] };
  viewTransform: { mmToSvg: number; originSvg: PointMm; xDirection: 'right'; yDirection: 'down' };
  validation: { status: 'pending'; pendingReason: string };
};

export type HighlightTarget =
  | { kind: 'strip'; id: string }
  | { kind: 'crossing'; id: string }
  | { kind: 'position'; positionMm: PointMm }
  | null;
