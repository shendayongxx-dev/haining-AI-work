export interface CameraSession {
  start(): Promise<MediaStream>;
  stop(): void;
  getStream(): MediaStream | null;
}

export function createCameraSession(options: {
  mediaDevices: MediaDevices;
  videoElement?: HTMLVideoElement;
  constraints?: MediaStreamConstraints;
}): CameraSession;

export interface GesturePoint { x: number; y: number; timestamp?: number }
export interface GestureStroke { points: GesturePoint[] }
export interface GestureEvent {
  type: string;
  reason?: string;
  cursor?: GesturePoint;
  stroke?: GestureStroke;
}

export interface PinchDrawingController {
  update(result: { landmarks?: Array<{ x: number; y: number }>; mirrored?: boolean; timestamp?: number }): GestureEvent;
  cancel(): GestureEvent | null;
  getActiveStroke(): GestureStroke | null;
}

export function createPinchDrawingController(options?: {
  startThreshold?: number;
  stopThreshold?: number;
  smoothingFactor?: number;
  maximumLostFrames?: number;
  createId?: () => string;
  style?: { color: string; width: number };
}): PinchDrawingController;

export function mapNormalizedPointToDesignSpace(point: GesturePoint, width: number, height: number): { x: number; y: number };
export function closeGestureLoop(points: GesturePoint[], options?: { minimumGap?: number; maximumGap?: number; relativeGap?: number }): GesturePoint[];
