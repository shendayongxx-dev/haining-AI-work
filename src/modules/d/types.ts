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
    sourceInputId: string;
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
  carrier: {
    id: 'FAN-ROUND-170-V1';
    boundaryId: 'BOUNDARY-ROUND-170-V1';
    effectivePatternBoundaryId: 'PATTERN-ROUND-150-V1';
    centerMm: PointMm;
    radiusMm: 85;
    effectivePatternRadiusMm: 75;
    craftRuleVersion: 'CROSS-1X1-V1';
  };
  pattern: SurfacePattern;
  generationIssues: { code: string; severity: 'info' | 'warning' | 'blocking'; message: string }[];
  parameters: {
    density: number;
    stripWidthMm: number;
    weaveId: 'CROSS-1X1-V1';
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
  sourceInputId?: string;
};

export type Strip = {
  id: string;
  direction: 'warp' | 'weft';
  index: number;
  axisMm: number;
  widthMm: number;
  startMm: PointMm;
  endMm: PointMm;
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
  sourcePattern: {
    patternId: string;
    coordinateSpace: SurfacePattern['coordinateSpace'];
    palette: SurfacePattern['palette'];
    elements: SurfacePattern['elements'];
    transform: SurfacePattern['transform'];
    generationIssues: FanStructureInput['generationIssues'];
  };
  status: { usage: 'demo'; label: '圆扇结构演示，工艺 pending' };
  carrier: {
    type: 'fan';
    unit: 'mm';
    carrierId: 'FAN-ROUND-170-V1';
    boundaryId: 'BOUNDARY-ROUND-170-V1';
    effectivePatternBoundaryId: 'PATTERN-ROUND-150-V1';
    widthMm: 210;
    heightMm: 297;
    boundaryVerification: 'provided-by-b';
  };
  activeArea: { type: 'circle'; centerMm: PointMm; radiusMm: 85 };
  weave: { id: 'CROSS-1X1-V1'; rule: 'over-under-1-1'; verified: false };
  craftComparison: {
    status: 'pending';
    conformance: 'nonconforming-demo';
    geometryStage: 'trimmed-circle-demo';
    ruleSources: string[];
    current: {
      warpCount: number;
      weftCount: number;
      stripWidthMm: number;
      thicknessMm: null;
      stockLengthMm: null;
    };
    required: {
      warpCount: number;
      weftCount: number;
      stripWidthMm: number;
      stripWidthToleranceMm: number;
      thicknessMm: number;
      thicknessToleranceMm: number;
      stockLengthMm: { min: number; max: number };
      rawBlankBboxMm: { x: number; y: number; width: number; height: number };
    };
    differences: { code: string; message: string }[];
  };
  parameters: FanStructureInput['parameters'];
  grid: { warpSpacingMm: number; weftSpacingMm: number; warpCount: number; weftCount: number };
  strips: { list: Strip[] };
  interlace: { crossings: Crossing[] };
  viewTransform: { mmToSvg: number; originSvg: PointMm; xDirection: 'right'; yDirection: 'down' };
  validation: {
    source: 'd-initial';
    designId: string;
    generatedFromRevision: number;
    status: 'pending';
    pendingReason: string;
  };
};

export type HighlightTarget =
  | { kind: 'strip'; id: string }
  | { kind: 'crossing'; id: string }
  | { kind: 'position'; positionMm: PointMm }
  | null;
