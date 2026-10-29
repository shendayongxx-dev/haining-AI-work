export type InputChannel = "drawing" | "text" | "referenceImage";
export type CarrierType = "fan" | "custom";

export interface Point {
  x: number;
  y: number;
}

export interface CoordinateSpaceMm {
  unit: "mm";
  width: number;
  height: number;
  origin: "topLeft";
  xAxis: "right";
  yAxis: "down";
}

export interface DrawingStroke {
  id: string;
  color: string;
  width: number;
  closed: boolean;
  points: Point[];
}

export type CreativeInput =
  | {
      channel: "drawing";
      captureMethod: "pointer" | "cameraGesture";
      drawingSpace: {
        unit: "normalized";
        width: 1;
        height: 1;
        origin: "topLeft";
        xAxis: "right";
        yAxis: "down";
      };
      strokes: DrawingStroke[];
    }
  | {
      channel: "text";
      text: string;
      language: "zh-CN";
    }
  | {
      channel: "referenceImage";
      assetRef: string;
      fileName: string;
      mimeType: "image/png" | "image/jpeg" | "image/webp";
      sizeBytes: number;
    };

export interface GenerationIssue {
  id: string;
  code: string;
  severity: "warning" | "blocking";
  message: string;
  targetId?: string;
}

export interface SurfacePattern {
  patternId: string;
  clippingBoundaryId: string;
  coordinateSpace: CoordinateSpaceMm;
  palette: Array<{ id: string; value: string }>;
  elements: Array<{
    elementId: string;
    sourceInputId?: string;
    type: "polygon" | "polyline";
    pointsMm: Point[];
    paletteId: string;
    zIndex: number;
  }>;
}

export interface CarrierShape {
  shapeId: string;
  coordinateSpace: CoordinateSpaceMm;
  fillRule: "evenodd";
  components: Array<{
    componentId: string;
    outerBoundary: { closed: boolean; pointsMm: Point[] };
    holes: Array<{ holeId: string; closed: boolean; pointsMm: Point[] }>;
  }>;
}

interface CandidateBase {
  schemaVersion: "DESIGN_DATA_V0.2";
  designId: string;
  designRevision: number;
  generationRevision: number;
  carrier: {
    id: string;
    type: CarrierType;
    boundaryId: string;
    effectivePatternBoundaryId?: string;
    coordinateSpace: CoordinateSpaceMm;
  };
  input: CreativeInput & { inputVersionId: string };
  generation: {
    generationId: string;
    status: "succeeded" | "failed";
    confirmed: false;
    generatorVersion: string;
    issues: GenerationIssue[];
  };
  craftStatus: "demo_pending_validation";
}

export type CandidateResult =
  | (CandidateBase & {
      generation: CandidateBase["generation"] & {
        resultType: "surface_pattern";
        surfacePattern: SurfacePattern;
      };
    })
  | (CandidateBase & {
      generation: CandidateBase["generation"] & {
        resultType: "carrier_shape";
        carrierShape: CarrierShape;
      };
    });

export interface GenerationRequest {
  carrier: CandidateResult["carrier"];
  input: CreativeInput;
}

export type GenerateCandidate = (request: GenerationRequest) => Promise<CandidateResult>;

export const NORMALIZED_DRAWING_SPACE = {
  unit: "normalized",
  width: 1,
  height: 1,
  origin: "topLeft",
  xAxis: "right",
  yAxis: "down",
} as const;
