import type { StructureSnapshotV03, WeavingOperationV03 } from '../../d/v03/types';
export type SourceKey = StructureSnapshotV03['sourceKey'];
export type ConsumptionResult = {
  sourceKey: SourceKey;
  structuralConsumptionPassed: boolean;
  craftValidation: {status:'pending';owner:'E'};
  physicalValidation: {status:'not-completed';owner:'B'}; formalExportAllowed: false;
  checks: {id:string;pass:boolean}[];
  errors: {code:string;path:string;message:string}[];
  notes: {code:string;message:string}[];
  materials: {sourceKey:SourceKey;status:'pending';stripCount:number;totalStockLengthMm:number|null;missingStockStripIds:string[]};
  tutorialPreview: {sourceKey:SourceKey;status:'pending';usage:string;steps:{step:number;workingStripId:string;operations:WeavingOperationV03[]}[]};
  counts: {strips:number;segments:number;crossings:number;visibleCrossings:number;operations:number;tutorialGroups:number;engineeringWarnings:number};
};
export const SOURCE_FIELDS: readonly string[];
export function sourceKeyValid(key: unknown): key is SourceKey;
export function sameSource(a: unknown,b: unknown): boolean;
export function acceptV03Result<T extends {sourceKey:SourceKey}>(currentKey:SourceKey,incoming:T,previous?:T|null):T|null;
export function consumeV03(d:StructureSnapshotV03,specs:{carrier:unknown;weave:unknown}):ConsumptionResult;
