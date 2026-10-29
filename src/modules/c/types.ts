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

export interface CandidateResult {
  schemaVersion: "0.2";
  designId: string;
  designRevision: number;
  carrier: {
    id: string;
    type: CarrierType;
    boundaryId?: string;
    effectivePatternBoundaryId?: string;
    coordinateSpace: CoordinateSpaceMm;
  };
  input: CreativeInput & { inputVersionId: string };
  generation: Candidate;
}

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
import type { Candidate } from "../../model";
