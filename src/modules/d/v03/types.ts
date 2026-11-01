import type { PointMm, SurfacePattern } from '../types';

export type CarrierId = 'FAN-ROUND-170-V1' | 'FAN-OVAL-150X180-V1' | 'FAN-OCTAGON-170-V1';
export type WeaveId = 'CROSS-COURSE-2X2-V1' | 'HERRING-3X3-V1' | 'SQUARE-HOLE-1X1-V1';
export type Direction = 'warp' | 'weft';
export type SegmentScope = 'motif' | 'base' | 'outer-base';

export type StructureV03Input = {
  designId: string;
  designRevision: number;
  confirmedGenerationId: string;
  carrierId: CarrierId;
  weaveId: WeaveId;
  pattern: SurfacePattern;
  baseColor: string;
};

export type ColorSegmentV03 = {
  stripOffsetStartMm: number;
  stripOffsetEndMm: number;
  scope: SegmentScope;
  color: string;
  paletteId: string | null;
  sourceElementId: string | null;
  sourceInputId: string | null;
};

export type VisibleSegmentV03 = {
  segmentId: string;
  ordinal: number;
  startMm: PointMm;
  endMm: PointMm;
  stripOffsetStartMm: number;
  stripOffsetEndMm: number;
  lengthMm: number;
  crossingIds: string[];
  colorSegments: ColorSegmentV03[];
};

export type StripV03 = {
  stripId: string;
  direction: Direction;
  order: number;
  axisMm: number;
  widthMm: number;
  thicknessMm: number;
  pitchMm: number;
  rawBlankSegment: { startMm: PointMm; endMm: PointMm; lengthMm: number };
  visibleSegments: VisibleSegmentV03[];
  stockLengthMm: number | null;
  rawBlankLengthMm: number;
  visibleLengthMm: number;
  setupAllowanceMm: number | null;
  trimWasteLengthMm: number | null;
};

export type CrossingV03 = {
  crossingId: string;
  warpStripId: string;
  warpSegmentId: string | null;
  weftStripId: string;
  weftSegmentId: string | null;
  positionMm: PointMm;
  topStripId: string;
  rawBlank: true;
  trimmedProduct: { visible: boolean };
};

export type WeavingOperationV03 = {
  step: number;
  operationId: string;
  workingStripId: string;
  workingDirection: 'weft';
  crossingSequence: number;
  crossingId: string;
  referenceStripId: string;
  action: 'over' | 'under';
  positionMm: PointMm;
  trimmedProduct: {
    visible: boolean;
    workingSegmentId: string | null;
    referenceSegmentId: string | null;
  };
};

export type EngineeringWarningV03 = {
  warningId: string;
  code: 'SHORT_VISIBLE_SEGMENT' | 'OPEN_HALF_HOLE_AT_EDGE' | 'CORNER_REINFORCEMENT_REQUIRED' | 'HANDLE_REINFORCEMENT_REQUIRED';
  status: 'pending';
  severity: 'review';
  carrierId: CarrierId;
  weaveId: WeaveId;
  stripId: string | null;
  segmentId: string | null;
  crossingIds: string[] | null;
  positionMm: PointMm | null;
  measurement: { measuredValue: number; referenceValue: number; operator: '<'; unit: 'mm' } | null;
  ruleSource: string;
  message: string;
};

export type StructureSnapshotV03 = {
  schemaVersion: '0.3';
  structureGeneratorVersion: 'D-STRUCTURE-v0.3.1';
  designId: string;
  generatedFromRevision: number;
  confirmedGenerationId: string;
  carrierId: CarrierId;
  carrierSpecVersion: 'CARRIER-SPEC-v1.2';
  weaveId: WeaveId;
  weaveSpecVersion: 'WEAVE-SPEC-v1.2';
  craftRuleVersion: string;
  validationStatus: 'pending';
  physicalValidation: 'not-completed';
  sourceKey: {
    schemaVersion: '0.3';
    structureGeneratorVersion: 'D-STRUCTURE-v0.3.1';
    designId: string;
    generatedFromRevision: number;
    carrierId: CarrierId;
    carrierSpecVersion: 'CARRIER-SPEC-v1.2';
    weaveId: WeaveId;
    weaveSpecVersion: 'WEAVE-SPEC-v1.2';
    craftRuleVersion: string;
  };
  sourcePattern: SurfacePattern;
  coordinateSpace: { widthMm: 210; heightMm: 297; origin: 'top-left'; xAxis: 'right'; yAxis: 'down' };
  carrierGeometry: {
    boundary: unknown;
    effectivePatternBoundary: unknown;
    handleExclusion: unknown;
  };
  outerBaseWeaveZone: {
    operation: 'boundary-minus-effectivePatternBoundary';
    baseWeaveRequired: true;
    carrierBoundaryRef: { carrierId: CarrierId; carrierSpecVersion: 'CARRIER-SPEC-v1.2'; field: 'boundary' };
    effectivePatternBoundaryRef: { carrierId: CarrierId; carrierSpecVersion: 'CARRIER-SPEC-v1.2'; field: 'effectivePatternBoundary' };
    continuity: Record<string, true>;
  };
  grid: { warpCount: number; weftCount: number; pitchMm: number; stripWidthMm: number; clearHoleMm: number };
  stages: {
    rawBlank: { boundary: unknown; strips: StripV03[]; crossings: CrossingV03[]; weavingOrder: WeavingOperationV03[] };
    trimmedProduct: { boundary: unknown; effectivePatternBoundary: unknown; strips: StripV03[]; visibleCrossingIds: string[] };
  };
  engineeringWarnings: EngineeringWarningV03[];
  materialAccounting: {
    identityKey: 'stripId'; countRule: 'count-each-stripId-once';
    lengthSourcePriority: ['stockLengthMm', 'verifiedAllowanceFormula']; fallbackStatus: 'pending';
    forbiddenLengthSources: ['rawBlankSegment.lengthMm', 'visibleLengthMm'];
  };
};
