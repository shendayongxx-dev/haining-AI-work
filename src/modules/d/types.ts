export type PointMm = { x: number; y: number };

export type SurfacePattern = {
  patternId: string;
  palette: { paletteId: string; color: string; role?: 'base' | 'pattern' }[];
  elements: {
    elementId: string;
    kind: 'polygon' | 'polyline';
    paletteId: string;
    zIndex: number;
    pointsMm: PointMm[];
    strokeWidthMm?: number;
  }[];
  transform: { scale: number; rotationDeg: number; translateMm: PointMm };
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
  };
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
  carrier: { type: 'fan'; unit: 'mm'; boundaryId: 'DEMO_FAN_BOUNDARY_V0.1'; widthMm: 260; heightMm: 150 };
  activeArea: { type: 'polygon'; pointsMm: PointMm[] };
  weave: { id: 'plain-demo'; rule: 'over-under-1-1'; verified: false };
  parameters: FanStructureInput['parameters'];
  grid: { spacingMm: number; warpCount: number; weftCount: number };
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
